const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authMiddleware, teacherOnly, logOperation } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');
const { resolveAccessProfile } = require('../utils/accessControl');

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
    res.json({
      success: true,
      data: {
        profile,
        summary: classSummary,
        students,
        pending_registrations: pendingRegistrations
      }
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/homeroom/registrations', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertHomeroomTeacher(profile);
    const scope = getManagedStudentWhere(profile);
    const status = String(req.query.status || '').trim();
    const params = [...scope.params];
    let sql = `
      SELECT r.id, r.status, r.reject_reason, r.created_at, r.reviewed_at,
        u.id AS user_id, u.name AS user_name, u.student_id, u.grade, u.class_name,
        e.id AS event_id, e.name AS event_name, e.category
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      JOIN events e ON e.id = r.event_id
      WHERE ${scope.where}
    `;
    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY CASE r.status WHEN \'pending\' THEN 0 WHEN \'cancelling\' THEN 1 ELSE 2 END, r.created_at DESC';
    res.json({ success: true, data: db.prepare(sql).all(...params) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.put('/registrations/:id/review', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertHomeroomTeacher(profile);
    const action = String(req.body.action || '').trim();
    const reason = String(req.body.reason || '').trim().slice(0, 200);
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: '无效的审核操作' });
    }
    const scope = getManagedStudentWhere(profile);
    const registration = db.prepare(`
      SELECT r.*, u.name AS user_name, u.grade, u.class_name, e.name AS event_name
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      JOIN events e ON e.id = r.event_id
      WHERE r.id = ? AND ${scope.where}
    `).get(req.params.id, ...scope.params);
    if (!registration) return res.status(404).json({ success: false, error: '报名记录不存在或不属于当前班级' });
    if (registration.status !== 'pending') {
      return res.status(400).json({ success: false, error: '该报名记录已处理' });
    }
    if (action === 'approve') {
      db.prepare("UPDATE registrations SET status = 'approved', reject_reason = '', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?")
        .run(req.user.id, req.params.id);
      createNotification(db, registration.user_id, {
        type: 'success',
        title: '报名已通过',
        content: `班主任已通过您报名的「${registration.event_name}」`,
        target_url: '#/student'
      });
    } else {
      db.prepare("UPDATE registrations SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?")
        .run(reason, req.user.id, req.params.id);
      createNotification(db, registration.user_id, {
        type: 'warning',
        title: '报名已驳回',
        content: `班主任驳回了您报名的「${registration.event_name}」${reason ? '，原因：' + reason : ''}`,
        target_url: '#/student'
      });
    }
    logOperation(req.user.id, req.user.username, action === 'approve' ? '班主任通过报名' : '班主任驳回报名', `报名ID:${req.params.id}`, getIp(req));
    res.json({ success: true, message: action === 'approve' ? '已通过报名' : '已驳回报名' });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.put('/registrations/:id/cancel-review', (req, res) => {
  try {
    const db = getDb();
    const profile = getTeacherProfile(db, req.user.id);
    assertHomeroomTeacher(profile);
    const action = String(req.body.action || '').trim();
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: '无效的审核操作' });
    }
    const scope = getManagedStudentWhere(profile);
    const registration = db.prepare(`
      SELECT r.*, u.name AS user_name, u.grade, u.class_name, e.name AS event_name
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      JOIN events e ON e.id = r.event_id
      WHERE r.id = ? AND r.status = 'cancelling' AND ${scope.where}
    `).get(req.params.id, ...scope.params);
    if (!registration) return res.status(404).json({ success: false, error: '取消申请不存在或不属于当前班级' });
    if (action === 'approve') {
      db.prepare('DELETE FROM registrations WHERE id = ?').run(req.params.id);
      createNotification(db, registration.user_id, {
        type: 'success',
        title: '取消报名已批准',
        content: `班主任已批准您取消「${registration.event_name}」报名`,
        target_url: '#/student'
      });
    } else {
      db.prepare("UPDATE registrations SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?")
        .run(req.user.id, req.params.id);
      createNotification(db, registration.user_id, {
        type: 'warning',
        title: '取消报名已驳回',
        content: `班主任驳回了您取消「${registration.event_name}」报名的申请`,
        target_url: '#/student'
      });
    }
    logOperation(req.user.id, req.user.username, action === 'approve' ? '班主任批准取消报名' : '班主任驳回取消报名', `报名ID:${req.params.id}`, getIp(req));
    res.json({ success: true, message: action === 'approve' ? '已批准取消申请' : '已驳回取消申请' });
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
      ORDER BY s.start_time, s.id, u.grade, u.class_name, u.name
    `).all(eventId);
    res.json({ success: true, data: { event_id: eventId, schedules, participants } });
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
    const saveOne = db.transaction((rows) => {
      rows.forEach((row) => {
        const scheduleId = parseInt(row.schedule_id, 10);
        const userId = parseInt(row.user_id, 10);
        if (!scheduleId || !userId) return;
        const schedule = db.prepare('SELECT id, event_id FROM schedules WHERE id = ?').get(scheduleId);
        if (!schedule || !eventIds.includes(schedule.event_id)) return;
        const existing = db.prepare('SELECT id FROM results WHERE schedule_id = ? AND user_id = ? ORDER BY id LIMIT 1').get(scheduleId, userId);
        const performance = String(row.performance || '').trim().slice(0, 20);
        const rank = Math.max(0, parseInt(row.rank, 10) || 0);
        const award = String(row.award || '').trim().slice(0, 20);
        const note = String(row.note || '').trim().slice(0, 200);
        const isPublished = row.is_published ? 1 : 0;
        if (existing) {
          db.prepare(`
            UPDATE results
            SET performance = ?, rank = ?, award = ?, note = ?, is_published = ?, recorded_by = ?, updated_at = datetime('now','localtime')
            WHERE id = ?
          `).run(performance, rank, award, note, isPublished, req.user.id, existing.id);
        } else {
          db.prepare(`
            INSERT INTO results (schedule_id, user_id, performance, rank, award, note, is_published, recorded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(scheduleId, userId, performance, rank, award, note, isPublished, req.user.id);
        }
        saved++;
      });
    });
    saveOne(items);
    logOperation(req.user.id, req.user.username, '教师批量保存成绩', `保存${saved}条成绩`, getIp(req));
    res.json({ success: true, message: `已保存${saved}条成绩` });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
