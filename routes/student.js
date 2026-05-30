const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ==================== 个人中心 ====================

// GET /profile - 获取个人资料
router.get('/profile', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, studentId: true, className: true, grade: true, email: true, avatarUrl: true, createdAt: true }
    });

    if (!user) return res.status(404).json({ error: '用户不存在' });

    res.json({ success: true, data: user });
  } catch (e) {
    console.error('获取个人资料失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /profile/password - 修改密码
router.put('/profile/password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) return res.status(400).json({ error: '请提供旧密码和新密码' });
    if (newPassword.length < 6) return res.status(400).json({ error: '新密码长度不能少于6位' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!bcrypt.compareSync(oldPassword, user.password)) return res.status(400).json({ error: '旧密码不正确' });

    const hashed = bcrypt.hashSync(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });

    res.json({ success: true, data: { message: '密码修改成功' } });
  } catch (e) {
    console.error('修改密码失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /profile/avatar - 更新头像
router.put('/profile/avatar', async (req, res) => {
  try {
    const { avatar } = req.body;
    if (avatar === undefined || avatar === null) return res.status(400).json({ success: false, error: '請提供頭像資料' });

    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: String(avatar) } });
    res.json({ success: true, message: avatar ? '頭像已更新' : '頭像已移除' });
  } catch (e) {
    console.error('更新頭像失敗:', e.message);
    res.status(500).json({ success: false, error: '更新頭像失敗' });
  }
});

// ==================== 在线报名 ====================

// GET /events - 获取可报名项目
router.get('/events', async (req, res) => {
  try {
    const meet = await prisma.meetInfo.findFirst();
    const registrationOpen = meet ? !!meet.registrationOpen : true;

    let maxEventsPerStudent = 3;
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT rule_value FROM registration_rules WHERE rule_key = 'max_events_per_student'`
      );
      if (rows && rows.length > 0) maxEventsPerStudent = parseInt(rows[0].rule_value, 10) || 3;
    } catch (_) { /* table may not exist */ }

    const myCount = await prisma.registration.count({
      where: { userId: req.user.id, status: { not: 'rejected' } }
    });

    const events = await prisma.event.findMany({
      where: { status: 'active' },
      include: {
        _count: { select: { registrations: { where: { status: { not: 'rejected' } } } } }
      },
      orderBy: { sortOrder: 'asc' }
    });

    const data = events.map(e => ({
      ...e,
      registered_count: e._count.registrations,
      remaining: e.maxParticipants > 0 ? Math.max(0, e.maxParticipants - e._count.registrations) : -1,
      _count: undefined
    }));

    res.json({
      success: true,
      data,
      meta: {
        registration_open: registrationOpen,
        max_events_per_student: maxEventsPerStudent,
        my_registration_count: myCount
      }
    });
  } catch (e) {
    console.error('获取项目列表失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /registrations - 提交报名
router.post('/registrations', async (req, res) => {
  try {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ success: false, error: '請選擇報名項目' });

    const meet = await prisma.meetInfo.findFirst();
    if (meet && !meet.registrationOpen) return res.status(400).json({ success: false, error: '報名通道已關閉，請留意學校公告' });

    const event = await prisma.event.findFirst({ where: { id: parseInt(event_id), status: 'active' } });
    if (!event) return res.status(404).json({ success: false, error: '项目不存在或已关闭' });

    const existing = await prisma.registration.findFirst({
      where: { userId: req.user.id, eventId: parseInt(event_id) }
    });
    if (existing) return res.status(400).json({ success: false, error: '您已报名该项目，请勿重复报名' });

    let maxEventsPerStudent = 3;
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT rule_value FROM registration_rules WHERE rule_key = 'max_events_per_student'`
      );
      if (rows && rows.length > 0) maxEventsPerStudent = parseInt(rows[0].rule_value, 10) || 3;
    } catch (_) {}

    const currentCount = await prisma.registration.count({
      where: { userId: req.user.id, status: { not: 'rejected' } }
    });
    if (currentCount >= maxEventsPerStudent) {
      return res.status(400).json({ success: false, error: `每位学生最多可报${maxEventsPerStudent}个项目` });
    }

    if (event.maxParticipants > 0) {
      const registeredCount = await prisma.registration.count({
        where: { eventId: parseInt(event_id), status: { not: 'rejected' } }
      });
      if (registeredCount >= event.maxParticipants) {
        return res.status(400).json({ success: false, error: '该项目名额已满' });
      }
    }

    await prisma.registration.create({
      data: { userId: req.user.id, eventId: parseInt(event_id), status: 'pending' }
    });

    await prisma.notification.create({
      data: {
        userId: req.user.id,
        type: 'info',
        title: '報名已提交',
        content: `您已報名「${event.name}」，請等待管理員審核。`,
        targetUrl: '#/student'
      }
    });

    res.json({ success: true, message: '報名成功，等待審核' });
  } catch (e) {
    console.error('提交报名失败:', e.message);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// GET /registrations - 查看个人报名记录
router.get('/registrations', async (req, res) => {
  try {
    const registrations = await prisma.registration.findMany({
      where: { userId: req.user.id },
      include: { event: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: registrations });
  } catch (e) {
    console.error('获取报名记录失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /registrations/:id - 取消报名
router.delete('/registrations/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const registration = await prisma.registration.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!registration) return res.status(404).json({ success: false, error: '报名记录不存在' });
    if (registration.status !== 'pending') return res.status(400).json({ success: false, error: '仅待审核状态的报名可以取消' });

    await prisma.registration.delete({ where: { id } });

    res.json({ success: true, message: '已取消报名' });
  } catch (e) {
    console.error('取消报名失败:', e.message);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// ==================== 赛事查看 ====================

// GET /my-schedules - 查看个人参赛赛程
router.get('/my-schedules', async (req, res) => {
  try {
    const approvedRegs = await prisma.registration.findMany({
      where: { userId: req.user.id, status: 'approved' },
      select: { eventId: true }
    });
    const eventIds = approvedRegs.map(r => r.eventId);

    const schedules = eventIds.length > 0
      ? await prisma.schedule.findMany({
          where: { status: 'published', eventId: { in: eventIds } },
          include: { event: true },
          orderBy: [{ startTime: 'asc' }, { event: { sortOrder: 'asc' } }]
        })
      : [];

    res.json({ success: true, data: schedules });
  } catch (e) {
    console.error('获取个人赛程失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /schedules - 查看全校完整赛程
router.get('/schedules', async (req, res) => {
  try {
    const schedules = await prisma.schedule.findMany({
      where: { status: 'published' },
      include: { event: true },
      orderBy: [{ startTime: 'asc' }, { event: { sortOrder: 'asc' } }]
    });

    res.json({ success: true, data: schedules });
  } catch (e) {
    console.error('获取赛程失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ==================== 成绩查询 ====================

// GET /my-results - 查看个人成绩
router.get('/my-results', async (req, res) => {
  try {
    const results = await prisma.result.findMany({
      where: { userId: req.user.id, isPublished: 1 },
      include: { schedule: { include: { event: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: results });
  } catch (e) {
    console.error('获取个人成绩失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /results/class - 查看班级成绩排名
router.get('/results/class', async (req, res) => {
  try {
    const results = await prisma.result.findMany({
      where: { isPublished: 1 },
      include: { user: { select: { className: true, grade: true } } }
    });

    const classMap = {};
    results.forEach(r => {
      const cn = r.user.className || '未知班级';
      if (!classMap[cn]) {
        classMap[cn] = { class_name: cn, grade: r.user.grade || '', result_count: 0, total_score: 0, student_ids: new Set() };
      }
      classMap[cn].result_count++;
      classMap[cn].total_score += r.score;
      classMap[cn].student_ids.add(r.userId);
    });

    const rankings = Object.values(classMap).map(c => ({
      class_name: c.class_name,
      grade: c.grade,
      result_count: c.result_count,
      total_score: c.total_score,
      student_count: c.student_ids.size
    })).sort((a, b) => b.total_score - a.total_score || a.class_name.localeCompare(b.class_name));

    res.json({ success: true, data: rankings });
  } catch (e) {
    console.error('获取班级排名失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /results/grade - 查看年级成绩排名
router.get('/results/grade', async (req, res) => {
  try {
    const results = await prisma.result.findMany({
      where: { isPublished: 1 },
      include: { user: { select: { grade: true, className: true } } }
    });

    const gradeMap = {};
    results.forEach(r => {
      const g = r.user.grade || '未知年级';
      if (!gradeMap[g]) {
        gradeMap[g] = { grade: g, result_count: 0, total_score: 0, student_ids: new Set(), class_ids: new Set() };
      }
      gradeMap[g].result_count++;
      gradeMap[g].total_score += r.score;
      gradeMap[g].student_ids.add(r.userId);
      gradeMap[g].class_ids.add(r.user.className);
    });

    const rankings = Object.values(gradeMap).map(g => ({
      grade: g.grade,
      result_count: g.result_count,
      total_score: g.total_score,
      student_count: g.student_ids.size,
      class_count: g.class_ids.size
    })).sort((a, b) => b.total_score - a.total_score || a.grade.localeCompare(b.grade));

    res.json({ success: true, data: rankings });
  } catch (e) {
    console.error('获取年级排名失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ==================== 公告 ====================

// GET /announcements - 查看全校公告
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { status: 'published' },
      include: { publisher: { select: { name: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }]
    });

    let readMap = {};
    if (announcements.length > 0) {
      const ids = announcements.map(a => a.id);
      const placeholders = ids.map(() => '?').join(',');
      try {
        const reads = await prisma.$queryRawUnsafe(
          `SELECT announcement_id FROM announcement_reads WHERE user_id = ? AND announcement_id IN (${placeholders})`,
          req.user.id, ...ids
        );
        reads.forEach(r => { readMap[r.announcement_id] = true; });
      } catch (_) { /* table may not exist */ }
    }

    const data = announcements.map(a => ({
      ...a,
      publisher_name: a.publisher?.name,
      is_read: readMap[a.id] ? 1 : 0
    }));

    res.json({ success: true, data });
  } catch (e) {
    console.error('获取公告列表失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /announcements/:id - 查看公告详情
router.get('/announcements/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    await prisma.announcement.update({ where: { id }, data: { viewCount: { increment: 1 } } });

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: { publisher: { select: { name: true } } }
    });

    if (!announcement) return res.status(404).json({ error: '公告不存在' });

    let isRead = 0;
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id FROM announcement_reads WHERE announcement_id = ? AND user_id = ?`,
        id, req.user.id
      );
      isRead = rows && rows.length > 0 ? 1 : 0;
    } catch (_) {}

    res.json({ success: true, data: { ...announcement, publisher_name: announcement.publisher?.name, is_read: isRead } });
  } catch (e) {
    console.error('获取公告详情失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /announcements/:id/read - 标记已读
router.put('/announcements/:id/read', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const announcement = await prisma.announcement.findFirst({ where: { id, status: 'published' } });
    if (!announcement) return res.status(404).json({ error: '公告不存在' });

    try {
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id, read_at) VALUES (?, ?, datetime('now','localtime'))`,
        id, req.user.id
      );
    } catch (_) { /* table may not exist */ }

    res.json({ success: true, data: { message: '已标记为已读' } });
  } catch (e) {
    console.error('标记已读失败:', e.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ==================== 站内通知 ====================

// GET /notifications
router.get('/notifications', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const [list, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: limit
      }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: 0 } })
    ]);
    res.json({ success: true, data: { list, unread: unreadCount } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /notifications/:id/read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data: { isRead: 1 }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /notifications/read-all
router.put('/notifications/read-all', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: 0 },
      data: { isRead: 1 }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
