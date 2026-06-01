const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/init');
const { authMiddleware } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');

router.use(authMiddleware);

const DEFAULT_FRIEND_GROUP = '同学';

function normalizeFriendGroup(value) {
  const groupName = String(value || '').trim();
  return groupName ? groupName.slice(0, 20) : DEFAULT_FRIEND_GROUP;
}

function normalizeFriendRemark(value) {
  return String(value || '').trim().slice(0, 80);
}

function getFriendData(db, userId) {
  const friends = db.prepare(`
    SELECT
      f.friend_id,
      f.group_name,
      f.created_at,
      u.name,
      u.username,
      u.student_id,
      u.class_name,
      u.grade,
      u.avatar,
      u.role,
      COALESCE(ev.event_names, '') AS event_names
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    LEFT JOIN (
      SELECT r.user_id, GROUP_CONCAT(e.name, ' / ') AS event_names
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.status != 'rejected'
      GROUP BY r.user_id
    ) ev ON ev.user_id = u.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC, f.id DESC
  `).all(userId);

  const incoming = db.prepare(`
    SELECT
      fr.id,
      fr.requester_id,
      fr.receiver_id,
      fr.remark,
      fr.friend_group,
      fr.status,
      fr.created_at,
      fr.handled_at,
      u.name,
      u.username,
      u.student_id,
      u.class_name,
      u.grade,
      u.avatar,
      u.role
    FROM friend_requests fr
    JOIN users u ON u.id = fr.requester_id
    WHERE fr.receiver_id = ?
    ORDER BY CASE fr.status WHEN 'pending' THEN 0 ELSE 1 END, fr.created_at DESC, fr.id DESC
  `).all(userId);

  const outgoing = db.prepare(`
    SELECT
      fr.id,
      fr.requester_id,
      fr.receiver_id,
      fr.remark,
      fr.friend_group,
      fr.status,
      fr.created_at,
      fr.handled_at,
      u.name,
      u.username,
      u.student_id,
      u.class_name,
      u.grade,
      u.avatar,
      u.role
    FROM friend_requests fr
    JOIN users u ON u.id = fr.receiver_id
    WHERE fr.requester_id = ?
    ORDER BY CASE fr.status WHEN 'pending' THEN 0 ELSE 1 END, fr.created_at DESC, fr.id DESC
  `).all(userId);

  return {
    friends,
    incoming,
    outgoing,
    friend_ids: friends.map(item => Number(item.friend_id)),
    pending_received_ids: incoming.filter(item => item.status === 'pending').map(item => Number(item.requester_id)),
    pending_sent_ids: outgoing.filter(item => item.status === 'pending').map(item => Number(item.receiver_id)),
    groups: [...new Set(friends.map(item => item.group_name || DEFAULT_FRIEND_GROUP).filter(Boolean))]
  };
}

// ==================== 个人中心 ====================

// GET /profile - 获取个人资料
router.get('/profile', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(
      'SELECT id, name, student_id, class_name, grade, email, avatar, created_at FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ success: true, data: user });
  } catch (e) {
    console.error('获取个人资料失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /profile/password - 修改密码
router.put('/profile/password', (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请提供旧密码和新密码' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度不能少于6位' });
    }

    const db = getDb();
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(400).json({ error: '旧密码不正确' });
    }

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, updated_at = datetime("now","localtime") WHERE id = ?')
      .run(hashed, req.user.id);

    res.json({ success: true, data: { message: '密码修改成功' } });
  } catch (e) {
    console.error('修改密码失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ==================== 好友系统 ====================

// GET /friends - 获取好友列表、申请箱与状态摘要
router.get('/friends', (req, res) => {
  try {
    const db = getDb();
    const data = getFriendData(db, req.user.id);
    res.json({
      success: true,
      data: {
        ...data,
        summary: {
          friends: data.friends.length,
          incoming_pending: data.pending_received_ids.length,
          outgoing_pending: data.pending_sent_ids.length
        }
      }
    });
  } catch (e) {
    console.error('获取好友资料失败:', e.message);
    res.status(500).json({ success: false, error: '获取好友资料失败' });
  }
});

// POST /friends/requests - 发起好友申请
router.post('/friends/requests', (req, res) => {
  try {
    const db = getDb();
    const targetUserId = parseInt(req.body.target_user_id, 10);
    const remark = normalizeFriendRemark(req.body.remark);
    const friendGroup = normalizeFriendGroup(req.body.friend_group);

    if (!targetUserId) {
      return res.status(400).json({ success: false, error: '请选择要添加的好友' });
    }
    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, error: '不能添加自己为好友' });
    }

    const targetUser = db.prepare(`
      SELECT id, name, status FROM users WHERE id = ? AND status = 'active'
    `).get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: '目标用户不存在或已停用' });
    }

    const existingFriend = db.prepare(`
      SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?
    `).get(req.user.id, targetUserId);
    if (existingFriend) {
      return res.status(400).json({ success: false, error: '你们已经是好友了' });
    }

    const pendingEither = db.prepare(`
      SELECT id, requester_id, receiver_id
      FROM friend_requests
      WHERE status = 'pending'
        AND (
          (requester_id = ? AND receiver_id = ?)
          OR
          (requester_id = ? AND receiver_id = ?)
        )
      ORDER BY id DESC
      LIMIT 1
    `).get(req.user.id, targetUserId, targetUserId, req.user.id);
    if (pendingEither) {
      const msg = pendingEither.requester_id === req.user.id ? '好友申请已发送，请等待对方处理' : '对方已向你发送好友申请，请到好友中心处理';
      return res.status(400).json({ success: false, error: msg });
    }

    const inserted = db.prepare(`
      INSERT INTO friend_requests (requester_id, receiver_id, remark, friend_group, status, updated_at)
      VALUES (?, ?, ?, ?, 'pending', datetime('now','localtime'))
    `).run(req.user.id, targetUserId, remark, friendGroup);

    createNotification(db, targetUserId, {
      type: 'info',
      title: '新的好友申请',
      content: `${req.user.name || req.user.username || '有同学'} 向你发送了好友申请`,
      target_url: '#/student/friends'
    });

    res.json({
      success: true,
      message: '好友申请已发送',
      data: {
        request_id: inserted.lastInsertRowid,
        target_user_id: targetUserId,
        friend_group: friendGroup,
        remark
      }
    });
  } catch (e) {
    console.error('发送好友申请失败:', e.message);
    res.status(500).json({ success: false, error: '发送好友申请失败' });
  }
});

// PUT /friends/requests/:id/respond - 同意或拒绝好友申请
router.put('/friends/requests/:id/respond', (req, res) => {
  try {
    const db = getDb();
    const requestId = parseInt(req.params.id, 10);
    const action = String(req.body.action || '').trim();

    if (!requestId || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: '请求参数无效' });
    }

    const requestRow = db.prepare(`
      SELECT fr.*, u.name AS requester_name
      FROM friend_requests fr
      JOIN users u ON u.id = fr.requester_id
      WHERE fr.id = ? AND fr.receiver_id = ?
    `).get(requestId, req.user.id);

    if (!requestRow) {
      return res.status(404).json({ success: false, error: '好友申请不存在' });
    }
    if (requestRow.status !== 'pending') {
      return res.status(400).json({ success: false, error: '该好友申请已处理，请刷新列表' });
    }

    const handleRequest = db.transaction(() => {
      if (action === 'accept') {
        db.prepare(`
          INSERT OR IGNORE INTO friendships (user_id, friend_id, group_name, source_request_id, updated_at)
          VALUES (?, ?, ?, ?, datetime('now','localtime'))
        `).run(req.user.id, requestRow.requester_id, normalizeFriendGroup(requestRow.friend_group), requestId);
        db.prepare(`
          INSERT OR IGNORE INTO friendships (user_id, friend_id, group_name, source_request_id, updated_at)
          VALUES (?, ?, ?, ?, datetime('now','localtime'))
        `).run(requestRow.requester_id, req.user.id, DEFAULT_FRIEND_GROUP, requestId);
      }

      db.prepare(`
        UPDATE friend_requests
        SET status = ?, handled_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(action === 'accept' ? 'accepted' : 'rejected', requestId);
    });

    handleRequest();

    createNotification(db, requestRow.requester_id, {
      type: action === 'accept' ? 'success' : 'warning',
      title: action === 'accept' ? '好友申请已通过' : '好友申请被拒绝',
      content: action === 'accept'
        ? `${req.user.name || req.user.username || '对方'} 已同意你的好友申请`
        : `${req.user.name || req.user.username || '对方'} 暂未通过你的好友申请`,
      target_url: '#/student/friends'
    });

    res.json({
      success: true,
      message: action === 'accept' ? '已添加为好友' : '已拒绝好友申请'
    });
  } catch (e) {
    console.error('处理好友申请失败:', e.message);
    res.status(500).json({ success: false, error: '处理好友申请失败' });
  }
});

// ==================== 在线报名 ====================

// GET /events - 获取可报名项目
router.get('/events', (req, res) => {
  try {
    const db = getDb();
    const meet = db.prepare('SELECT registration_open FROM meet_info LIMIT 1').get();
    const registrationOpen = meet ? !!meet.registration_open : true;

    const maxRule = db.prepare(
      "SELECT rule_value as value FROM registration_rules WHERE rule_key = 'max_events_per_student'"
    ).get();
    const maxEventsPerStudent = parseInt(maxRule?.value || '3', 10);

    const myCount = db.prepare(
      "SELECT COUNT(*) as cnt FROM registrations WHERE user_id = ? AND status != 'rejected'"
    ).get(req.user.id);

    const user = db.prepare('SELECT gender FROM users WHERE id = ?').get(req.user.id);
    const userGender = user?.gender || '';

    const events = db.prepare(`
      SELECT e.*,
        COUNT(r.id) as registered_count,
        CASE WHEN e.max_participants > 0
          THEN MAX(0, e.max_participants - COUNT(r.id))
          ELSE -1 END as remaining
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id AND r.status != 'rejected'
      WHERE e.status = 'active'
        AND (e.gender_group = 'mixed' OR e.gender_group = ?)
      GROUP BY e.id
      ORDER BY e.sort_order, e.id
    `).all(userGender);

    res.json({
      success: true,
      data: events,
      meta: {
        registration_open: registrationOpen,
        max_events_per_student: maxEventsPerStudent,
        my_registration_count: myCount.cnt
      }
    });
  } catch (e) {
    console.error('获取项目列表失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /registrations - 提交报名
router.post('/registrations', (req, res) => {
  try {
    const { event_id } = req.body;

    if (!event_id) {
      return res.status(400).json({ success: false, error: '请选择报名项目' });
    }

    const db = getDb();

    const meet = db.prepare('SELECT registration_open FROM meet_info LIMIT 1').get();
    if (meet && !meet.registration_open) {
      return res.status(400).json({ success: false, error: '报名通道已关闭，请留意学校公告' });
    }

    const event = db.prepare('SELECT * FROM events WHERE id = ? AND status = ?').get(event_id, 'active');
    if (!event) {
      return res.status(404).json({ success: false, error: '项目不存在或已关闭' });
    }

    // 性别检查
    const user = db.prepare('SELECT gender FROM users WHERE id = ?').get(req.user.id);
    if (event.gender_group !== 'mixed' && user?.gender && event.gender_group !== user.gender) {
      return res.status(400).json({ success: false, error: '该项目性别组别与您不符，请选择匹配的项目' });
    }

    const existing = db.prepare(
      'SELECT id FROM registrations WHERE user_id = ? AND event_id = ?'
    ).get(req.user.id, event_id);
    if (existing) {
      return res.status(400).json({ success: false, error: '您已报名该项目，请勿重复报名' });
    }

    const maxEventsSetting = db.prepare(
      "SELECT rule_value as value FROM registration_rules WHERE rule_key = 'max_events_per_student'"
    ).get();
    const maxEventsPerStudent = parseInt(maxEventsSetting?.value || '3', 10);

    const currentCount = db.prepare(
      "SELECT COUNT(*) as cnt FROM registrations WHERE user_id = ? AND status != 'rejected'"
    ).get(req.user.id);
    if (currentCount.cnt >= maxEventsPerStudent) {
      return res.status(400).json({ success: false, error: `每位学生最多可报${maxEventsPerStudent}个项目` });
    }

    if (event.max_participants > 0) {
      const registeredCount = db.prepare(
        "SELECT COUNT(*) as cnt FROM registrations WHERE event_id = ? AND status != 'rejected'"
      ).get(event_id);
      if (registeredCount.cnt >= event.max_participants) {
        return res.status(400).json({ success: false, error: '该项目名额已满' });
      }
    }

    db.prepare(
      'INSERT INTO registrations (user_id, event_id, status) VALUES (?, ?, ?)'
    ).run(req.user.id, event_id, 'pending');

    createNotification(db, req.user.id, {
      type: 'info',
      title: '报名已提交',
      content: `您已报名「${event.name}」，请等待管理员审核。`,
      target_url: '#/student'
    });

    res.json({ success: true, message: '报名成功，等待审核' });
  } catch (e) {
    console.error('提交报名失败:', e.message);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// GET /registrations - 查看个人报名记录
router.get('/registrations', (req, res) => {
  try {
    const db = getDb();
    const registrations = db.prepare(`
      SELECT r.*, e.name as event_name, e.category, e.event_type,
        e.gender_group, e.venue, e.max_participants
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(req.user.id);

    res.json({ success: true, data: registrations });
  } catch (e) {
    console.error('获取报名记录失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /registrations/:id - 取消报名
router.delete('/registrations/:id', (req, res) => {
  try {
    const db = getDb();

    const registration = db.prepare(
      'SELECT * FROM registrations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!registration) {
      return res.status(404).json({ success: false, error: '报名记录不存在' });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({ success: false, error: '仅待审核状态的报名可以取消' });
    }

    db.prepare('DELETE FROM registrations WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: '已取消报名' });
  } catch (e) {
    console.error('取消报名失败:', e.message);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// ==================== 赛事查看 ====================

// GET /my-schedules - 查看个人参赛赛程
router.get('/my-schedules', (req, res) => {
  try {
    const db = getDb();
    const schedules = db.prepare(`
      SELECT s.*, e.name as event_name, e.category, e.event_type,
        e.venue as event_venue, e.gender_group
      FROM schedules s
      JOIN events e ON s.event_id = e.id
      JOIN registrations r ON r.event_id = e.id AND r.user_id = ?
      WHERE r.status = 'approved' AND s.status = 'published'
      ORDER BY s.start_time, e.sort_order
    `).all(req.user.id);

    res.json({ success: true, data: schedules });
  } catch (e) {
    console.error('获取个人赛程失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /schedules - 查看全校完整赛程
router.get('/schedules', (req, res) => {
  try {
    const db = getDb();
    const schedules = db.prepare(`
      SELECT s.*, e.name as event_name, e.category, e.event_type,
        e.gender_group, e.venue as event_venue
      FROM schedules s
      JOIN events e ON s.event_id = e.id
      WHERE s.status = 'published'
      ORDER BY s.start_time, e.sort_order
    `).all();

    res.json({ success: true, data: schedules });
  } catch (e) {
    console.error('获取赛程失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ==================== 成绩查询 ====================

// GET /my-results - 查看个人成绩
router.get('/my-results', (req, res) => {
  try {
    const db = getDb();
    const results = db.prepare(`
      SELECT res.*, s.round_name, s.start_time, s.venue as schedule_venue,
        e.name as event_name, e.category, e.event_type
      FROM results res
      JOIN schedules s ON res.schedule_id = s.id
      JOIN events e ON s.event_id = e.id
      WHERE res.user_id = ? AND res.is_published = 1
      ORDER BY res.created_at DESC
    `).all(req.user.id);

    res.json({ success: true, data: results });
  } catch (e) {
    console.error('获取个人成绩失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /results/class - 查看班级成绩排名
router.get('/results/class', (req, res) => {
  try {
    const db = getDb();
    const rankings = db.prepare(`
      SELECT u.class_name, u.grade,
        COUNT(res.id) as result_count,
        COALESCE(SUM(res.score), 0) as total_score,
        COUNT(DISTINCT u.id) as student_count
      FROM results res
      JOIN users u ON res.user_id = u.id
      WHERE res.is_published = 1
      GROUP BY u.class_name
      ORDER BY total_score DESC, u.class_name
    `).all();

    res.json({ success: true, data: rankings });
  } catch (e) {
    console.error('获取班级排名失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /results/grade - 查看年级成绩排名
router.get('/results/grade', (req, res) => {
  try {
    const db = getDb();
    const rankings = db.prepare(`
      SELECT u.grade,
        COUNT(res.id) as result_count,
        COALESCE(SUM(res.score), 0) as total_score,
        COUNT(DISTINCT u.id) as student_count,
        COUNT(DISTINCT u.class_name) as class_count
      FROM results res
      JOIN users u ON res.user_id = u.id
      WHERE res.is_published = 1
      GROUP BY u.grade
      ORDER BY total_score DESC, u.grade
    `).all();

    res.json({ success: true, data: rankings });
  } catch (e) {
    console.error('获取年级排名失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ==================== 公告 ====================

// GET /announcements - 查看全校公告
router.get('/announcements', (req, res) => {
  try {
    const db = getDb();
    const announcements = db.prepare(`
      SELECT a.*, u.name as publisher_name,
        CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END as is_read
      FROM announcements a
      JOIN users u ON a.published_by = u.id
      LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
      WHERE a.status = 'published'
      ORDER BY a.is_pinned DESC, a.created_at DESC
    `).all(req.user.id);

    res.json({ success: true, data: announcements });
  } catch (e) {
    console.error('获取公告列表失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /announcements/:id - 查看公告详情
router.get('/announcements/:id', (req, res) => {
  try {
    const db = getDb();

    db.prepare('UPDATE announcements SET view_count = view_count + 1 WHERE id = ?')
      .run(req.params.id);

    const announcement = db.prepare(`
      SELECT a.*, u.name as publisher_name,
        CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END as is_read
      FROM announcements a
      JOIN users u ON a.published_by = u.id
      LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
      WHERE a.id = ?
    `).get(req.user.id, req.params.id);

    if (!announcement) {
      return res.status(404).json({ error: '公告不存在' });
    }

    res.json({ success: true, data: announcement });
  } catch (e) {
    console.error('获取公告详情失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /announcements/:id/read - 标记已读
router.put('/announcements/:id/read', (req, res) => {
  try {
    const db = getDb();

    const announcement = db.prepare(
      'SELECT id FROM announcements WHERE id = ? AND status = ?'
    ).get(req.params.id, 'published');

    if (!announcement) {
      return res.status(404).json({ error: '公告不存在' });
    }

    db.prepare(
      'INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id, read_at) VALUES (?, ?, datetime("now","localtime"))'
    ).run(req.params.id, req.user.id);

    res.json({ success: true, data: { message: '已标记为已读' } });
  } catch (e) {
    console.error('标记已读失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ==================== 站内通知 ====================

// GET /notifications
router.get('/notifications', (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 50;
    const notifications = db.prepare(`
      SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(req.user.id, limit);
    const unread = db.prepare(
      'SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.user.id);
    res.json({ success: true, data: { list: notifications, unread: unread.cnt } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /notifications/:id/read
router.put('/notifications/:id/read', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /notifications/read-all
router.put('/notifications/read-all', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0')
      .run(req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /notifications/:id
router.delete('/notifications/:id', (req, res) => {
  try {
    const db = getDb();
    const notification = db.prepare(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!notification) {
      return res.status(404).json({ success: false, error: '通知不存在' });
    }

    db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    res.json({ success: true, message: '通知已删除' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /profile/avatar - 更新头像
router.put('/profile/avatar', (req, res) => {
  try {
    const { avatar } = req.body;
    if (avatar === undefined || avatar === null) {
      return res.status(400).json({ success: false, error: '请提供头像资料' });
    }
    const db = getDb();
    try {
      db.prepare('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT \'\'').run();
    } catch (_) { /* column exists */ }
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(String(avatar), req.user.id);
    res.json({ success: true, message: avatar ? '头像已更新' : '头像已移除' });
  } catch (e) {
    console.error('更新头像失败:', e.message);
    res.status(500).json({ success: false, error: '更新头像失败' });
  }
});

// GET /upcoming-reminders - 获取即将到来的检录提醒（比赛前15分钟）
router.get('/upcoming-reminders', (req, res) => {
  try {
    const db = getDb();
    const reminders = db.prepare(`
      SELECT s.id as schedule_id, s.start_time, s.end_time,
             COALESCE(NULLIF(s.venue,''), e.venue) as venue,
             s.round_name, s.note,
             e.name as event_name, e.category, e.event_type,
             e.gender_group, e.id as event_id
      FROM schedules s
      JOIN events e ON s.event_id = e.id
      JOIN registrations r ON r.event_id = e.id AND r.user_id = ?
      WHERE r.status = 'approved'
        AND s.status = 'published'
        AND s.start_time > datetime('now','localtime')
        AND s.start_time <= datetime('now','localtime','+15 minutes')
      ORDER BY s.start_time ASC
    `).all(req.user.id);

    res.json({ success: true, data: reminders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
