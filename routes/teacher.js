const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { getDb } = require('../database/init');
const { authMiddleware, teacherOnly, logOperation } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');
const { resolveAccessProfile } = require('../utils/accessControl');
const { buildEventResultMeta, autoRankSchedules } = require('../utils/resultEntry');

router.use(authMiddleware);
router.use(teacherOnly);

function getIp(req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
}

function parseAssignedEventIds(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    const source = Array.isArray(parsed) ? parsed : String(value).split(',');
    return [...new Set(source
      .map((item) => parseInt(item, 10))
      .filter((item) => Number.isInteger(item) && item > 0))];
  } catch (_) {
    return String(value)
      .split(',')
      .map((item) => parseInt(item, 10))
      .filter((item) => Number.isInteger(item) && item > 0);
  }
}

function getTeacherProfile(db, userId) {
  return db.prepare(`
    SELECT id, username, email, role, name,
      COALESCE(permission_role, CASE WHEN role = 'admin' AND COALESCE(staff_type, '') != '' THEN 'teacher' WHEN role = 'admin' THEN 'global_admin' ELSE 'student' END) AS permission_role,
      COALESCE(staff_type, '') AS staff_type,
      COALESCE(managed_grade, '') AS managed_grade,
      COALESCE(managed_class_name, '') AS managed_class_name,
      COALESCE(assigned_event_ids, '[]') AS assigned_event_ids
    FROM users
    WHERE id = ?
  `).get(userId);
}

function assertHomeroomTeacher(profile) {
  const access = resolveAccessProfile(profile);
  if (!access.isHomeroomTeacher) {
    throw new Error('仅班主任可操作此功能');
  }
}

function assertEventTeacher(profile) {
  const access = resolveAccessProfile(profile);
  if (!access.isEventTeacher) {
    throw new Error('仅任课教师可操作此功能');
  }
}

function getManagedStudentWhere(profile) {
  const managedGrade = String(profile?.managed_grade || '').trim();
  const managedClassName = String(profile?.managed_class_name || '').trim();
  if (!managedGrade || !managedClassName) {
    throw new Error('班主任必须同时配置负责年级和班级');
  }
  const conditions = ['u.grade = ?', 'u.class_name = ?'];
  const params = [managedGrade, managedClassName];
  return {
    where: conditions.join(' AND '),
    params
  };
}

function buildManagedStudentIds(db, profile) {
  const scope = getManagedStudentWhere(profile);
  return db.prepare(`SELECT u.id FROM users u WHERE u.role = 'student' AND ${scope.where}`).all(...scope.params).map((item) => item.id);
}

function normalizeRegistrationReviewAction(action) {
  const normalized = String(action || '').trim();
  if (!['approve', 'reject'].includes(normalized)) {
    throw new Error('无效的审核操作');
  }
  return normalized;
}

function normalizeRegistrationKeyword(value) {
  return String(value || '').trim().slice(0, 50);
}

function normalizeRegistrationMatchMode(value) {
  return String(value || '').trim() === 'exact' ? 'exact' : 'fuzzy';
}

function appendRegistrationKeywordFilter(sqlParts, params, keyword, matchMode) {
  if (!keyword) return;
  if (matchMode === 'exact') {
    sqlParts.push('AND (u.student_id = ? OR u.name = ? OR e.name = ?)');
    params.push(keyword, keyword, keyword);
    return;
  }
  const likeKeyword = `%${keyword}%`;
  sqlParts.push('AND (u.student_id LIKE ? OR u.name LIKE ? OR e.name LIKE ?)');
  params.push(likeKeyword, likeKeyword, likeKeyword);
}

function listHomeroomRegistrations(db, profile, query = {}) {
  const scope = getManagedStudentWhere(profile);
  const status = String(query.status || '').trim();
  const eventId = parseInt(query.event_id, 10) || 0;
  const studentKeyword = normalizeRegistrationKeyword(query.student_keyword);
  const matchMode = normalizeRegistrationMatchMode(query.match_mode);
  const params = [...scope.params];
  const sqlParts = [
    `SELECT r.id, r.status, r.reject_reason, r.created_at, r.reviewed_at,
      u.id AS user_id, u.name AS user_name, u.student_id, u.grade, u.class_name,
      e.id AS event_id, e.name AS event_name, e.category
    FROM registrations r
    JOIN users u ON u.id = r.user_id
    JOIN events e ON e.id = r.event_id
    WHERE ${scope.where}`
  ];
  if (status) {
    sqlParts.push('AND r.status = ?');
    params.push(status);
  }
  if (eventId) {
    sqlParts.push('AND e.id = ?');
    params.push(eventId);
  }
  appendRegistrationKeywordFilter(sqlParts, params, studentKeyword, matchMode);
  sqlParts.push("ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'cancelling' THEN 1 ELSE 2 END, r.created_at DESC");
  const list = db.prepare(sqlParts.join('\n')).all(...params);
  const eventOptions = db.prepare(`
    SELECT DISTINCT e.id, e.name
    FROM registrations r
    JOIN users u ON u.id = r.user_id
    JOIN events e ON e.id = r.event_id
    WHERE ${scope.where}
    ORDER BY e.name, e.id
  `).all(...scope.params);
  return {
    list,
    filters: {
      status,
      event_id: eventId || '',
      student_keyword: studentKeyword,
      match_mode: matchMode
    },
    events: eventOptions
  };
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function listHomeroomOverviewResults(db, profile, query = {}) {
  const scope = getManagedStudentWhere(profile);
  const eventId = parseInt(query.event_id, 10) || 0;
  const studentKeyword = normalizeRegistrationKeyword(query.student_keyword);
  const matchMode = normalizeRegistrationMatchMode(query.match_mode);
  const params = [...scope.params];
  const sqlParts = [
    `SELECT
      rs.id,
      rs.performance,
      rs.rank,
      rs.score,
      rs.award,
      rs.note,
      rs.is_published,
      rs.updated_at,
      u.id AS user_id,
      u.name AS user_name,
      u.student_id,
      u.grade,
      u.class_name,
      s.id AS schedule_id,
      COALESCE(s.round_name, '') AS round_name,
      e.id AS event_id,
      e.name AS event_name,
      e.category
    FROM results rs
    JOIN users u ON u.id = rs.user_id
    JOIN schedules s ON s.id = rs.schedule_id
    JOIN events e ON e.id = s.event_id
    WHERE ${scope.where}`
  ];
  if (eventId) {
    sqlParts.push('AND e.id = ?');
    params.push(eventId);
  }
  appendRegistrationKeywordFilter(sqlParts, params, studentKeyword, matchMode);
  sqlParts.push(`ORDER BY e.sort_order, e.id, CASE WHEN rs.rank > 0 THEN rs.rank ELSE 999999 END, u.student_id, u.name, rs.id`);
  const rows = db.prepare(sqlParts.join('\n')).all(...params);

  const events = db.prepare(`
    SELECT DISTINCT e.id, e.name
    FROM results rs
    JOIN users u ON u.id = rs.user_id
    JOIN schedules s ON s.id = rs.schedule_id
    JOIN events e ON e.id = s.event_id
    WHERE ${scope.where}
    ORDER BY e.sort_order, e.id
  `).all(...scope.params);

  const groupedRows = new Map();
  rows.forEach((row) => {
    const key = Number(row.event_id);
    if (!groupedRows.has(key)) groupedRows.set(key, []);
    groupedRows.get(key).push(row);
  });

  const classRankMap = new Map();
  const eventStatsMap = new Map();
  groupedRows.forEach((eventRows, key) => {
    const sorted = [...eventRows].sort((a, b) => {
      const scoreA = toFiniteNumber(a.score);
      const scoreB = toFiniteNumber(b.score);
      if (scoreA !== null && scoreB !== null && scoreA !== scoreB) return scoreB - scoreA;
      if (scoreA !== null && scoreB === null) return -1;
      if (scoreA === null && scoreB !== null) return 1;
      const rankA = Number(a.rank) > 0 ? Number(a.rank) : Number.MAX_SAFE_INTEGER;
      const rankB = Number(b.rank) > 0 ? Number(b.rank) : Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return String(a.student_id || a.user_name || '').localeCompare(String(b.student_id || b.user_name || ''), 'zh-Hans-CN');
    });
    sorted.forEach((row, index) => {
      classRankMap.set(Number(row.id), index + 1);
    });
    const scoreList = eventRows
      .map((item) => toFiniteNumber(item.score))
      .filter((item) => item !== null);
    const averageScore = scoreList.length ? roundTo(scoreList.reduce((sum, item) => sum + item, 0) / scoreList.length) : null;
    const bestScore = scoreList.length ? roundTo(Math.max(...scoreList)) : null;
    const rankingCount = eventRows.filter((item) => Number(item.rank) > 0).length;
    eventStatsMap.set(key, {
      event_id: key,
      event_name: eventRows[0]?.event_name || '',
      category: eventRows[0]?.category || '',
      result_count: eventRows.length,
      ranking_count: rankingCount,
      average_score: averageScore,
      best_score: bestScore
    });
  });

  const list = rows.map((row) => ({
    ...row,
    score: toFiniteNumber(row.score),
    class_rank: classRankMap.get(Number(row.id)) || 0,
    event_avg_score: eventStatsMap.get(Number(row.event_id))?.average_score ?? null
  }));
  const eventStats = Array.from(eventStatsMap.values());
  const scoreRows = list
    .map((item) => item.score)
    .filter((item) => item !== null);
  const resultSummary = {
    total_results: list.length,
    student_count: new Set(list.map((item) => Number(item.user_id))).size,
    event_count: eventStats.length,
    average_score: scoreRows.length ? roundTo(scoreRows.reduce((sum, item) => sum + item, 0) / scoreRows.length) : null,
    ranking_count: list.filter((item) => Number(item.rank) > 0).length,
    published_count: list.filter((item) => Number(item.is_published) === 1).length
  };

  return {
    list,
    filters: {
      event_id: eventId ? String(eventId) : '',
      student_keyword: studentKeyword,
      match_mode: matchMode
    },
    events,
    event_stats: eventStats,
    summary: resultSummary
  };
}

function buildHomeroomOverviewWorkbook(payload, profile) {
  const workbook = XLSX.utils.book_new();
  const detailRows = payload.list.map((item) => ({
    学生姓名: item.user_name || '',
    学号: item.student_id || '',
    年级: item.grade || '',
    班级: item.class_name || '',
    项目: item.event_name || '',
    轮次: item.round_name || '',
    成绩: item.performance || '',
    分数: item.score ?? '',
    班内排名: item.class_rank || '',
    项目排名: item.rank || '',
    项目平均分: item.event_avg_score ?? '',
    奖项: item.award || '',
    发布状态: Number(item.is_published) === 1 ? '已发布' : '未发布',
    更新时间: item.updated_at || ''
  }));
  const statRows = payload.event_stats.map((item) => ({
    项目: item.event_name || '',
    类别: item.category || '',
    成绩人数: item.result_count || 0,
    有排名人数: item.ranking_count || 0,
    平均分: item.average_score ?? '',
    最高分: item.best_score ?? ''
  }));
  const summaryRows = [
    { 指标: '负责年级', 数值: profile?.managed_grade || '' },
    { 指标: '负责班级', 数值: profile?.managed_class_name || '' },
    { 指标: '成绩条数', 数值: payload.summary?.total_results || 0 },
    { 指标: '涉及学生', 数值: payload.summary?.student_count || 0 },
    { 指标: '涉及项目', 数值: payload.summary?.event_count || 0 },
    { 指标: '平均分', 数值: payload.summary?.average_score ?? '' },
    { 指标: '有排名成绩', 数值: payload.summary?.ranking_count || 0 },
    { 指标: '已发布成绩', 数值: payload.summary?.published_count || 0 }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), '总览摘要');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(statRows), '项目统计');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), '成绩明细');
  return workbook;
}

function processRegistrationReview(db, registration, reviewer, action, reason, isCancel) {
  if (isCancel) {
    if (registration.status !== 'cancelling') {
      throw new Error('该取消申请已处理');
    }
    if (action === 'approve') {
      db.prepare('DELETE FROM registrations WHERE id = ?').run(registration.id);
      createNotification(db, registration.user_id, {
        type: 'success',
        title: '取消报名已批准',
        content: `班主任已批准您取消「${registration.event_name}」报名`,
        target_url: '#/student?tab=registrations',
        action_label: '查看报名状态'
      });
    } else {
      db.prepare("UPDATE registrations SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?")
        .run(reviewer.id, registration.id);
      createNotification(db, registration.user_id, {
        type: 'warning',
        title: '取消报名已驳回',
        content: `班主任驳回了您取消「${registration.event_name}」报名的申请${reason ? '，原因：' + reason : ''}`,
        target_url: '#/student?tab=registrations',
        action_label: '查看报名状态'
      });
    }
    return action === 'approve' ? '已批准取消申请' : '已驳回取消申请';
  }

  if (registration.status !== 'pending') {
    throw new Error('该报名记录已处理');
  }
  if (action === 'approve') {
    db.prepare("UPDATE registrations SET status = 'approved', reject_reason = '', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?")
      .run(reviewer.id, registration.id);
    createNotification(db, registration.user_id, {
      type: 'success',
      title: '报名已通过',
      content: `班主任已通过您报名的「${registration.event_name}」`,
      target_url: '#/student?tab=registrations',
      action_label: '查看报名状态'
    });
  } else {
    db.prepare("UPDATE registrations SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?")
      .run(reason, reviewer.id, registration.id);
    createNotification(db, registration.user_id, {
      type: 'warning',
      title: '报名已驳回',
      content: `班主任驳回了您报名的「${registration.event_name}」${reason ? '，原因：' + reason : ''}`,
      target_url: '#/student?tab=registrations',
      action_label: '查看报名状态'
    });
  }
  return action === 'approve' ? '已通过报名' : '已驳回报名';
}

router.get('/me', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    if (!profile || !profile.staff_type) {
      return res.status(403).json({ success: false, error: '当前账号未配置教师身份' });
    }
    res.json({
      success: true,
      data: {
        ...profile,
        assigned_event_ids: parseAssignedEventIds(profile.assigned_event_ids)
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/homeroom/overview', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertHomeroomTeacher(profile);
    const scope = getManagedStudentWhere(profile);
    const students = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.student_id,
        u.grade,
        u.class_name,
        u.email,
        COUNT(DISTINCT r.id) AS registration_count,
        COUNT(DISTINCT CASE WHEN r.status = 'pending' THEN r.id END) AS pending_registration_count,
        COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.id END) AS approved_registration_count,
        COUNT(DISTINCT rs.id) AS result_count
      FROM users u
      LEFT JOIN registrations r ON r.user_id = u.id
      LEFT JOIN results rs ON rs.user_id = u.id
      WHERE u.role = 'student' AND ${scope.where}
      GROUP BY u.id
      ORDER BY u.grade, u.class_name, u.name
    `).all(...scope.params);
    const pendingRegistrations = db.prepare(`
      SELECT r.id, r.status, r.created_at, u.id AS user_id, u.name AS user_name, u.student_id, u.grade, u.class_name,
        e.id AS event_id, e.name AS event_name, e.category
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      JOIN events e ON e.id = r.event_id
      WHERE r.status = 'pending' AND ${scope.where}
      ORDER BY r.created_at DESC
    `).all(...scope.params);
    const classSummary = {
      student_count: students.length,
      pending_registration_count: pendingRegistrations.length,
      approved_registration_count: students.reduce((sum, item) => sum + Number(item.approved_registration_count || 0), 0),
      result_count: students.reduce((sum, item) => sum + Number(item.result_count || 0), 0)
    };
    const resultOverview = listHomeroomOverviewResults(db, profile, req.query);
    res.json({
      success: true,
      data: {
        profile,
        summary: classSummary,
        students,
        pending_registrations: pendingRegistrations,
        result_rows: resultOverview.list,
        result_filters: resultOverview.filters,
        result_events: resultOverview.events,
        result_event_stats: resultOverview.event_stats,
        result_summary: resultOverview.summary
      }
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/homeroom/overview/export', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertHomeroomTeacher(profile);
    const resultOverview = listHomeroomOverviewResults(db, profile, req.query);
    const workbook = buildHomeroomOverviewWorkbook(resultOverview, profile);
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=\"homeroom-overview-${stamp}.xlsx\"`);
    res.send(buffer);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/homeroom/registrations', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertHomeroomTeacher(profile);
    res.json({ success: true, data: listHomeroomRegistrations(db, profile, req.query) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.put('/registrations/:id/review', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertHomeroomTeacher(profile);
    const action = normalizeRegistrationReviewAction(req.body.action);
    const reason = String(req.body.reason || '').trim().slice(0, 200);
    const scope = getManagedStudentWhere(profile);
    const registration = db.prepare(`
      SELECT r.*, u.name AS user_name, u.grade, u.class_name, e.name AS event_name
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      JOIN events e ON e.id = r.event_id
      WHERE r.id = ? AND ${scope.where}
    `).get(req.params.id, ...scope.params);
    if (!registration) return res.status(404).json({ success: false, error: '报名记录不存在或不属于当前班级' });
    const message = processRegistrationReview(db, registration, req.user, action, reason, false);
    logOperation(req.user.id, req.user.username, action === 'approve' ? '班主任通过报名' : '班主任驳回报名', `报名ID:${req.params.id}`, getIp(req));
    res.json({ success: true, message });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.put('/registrations/:id/cancel-review', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertHomeroomTeacher(profile);
    const action = normalizeRegistrationReviewAction(req.body.action);
    const reason = String(req.body.reason || '').trim().slice(0, 200);
    const scope = getManagedStudentWhere(profile);
    const registration = db.prepare(`
      SELECT r.*, u.name AS user_name, u.grade, u.class_name, e.name AS event_name
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      JOIN events e ON e.id = r.event_id
      WHERE r.id = ? AND r.status = 'cancelling' AND ${scope.where}
    `).get(req.params.id, ...scope.params);
    if (!registration) return res.status(404).json({ success: false, error: '取消申请不存在或不属于当前班级' });
    const message = processRegistrationReview(db, registration, req.user, action, reason, true);
    logOperation(req.user.id, req.user.username, action === 'approve' ? '班主任批准取消报名' : '班主任驳回取消报名', `报名ID:${req.params.id}`, getIp(req));
    res.json({ success: true, message });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/registrations/batch-review', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertHomeroomTeacher(profile);
    const action = normalizeRegistrationReviewAction(req.body.action);
    const reviewType = String(req.body.review_type || 'registration').trim() === 'cancel' ? 'cancel' : 'registration';
    const reason = String(req.body.reason || '').trim().slice(0, 200);
    const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : [])
      .map((item) => parseInt(item, 10))
      .filter((item) => Number.isInteger(item) && item > 0))];
    if (!ids.length) {
      return res.status(400).json({ success: false, error: '请先选择需要处理的报名记录' });
    }
    const scope = getManagedStudentWhere(profile);
    const placeholders = ids.map(() => '?').join(',');
    const params = [...ids, ...scope.params];
    let sql = `
      SELECT r.*, u.name AS user_name, u.grade, u.class_name, e.name AS event_name
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      JOIN events e ON e.id = r.event_id
      WHERE r.id IN (${placeholders}) AND ${scope.where}
    `;
    sql += reviewType === 'cancel'
      ? " AND r.status = 'cancelling'"
      : " AND r.status = 'pending'";
    const rows = db.prepare(sql).all(...params);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: '未找到可处理的班级报名记录' });
    }
    let processed = 0;
    const tx = db.transaction((records) => {
      records.forEach((record) => {
        processRegistrationReview(db, record, req.user, action, reason, reviewType === 'cancel');
        processed++;
      });
    });
    tx(rows);
    logOperation(
      req.user.id,
      req.user.username,
      reviewType === 'cancel'
        ? (action === 'approve' ? '班主任批量批准取消报名' : '班主任批量驳回取消报名')
        : (action === 'approve' ? '班主任批量通过报名' : '班主任批量驳回报名'),
      `批量处理${processed}条记录`,
      getIp(req)
    );
    res.json({
      success: true,
      message: action === 'approve'
        ? `已批量处理${processed}条记录`
        : `已批量驳回${processed}条记录`,
      data: { processed }
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/event/assignments', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertEventTeacher(profile);
    const eventIds = parseAssignedEventIds(profile.assigned_event_ids);
    if (!eventIds.length) {
      return res.json({ success: true, data: { profile, events: [] } });
    }
    const placeholders = eventIds.map(() => '?').join(',');
    const events = db.prepare(`
      SELECT e.id, e.name, e.category, e.gender_group, e.event_type, e.venue,
        COUNT(DISTINCT s.id) AS schedule_count,
        COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.user_id END) AS participant_count
      FROM events e
      LEFT JOIN schedules s ON s.event_id = e.id
      LEFT JOIN registrations r ON r.event_id = e.id
      WHERE e.id IN (${placeholders})
      GROUP BY e.id
      ORDER BY e.sort_order, e.id
    `).all(...eventIds);
    res.json({ success: true, data: { profile, events } });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/event/results-entry', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertEventTeacher(profile);
    const eventIds = parseAssignedEventIds(profile.assigned_event_ids);
    const eventId = parseInt(req.query.event_id, 10);
    if (!eventId || !eventIds.includes(eventId)) {
      return res.status(400).json({ success: false, error: '当前教师未分配该项目' });
    }
    const event = db.prepare(`
      SELECT id, name, category, gender_group, event_type, venue
      FROM events
      WHERE id = ?
      LIMIT 1
    `).get(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    const schedules = db.prepare(`
      SELECT s.id, s.round_name, s.start_time, s.end_time, s.venue, s.status, e.name AS event_name
      FROM schedules s
      JOIN events e ON e.id = s.event_id
      WHERE s.event_id = ?
      ORDER BY s.start_time, s.id
    `).all(eventId);
    const participants = db.prepare(`
      SELECT
        r.id AS registration_id,
        s.id AS schedule_id,
        s.round_name,
        u.id AS user_id,
        u.name AS student_name,
        u.student_id,
        u.grade,
        u.class_name,
        COALESCE(rs.id, 0) AS result_id,
        COALESCE(rs.performance, '') AS performance,
        COALESCE(rs.rank, 0) AS rank,
        COALESCE(rs.award, '') AS award,
        COALESCE(rs.note, '') AS note,
        COALESCE(rs.is_published, 0) AS is_published
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      JOIN schedules s ON s.event_id = r.event_id
      LEFT JOIN results rs ON rs.schedule_id = s.id AND rs.user_id = u.id
      WHERE r.event_id = ? AND r.status = 'approved'
      ORDER BY s.start_time, s.id, CASE WHEN COALESCE(rs.rank, 0) > 0 THEN COALESCE(rs.rank, 0) ELSE 999999 END, u.grade, u.class_name, u.name
    `).all(eventId);
    const summary = db.prepare(`
      SELECT
        COUNT(DISTINCT s.id) AS schedule_count,
        COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.user_id END) AS approved_participant_count,
        COUNT(DISTINCT rs.id) AS result_count,
        COUNT(DISTINCT CASE WHEN COALESCE(rs.is_published, 0) = 1 THEN rs.id END) AS published_result_count
      FROM events e
      LEFT JOIN schedules s ON s.event_id = e.id
      LEFT JOIN registrations r ON r.event_id = e.id
      LEFT JOIN results rs ON rs.schedule_id = s.id
      WHERE e.id = ?
      GROUP BY e.id
      LIMIT 1
    `).get(eventId) || {};
    const classes = [...new Set(participants
      .map((item) => [item.grade, item.class_name].filter(Boolean).join(' '))
      .filter(Boolean))];
    const rounds = [...new Set(participants
      .map((item) => String(item.round_name || '').trim())
      .filter(Boolean))];
    const blockers = [];
    if (!schedules.length) blockers.push('尚未编排赛程');
    if (schedules.length && !participants.length) blockers.push('暂无已审核参赛学生');
    res.json({
      success: true,
      data: {
        event_id: eventId,
        event,
        schedules,
        participants,
        classes,
        rounds,
        result_meta: buildEventResultMeta(event),
        summary: {
          schedule_count: Number(summary.schedule_count || schedules.length || 0),
          approved_participant_count: Number(summary.approved_participant_count || 0),
          result_count: Number(summary.result_count || 0),
          published_result_count: Number(summary.published_result_count || 0),
          class_count: classes.length
        },
        readiness: {
          can_edit: schedules.length > 0 && participants.length > 0,
          blockers
        }
      }
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/event/results/batch-save', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertEventTeacher(profile);
    const eventIds = parseAssignedEventIds(profile.assigned_event_ids);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ success: false, error: '请提供要保存的成绩数据' });
    }
    let saved = 0;
    const affectedScheduleIds = new Set();
    const saveOne = db.transaction((rows) => {
      rows.forEach((row) => {
        const scheduleId = parseInt(row.schedule_id, 10);
        const userId = parseInt(row.user_id, 10);
        if (!scheduleId || !userId) return;
        const schedule = db.prepare('SELECT id, event_id FROM schedules WHERE id = ?').get(scheduleId);
        if (!schedule || !eventIds.includes(schedule.event_id)) return;
        const existing = db.prepare('SELECT id FROM results WHERE schedule_id = ? AND user_id = ? ORDER BY id LIMIT 1').get(scheduleId, userId);
        const performance = String(row.performance || '').trim().slice(0, 20);
        const award = String(row.award || '').trim().slice(0, 20);
        const note = String(row.note || '').trim().slice(0, 200);
        const isPublished = row.is_published ? 1 : 0;
        if (existing) {
          db.prepare(`
            UPDATE results
            SET performance = ?, award = ?, note = ?, is_published = ?, recorded_by = ?, updated_at = datetime('now','localtime')
            WHERE id = ?
          `).run(performance, award, note, isPublished, req.user.id, existing.id);
        } else {
          db.prepare(`
            INSERT INTO results (schedule_id, user_id, performance, award, note, is_published, recorded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(scheduleId, userId, performance, award, note, isPublished, req.user.id);
        }
        affectedScheduleIds.add(scheduleId);
        saved++;
      });
    });
    saveOne(items);
    const ranking = autoRankSchedules(db, [...affectedScheduleIds]);
    const firstSchedule = [...affectedScheduleIds][0];
    const firstEvent = firstSchedule
      ? db.prepare(`
          SELECT e.name, e.category, e.event_type, e.gender_group
          FROM schedules s
          JOIN events e ON e.id = s.event_id
          WHERE s.id = ?
          LIMIT 1
        `).get(firstSchedule)
      : null;
    logOperation(req.user.id, req.user.username, '教师批量保存成绩', `保存${saved}条成绩`, getIp(req));
    res.json({
      success: true,
      message: `已保存${saved}条成绩，并按成绩自动排序`,
      data: {
        ranked_count: ranking.ranked_count || 0,
        affected_schedule_count: affectedScheduleIds.size,
        result_meta: buildEventResultMeta(firstEvent || {})
      }
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
