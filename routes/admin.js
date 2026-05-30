const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const prisma = require('../lib/prisma');
const { authMiddleware, adminOnly, logOperation } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持Excel/CSV文件'));
    }
  }
});

router.use(authMiddleware);
router.use(adminOnly);

function getIp(req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
}

// ==================== 系统设置 ====================

// GET /settings - 获取所有系统设置
router.get('/settings', async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    const meet = await prisma.meetInfo.findFirst();
    const data = {};
    settings.forEach(s => { data[s.key] = s.value; });
    if (meet) Object.assign(data, meet);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /settings - 修改系统设置
router.put('/settings', async (req, res) => {
  try {
    const { site_name, theme, start_date, end_date, registration_open, site_maintenance, logo_url, timezone } = req.body;

    const settingsMap = { site_name, theme, timezone };
    for (const [k, v] of Object.entries(settingsMap)) {
      if (v !== undefined) {
        await prisma.setting.upsert({
          where: { key: k },
          update: { value: String(v) },
          create: { key: k, value: String(v) }
        });
      }
    }

    const meetFields = {};
    if (start_date !== undefined) meetFields.startDate = start_date;
    if (end_date !== undefined) meetFields.endDate = end_date;
    if (registration_open !== undefined) meetFields.registrationOpen = registration_open ? 1 : 0;
    if (site_maintenance !== undefined) meetFields.siteMaintenance = site_maintenance ? 1 : 0;
    if (logo_url !== undefined) meetFields.logoUrl = logo_url;

    if (Object.keys(meetFields).length > 0) {
      const existing = await prisma.meetInfo.findFirst();
      if (existing) {
        await prisma.meetInfo.update({ where: { id: existing.id }, data: meetFields });
      } else {
        await prisma.meetInfo.create({ data: meetFields });
      }
    }

    await logOperation(req.user.id, req.user.username, '修改系统设置', JSON.stringify(req.body), getIp(req));
    res.json({ success: true, message: '设置已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 用户管理 ====================

// GET /users - 用户列表
router.get('/users', async (req, res) => {
  try {
    const { role, grade, class_name, status, keyword } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const conditions = {};
    if (role) conditions.role = role;
    if (grade) conditions.grade = grade;
    if (className) conditions.className = class_name;
    if (status) conditions.status = status;
    if (keyword) {
      conditions.OR = [
        { name: { contains: keyword } },
        { username: { contains: keyword } },
        { studentId: { contains: keyword } },
        { email: { contains: keyword } }
      ];
    }

    const [list, total] = await Promise.all([
      prisma.user.findMany({
        where: conditions,
        select: { id: true, username: true, email: true, role: true, studentId: true, name: true, className: true, grade: true, status: true, createdAt: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'desc' }
      }),
      prisma.user.count({ where: conditions })
    ]);

    res.json({
      success: true,
      data: { list, total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /users - 添加单个学生
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, name, student_id, class_name, grade } = req.body;
    if (!username || !email || !password || !name || !student_id || !class_name || !grade) {
      return res.status(400).json({ success: false, error: '所有字段必填' });
    }
    const hash = bcrypt.hashSync(password, 10);
    await prisma.user.create({
      data: {
        username, email, password: hash, role: 'student',
        studentId: student_id, name, className: class_name, grade
      }
    });
    await logOperation(req.user.id, req.user.username, '添加学生', `添加学生: ${name}(${student_id})`, getIp(req));
    res.json({ success: true, message: '添加成功' });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ success: false, error: '用户名/邮箱/学号已存在' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /users/batch - 批量导入学生
router.post('/users/batch', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: '请上传Excel文件' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const hash = bcrypt.hashSync('123456', 10);
    let success = 0, fail = 0;

    for (const row of rows) {
      const studentId = String(row['学号'] || row['student_id'] || '');
      const name = String(row['姓名'] || row['name'] || '');
      const className = String(row['班级'] || row['class_name'] || '');
      const grade = String(row['年级'] || row['grade'] || '');
      if (!studentId || !name) { fail++; continue; }
      try {
        await prisma.user.create({
          data: {
            username: studentId,
            email: `${studentId}@hkms.hktedu.com`,
            password: hash,
            role: 'student',
            studentId,
            name,
            className,
            grade
          }
        });
        success++;
      } catch { fail++; }
    }

    await logOperation(req.user.id, req.user.username, '批量导入学生', `成功${success}条，失败${fail}条`, getIp(req));
    res.json({ success: true, message: `导入完成：成功${success}条，失败${fail}条` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /users/:id - 编辑学生信息
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, student_id, class_name, grade, email, username, role } = req.body;

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });

    const data = {};
    if (name !== undefined) data.name = name;
    if (student_id !== undefined) data.studentId = student_id;
    if (class_name !== undefined) data.className = class_name;
    if (grade !== undefined) data.grade = grade;
    if (email !== undefined) data.email = email;
    if (username !== undefined) data.username = username;
    if (role !== undefined && ['admin', 'student'].includes(role) && user.id !== 1) {
      data.role = role;
    }

    if (Object.keys(data).length === 0) return res.json({ success: true, message: '无需更新' });

    await prisma.user.update({ where: { id: parseInt(id) }, data });

    await logOperation(req.user.id, req.user.username, '编辑学生信息', `编辑学生ID:${id}`, getIp(req));
    res.json({ success: true, message: '信息已更新' });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ success: false, error: '用户名/邮箱/学号已存在' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /users/:id/reset-password - 重置密码
router.put('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    const hash = bcrypt.hashSync('123456', 10);
    await prisma.user.update({ where: { id: parseInt(id) }, data: { password: hash } });
    await logOperation(req.user.id, req.user.username, '重置密码', `重置用户ID:${id} 密码`, getIp(req));
    res.json({ success: true, message: '密码已重置为123456' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /users/:id/status - 禁用/启用
router.put('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) return res.status(400).json({ success: false, error: '状态值无效' });
    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    await prisma.user.update({ where: { id: parseInt(id) }, data: { status } });
    await logOperation(req.user.id, req.user.username, status === 'active' ? '启用账号' : '禁用账号', `用户ID:${id}`, getIp(req));
    res.json({ success: true, message: status === 'active' ? '账号已启用' : '账号已禁用' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /users/:id - 删除学生（软删除）
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    if (user.role === 'admin') return res.status(400).json({ success: false, error: '不能删除管理员' });
    await prisma.user.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } });
    await logOperation(req.user.id, req.user.username, '删除学生', `删除用户ID:${id} ${user.name}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /users/export - 导出学生名单
router.get('/users/export', async (req, res) => {
  try {
    const { grade, class_name } = req.query;
    const where = { role: 'student' };
    if (grade) where.grade = grade;
    if (class_name) where.className = class_name;

    const users = await prisma.user.findMany({
      where,
      select: { studentId: true, name: true, className: true, grade: true, email: true, status: true },
      orderBy: [{ grade: 'asc' }, { className: 'asc' }, { studentId: 'asc' }]
    });
    res.json({ success: true, data: users });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 项目管理 ====================

// GET /events - 获取项目列表
router.get('/events', async (req, res) => {
  try {
    const { category, event_type, gender_group, status } = req.query;
    const where = {};
    if (category) where.category = category;
    if (event_type) where.eventType = event_type;
    if (gender_group) where.genderGroup = gender_group;
    if (status) where.status = status;

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    });
    res.json({ success: true, data: events });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /events - 添加项目
router.post('/events', async (req, res) => {
  try {
    const { name, category, event_type, gender_group, max_participants, rules, venue, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '项目名称必填' });

    const event = await prisma.event.create({
      data: {
        name,
        category: category || 'track',
        eventType: event_type || 'individual',
        genderGroup: gender_group || 'mixed',
        maxParticipants: max_participants || 0,
        rules: rules || '',
        venue: venue || '',
        sortOrder: sort_order || 0
      }
    });

    await logOperation(req.user.id, req.user.username, '添加项目', `添加项目: ${name}`, getIp(req));
    res.json({ success: true, message: '项目已添加', data: { id: event.id } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /events/:id - 编辑项目
router.put('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id: parseInt(id) } });
    if (!event) return res.status(404).json({ success: false, error: '项目不存在' });

    const data = {};
    const fields = ['name', 'category', 'eventType', 'genderGroup', 'maxParticipants', 'rules', 'venue', 'status', 'sortOrder'];
    const bodyMap = { eventType: 'event_type', genderGroup: 'gender_group', maxParticipants: 'max_participants', sortOrder: 'sort_order' };
    for (const f of fields) {
      const k = bodyMap[f] || f;
      if (req.body[k] !== undefined) data[f] = req.body[k];
    }
    if (Object.keys(data).length === 0) return res.json({ success: true, message: '无需更新' });

    await prisma.event.update({ where: { id: parseInt(id) }, data });
    await logOperation(req.user.id, req.user.username, '编辑项目', `编辑项目ID:${id}`, getIp(req));
    res.json({ success: true, message: '项目已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /events/:id - 删除项目
router.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id: parseInt(id) } });
    if (!event) return res.status(404).json({ success: false, error: '项目不存在' });
    await prisma.event.delete({ where: { id: parseInt(id) } });
    await logOperation(req.user.id, req.user.username, '删除项目', `删除项目ID:${id} ${event.name}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 报名规则 ====================

// GET /rules - 获取报名规则
router.get('/rules', async (req, res) => {
  try {
    let rules = [];
    try {
      rules = await prisma.$queryRawUnsafe(`SELECT * FROM registration_rules ORDER BY id`);
    } catch (_) { rules = []; }
    const data = {};
    rules.forEach(r => { data[r.rule_key] = r.rule_value; });
    res.json({ success: true, data: rules.length === 0 ? null : { rules: data, raw: rules } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /rules - 更新报名规则
router.put('/rules', async (req, res) => {
  try {
    for (const [key, val] of Object.entries(req.body)) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO registration_rules (rule_key, rule_value, description) VALUES (?, ?, ?) ON CONFLICT(rule_key) DO UPDATE SET rule_value = ?`,
          key, String(val), '', String(val)
        );
      } catch (_) {}
    }
    await logOperation(req.user.id, req.user.username, '更新报名规则', JSON.stringify(req.body), getIp(req));
    res.json({ success: true, message: '规则已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 报名管理 ====================

// GET /registrations - 报名记录
router.get('/registrations', async (req, res) => {
  try {
    const { event_id, grade, class_name, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const where = {};
    if (event_id) where.eventId = parseInt(event_id);
    if (status) where.status = status;

    const userWhere = {};
    if (grade) userWhere.grade = grade;
    if (class_name) userWhere.className = class_name;
    if (Object.keys(userWhere).length > 0) where.user = userWhere;

    const [list, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: {
          user: { select: { name: true, studentId: true, className: true, grade: true } },
          event: { select: { name: true, category: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.registration.count({ where })
    ]);

    res.json({
      success: true,
      data: { list, total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /registrations/:id/approve - 审核通过
router.put('/registrations/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const reg = await prisma.registration.findUnique({ where: { id: parseInt(id) } });
    if (!reg) return res.status(404).json({ success: false, error: '报名记录不存在' });

    await prisma.registration.update({
      where: { id: parseInt(id) },
      data: { status: 'approved', reviewedBy: req.user.id, reviewedAt: new Date() }
    });

    const event = await prisma.event.findUnique({ where: { id: reg.eventId }, select: { name: true } });
    await prisma.notification.create({
      data: {
        userId: reg.userId,
        type: 'success',
        title: '报名已通过',
        content: `您报名的【${event ? event.name : '项目'}】已通过审核，请查看赛程安排`,
        targetUrl: '/student'
      }
    });

    await logOperation(req.user.id, req.user.username, '审核通过报名', `报名ID:${id}`, getIp(req));
    res.json({ success: true, message: '已通过' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /registrations/batch-approve - 批量通过
router.put('/registrations/batch-approve', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: '请提供ID数组' });

    for (const id of ids) {
      const reg = await prisma.registration.findUnique({ where: { id: parseInt(id) } });
      if (!reg) continue;
      await prisma.registration.update({
        where: { id: parseInt(id) },
        data: { status: 'approved', reviewedBy: req.user.id, reviewedAt: new Date() }
      });
      const event = await prisma.event.findUnique({ where: { id: reg.eventId }, select: { name: true } });
      await prisma.notification.create({
        data: {
          userId: reg.userId,
          type: 'success',
          title: '报名已通过',
          content: `您报名的【${event ? event.name : '项目'}】已通过审核`,
          targetUrl: '/student'
        }
      });
    }

    await logOperation(req.user.id, req.user.username, '批量通过报名', `批量通过${ids.length}条报名`, getIp(req));
    res.json({ success: true, message: `已批量通过${ids.length}条报名` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /registrations/:id/reject - 驳回
router.put('/registrations/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reg = await prisma.registration.findUnique({ where: { id: parseInt(id) } });
    if (!reg) return res.status(404).json({ success: false, error: '报名记录不存在' });

    await prisma.registration.update({
      where: { id: parseInt(id) },
      data: { status: 'rejected', rejectReason: reason || '', reviewedBy: req.user.id, reviewedAt: new Date() }
    });

    const event = await prisma.event.findUnique({ where: { id: reg.eventId }, select: { name: true } });
    await prisma.notification.create({
      data: {
        userId: reg.userId,
        type: 'warning',
        title: '报名已驳回',
        content: `您报名的【${event ? event.name : '项目'}】已被驳回${reason ? '，原因：' + reason : ''}`,
        targetUrl: '/student'
      }
    });

    await logOperation(req.user.id, req.user.username, '驳回报名', `报名ID:${id} 原因:${reason}`, getIp(req));
    res.json({ success: true, message: '已驳回' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /registrations/stats - 报名统计
router.get('/registrations/stats', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        _count: { select: { registrations: { where: { status: 'approved' } } } }
      },
      orderBy: { sortOrder: 'asc' }
    });
    const eventStats = events.map(e => ({
      id: e.id, name: e.name, category: e.category, gender_group: e.genderGroup,
      count: e._count.registrations
    })).sort((a, b) => b.count - a.count);

    const users = await prisma.user.findMany({
      where: { role: 'student' },
      select: { id: true, name: true, studentId: true, className: true, grade: true },
      include: {
        registrations: { where: { status: 'approved' } },
        _count: { select: { registrations: { where: { status: 'approved' } } } }
      }
    });

    const classMap = {};
    const unregistered = [];
    users.forEach(u => {
      const cn = `${u.grade || ''}-${u.className || ''}`;
      if (!classMap[cn]) classMap[cn] = { class_name: u.className, grade: u.grade, count: 0 };
      if (u._count.registrations > 0) classMap[cn].count += u._count.registrations;
      else unregistered.push({ id: u.id, name: u.name, student_id: u.studentId, class_name: u.className, grade: u.grade });
    });
    const classStats = Object.values(classMap).sort((a, b) => (a.grade || '').localeCompare(b.grade || '') || (a.class_name || '').localeCompare(b.class_name || ''));

    res.json({ success: true, data: { eventStats, classStats, unregistered } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /registrations/export - 导出报名表
router.get('/registrations/export', async (req, res) => {
  try {
    const registrations = await prisma.registration.findMany({
      include: {
        user: { select: { studentId: true, name: true, className: true, grade: true } },
        event: { select: { name: true, category: true, genderGroup: true } }
      },
      orderBy: [
        { user: { grade: 'asc' } },
        { user: { className: 'asc' } },
        { event: { name: 'asc' } }
      ]
    });
    res.json({ success: true, data: registrations });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /registrations/heatmap - 报名热度
router.get('/registrations/heatmap', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        _count: { select: { registrations: { where: { status: 'approved' } } } }
      }
    });

    const heatmap = await Promise.all(events.map(async (e) => {
      const pendingCount = await prisma.registration.count({ where: { eventId: e.id, status: 'pending' } });
      const totalCount = await prisma.registration.count({ where: { eventId: e.id } });
      return {
        id: e.id, name: e.name, category: e.category, gender_group: e.genderGroup,
        max_participants: e.maxParticipants,
        approved_count: e._count.registrations,
        pending_count: pendingCount,
        total_count: totalCount
      };
    }));

    heatmap.sort((a, b) => b.total_count - a.total_count);
    res.json({ success: true, data: heatmap });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 赛程编排 ====================

// GET /schedules - 所有赛程
router.get('/schedules', async (req, res) => {
  try {
    const { event_id, status, venue } = req.query;
    const where = {};
    if (event_id) where.eventId = parseInt(event_id);
    if (status) where.status = status;
    if (venue) where.venue = { contains: venue };

    const schedules = await prisma.schedule.findMany({
      where,
      include: { event: { select: { name: true, category: true, genderGroup: true } } },
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }]
    });
    res.json({ success: true, data: schedules });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /schedules - 创建赛程
router.post('/schedules', async (req, res) => {
  try {
    const { event_id, round_name, start_time, end_time, venue, max_heats, note } = req.body;
    if (!event_id || !start_time) return res.status(400).json({ success: false, error: '项目和开始时间必填' });

    const schedule = await prisma.schedule.create({
      data: {
        eventId: parseInt(event_id),
        roundName: round_name || '预赛',
        startTime: start_time,
        endTime: end_time || '',
        venue: venue || '',
        maxHeats: max_heats || 1,
        note: note || ''
      }
    });

    await logOperation(req.user.id, req.user.username, '创建赛程', `赛程ID:${schedule.id}`, getIp(req));
    res.json({ success: true, message: '赛程已创建', data: { id: schedule.id } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /schedules/:id - 修改赛程
router.put('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await prisma.schedule.findUnique({ where: { id: parseInt(id) } });
    if (!schedule) return res.status(404).json({ success: false, error: '赛程不存在' });

    const data = {};
    const fields = ['eventId', 'roundName', 'startTime', 'endTime', 'venue', 'maxHeats', 'status', 'note'];
    const bodyMap = { eventId: 'event_id', roundName: 'round_name', startTime: 'start_time', endTime: 'end_time', maxHeats: 'max_heats' };
    for (const f of fields) {
      const k = bodyMap[f] || f;
      if (req.body[k] !== undefined) data[f] = req.body[k];
    }
    if (Object.keys(data).length === 0) return res.json({ success: true, message: '无需更新' });

    await prisma.schedule.update({ where: { id: parseInt(id) }, data });
    await logOperation(req.user.id, req.user.username, '修改赛程', `赛程ID:${id}`, getIp(req));
    res.json({ success: true, message: '赛程已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /schedules/:id - 删除赛程
router.delete('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await prisma.schedule.findUnique({ where: { id: parseInt(id) } });
    if (!schedule) return res.status(404).json({ success: false, error: '赛程不存在' });
    await prisma.schedule.delete({ where: { id: parseInt(id) } });
    await logOperation(req.user.id, req.user.username, '删除赛程', `赛程ID:${id}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /schedules/publish - 批量发布
router.put('/schedules/publish', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: '请提供ID数组' });

    await prisma.schedule.updateMany({
      where: { id: { in: ids.map(id => parseInt(id)) } },
      data: { status: 'published' }
    });

    await logOperation(req.user.id, req.user.username, '发布赛程', `批量发布${ids.length}个赛程`, getIp(req));
    res.json({ success: true, message: `已发布${ids.length}个赛程` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /schedules/export - 导出赛程表
router.get('/schedules/export', async (req, res) => {
  try {
    const schedules = await prisma.schedule.findMany({
      include: { event: { select: { name: true, category: true, genderGroup: true } } },
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }]
    });
    res.json({ success: true, data: schedules });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /schedules/:id/participants
router.get('/schedules/:id/participants', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!schedule) return res.json({ success: false, error: '赛程不存在' });

    const participants = await prisma.registration.findMany({
      where: { eventId: schedule.eventId, status: 'approved' },
      include: { user: { select: { id: true, name: true, studentId: true, className: true, grade: true } } },
      orderBy: [{ user: { className: 'asc' } }, { user: { name: 'asc' } }]
    });

    res.json({ success: true, data: participants });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 成绩管理 ====================

// GET /results - 所有成绩
router.get('/results', async (req, res) => {
  try {
    const { event_id, schedule_id, grade, class_name, award, is_published } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const where = {};
    if (schedule_id) where.scheduleId = parseInt(schedule_id);
    if (award) where.award = award;
    if (is_published !== undefined) where.isPublished = parseInt(is_published);

    const userWhere = {};
    if (grade) userWhere.grade = grade;
    if (class_name) userWhere.className = class_name;
    if (Object.keys(userWhere).length > 0) where.user = userWhere;

    if (event_id) {
      where.schedule = { eventId: parseInt(event_id) };
    }

    const [list, total] = await Promise.all([
      prisma.result.findMany({
        where,
        include: {
          user: { select: { name: true, studentId: true, className: true, grade: true } },
          schedule: { include: { event: { select: { name: true, category: true } } } }
        },
        orderBy: [{ rank: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.result.count({ where })
    ]);

    res.json({
      success: true,
      data: { list, total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /results - 录入成绩
router.post('/results', async (req, res) => {
  try {
    const { schedule_id, user_id, performance, award } = req.body;
    if (!schedule_id || !user_id) return res.status(400).json({ success: false, error: '赛程和用户必填' });

    await prisma.result.create({
      data: {
        scheduleId: parseInt(schedule_id),
        userId: parseInt(user_id),
        performance: performance || '',
        award: award || '',
        recordedBy: req.user.id
      }
    });

    await logOperation(req.user.id, req.user.username, '录入成绩', `赛程ID:${schedule_id} 用户ID:${user_id}`, getIp(req));
    res.json({ success: true, message: '成绩已录入' });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ success: false, error: '该用户在此赛程已有成绩' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /results/batch - 批量导入成绩
router.post('/results/batch', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: '请上传Excel文件' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let success = 0, fail = 0;
    for (const row of rows) {
      const scheduleId = row['赛程ID'] || row['schedule_id'];
      const userId = row['用户ID'] || row['user_id'];
      const performance = String(row['成绩'] || row['performance'] || '');
      const award = String(row['奖项'] || row['award'] || '');
      if (!scheduleId || !userId) { fail++; continue; }
      try {
        await prisma.result.create({
          data: {
            scheduleId: parseInt(scheduleId),
            userId: parseInt(userId),
            performance,
            award,
            recordedBy: req.user.id
          }
        });
        success++;
      } catch { fail++; }
    }

    await logOperation(req.user.id, req.user.username, '批量导入成绩', `成功${success}条，失败${fail}条`, getIp(req));
    res.json({ success: true, message: `导入完成：成功${success}条，失败${fail}条` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /results/:id - 修改成绩
router.put('/results/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.result.findUnique({ where: { id: parseInt(id) } });
    if (!result) return res.status(404).json({ success: false, error: '成绩记录不存在' });

    const data = {};
    const fields = ['scheduleId', 'userId', 'performance', 'award', 'score', 'note'];
    const bodyMap = { scheduleId: 'schedule_id', userId: 'user_id' };
    for (const f of fields) {
      const k = bodyMap[f] || f;
      if (req.body[k] !== undefined) data[f] = req.body[k];
    }
    if (Object.keys(data).length === 0) return res.json({ success: true, message: '无需更新' });

    await prisma.result.update({ where: { id: parseInt(id) }, data });
    await logOperation(req.user.id, req.user.username, '修改成绩', `成绩ID:${id}`, getIp(req));
    res.json({ success: true, message: '成绩已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /results/:id - 删除成绩
router.delete('/results/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.result.findUnique({ where: { id: parseInt(id) } });
    if (!result) return res.status(404).json({ success: false, error: '成绩记录不存在' });
    await prisma.result.delete({ where: { id: parseInt(id) } });
    await logOperation(req.user.id, req.user.username, '删除成绩', `成绩ID:${id}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /results/auto-rank - 自动排名
router.post('/results/auto-rank', async (req, res) => {
  try {
    const scheduleIds = (await prisma.result.findMany({ select: { scheduleId: true }, distinct: ['scheduleId'] })).map(r => r.scheduleId);

    let rankedCount = 0;
    for (const schedId of scheduleIds) {
      const schedule = await prisma.schedule.findUnique({
        where: { id: schedId },
        include: { event: { select: { category: true } } }
      });
      if (!schedule) continue;

      const results = await prisma.result.findMany({
        where: { scheduleId: schedId, performance: { not: '' } }
      });
      if (results.length === 0) continue;

      const sorted = results.sort((a, b) => {
        const pa = parseFloat(a.performance);
        const pb = parseFloat(b.performance);
        if (isNaN(pa) && isNaN(pb)) return 0;
        if (isNaN(pa)) return 1;
        if (isNaN(pb)) return -1;
        return pa - pb;
      });

      for (let i = 0; i < sorted.length; i++) {
        await prisma.result.update({
          where: { id: sorted[i].id },
          data: { rank: i + 1 }
        });
        rankedCount++;
      }
    }

    await logOperation(req.user.id, req.user.username, '自动排名', `已排名${rankedCount}条成绩`, getIp(req));
    res.json({ success: true, message: `自动排名完成，已排名${rankedCount}条成绩` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /results/publish - 公示成绩
router.put('/results/publish', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: '请提供ID数组' });

    await prisma.result.updateMany({
      where: { id: { in: ids.map(id => parseInt(id)) } },
      data: { isPublished: 1 }
    });

    await logOperation(req.user.id, req.user.username, '公示成绩', `公示${ids.length}条`, getIp(req));
    res.json({ success: true, message: `已公示${ids.length}条成绩` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /results/unpublish - 撤回公示
router.put('/results/unpublish', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: '请提供ID数组' });

    await prisma.result.updateMany({
      where: { id: { in: ids.map(id => parseInt(id)) } },
      data: { isPublished: 0 }
    });

    await logOperation(req.user.id, req.user.username, '撤回成绩公示', `撤回${ids.length}条`, getIp(req));
    res.json({ success: true, message: `已撤回${ids.length}条成绩公示` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /results/export - 导出获奖名单
router.get('/results/export', async (req, res) => {
  try {
    const results = await prisma.result.findMany({
      where: { award: { not: '' } },
      include: {
        user: { select: { studentId: true, name: true, className: true, grade: true } },
        schedule: { include: { event: { select: { name: true, category: true } } } }
      },
      orderBy: [{ isPublished: 'desc' }, { award: 'asc' }, { rank: 'asc' }]
    });
    res.json({ success: true, data: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 数据统计 ====================

// GET /stats/class - 班级统计
router.get('/stats/class', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'student' },
      select: { id: true, className: true, grade: true },
      include: {
        registrations: { where: { status: 'approved' } },
        results: true
      }
    });

    const classMap = {};
    users.forEach(u => {
      const cn = u.className || '未知';
      const key = `${u.grade || ''}-${cn}`;
      if (!classMap[key]) classMap[key] = { class_name: cn, grade: u.grade || '', total_students: 0, registered_count: 0, awarded_count: 0, total_score: 0 };
      classMap[key].total_students++;
      if (u.registrations.length > 0) classMap[key].registered_count++;
      u.results.forEach(r => {
        classMap[key].total_score += r.score;
        if (r.award) classMap[key].awarded_count++;
      });
    });

    const stats = Object.values(classMap).map(c => ({
      ...c,
      reg_rate: c.total_students > 0 ? Math.round((c.registered_count / c.total_students) * 1000) / 10 : 0
    })).sort((a, b) => b.total_score - a.total_score || b.reg_rate - a.reg_rate);

    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /stats/grade - 年级统计
router.get('/stats/grade', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'student' },
      select: { id: true, grade: true },
      include: {
        registrations: { where: { status: 'approved' } },
        results: true
      }
    });

    const gradeMap = {};
    users.forEach(u => {
      const g = u.grade || '未知';
      if (!gradeMap[g]) gradeMap[g] = { grade: g, total_students: 0, registered_count: 0, awarded_count: 0, first_prize: 0, second_prize: 0, third_prize: 0, total_score: 0 };
      gradeMap[g].total_students++;
      if (u.registrations.length > 0) gradeMap[g].registered_count++;
      u.results.forEach(r => {
        gradeMap[g].total_score += r.score;
        if (r.award) {
          gradeMap[g].awarded_count++;
          if (r.award === '一等') gradeMap[g].first_prize++;
          else if (r.award === '二等') gradeMap[g].second_prize++;
          else if (r.award === '三等') gradeMap[g].third_prize++;
        }
      });
    });

    const stats = Object.values(gradeMap).sort((a, b) => b.total_score - a.total_score);
    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /stats/export - 导出统计报表
router.get('/stats/export', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'student' },
      select: { id: true, className: true, grade: true },
      include: {
        registrations: { where: { status: 'approved' } },
        results: true
      }
    });

    const classMap = {};
    users.forEach(u => {
      const cn = u.className || '未知';
      const key = `${u.grade || ''}-${cn}`;
      if (!classMap[key]) classMap[key] = { class_name: cn, grade: u.grade || '', total_students: 0, registered_count: 0, awarded_count: 0, total_score: 0 };
      classMap[key].total_students++;
      if (u.registrations.length > 0) classMap[key].registered_count++;
      u.results.forEach(r => {
        classMap[key].total_score += r.score;
        if (r.award) classMap[key].awarded_count++;
      });
    });

    const classStats = Object.values(classMap).map(c => ({
      ...c,
      reg_rate: c.total_students > 0 ? Math.round((c.registered_count / c.total_students) * 1000) / 10 : 0
    })).sort((a, b) => b.total_score - a.total_score);

    const events = await prisma.event.findMany({
      include: {
        _count: { select: { registrations: { where: { status: 'approved' } } } }
      }
    });
    const eventStats = events.map(e => ({
      name: e.name, category: e.category, gender_group: e.genderGroup,
      reg_count: e._count.registrations, result_count: 0
    }));

    const resultsWithAward = await prisma.result.findMany({
      where: { award: { not: '' } },
      include: { user: { select: { className: true, grade: true } } }
    });
    const awardMap = {};
    resultsWithAward.forEach(r => {
      const key = `${r.user.grade || ''}-${r.user.className || ''}-${r.award}`;
      if (!awardMap[key]) awardMap[key] = { class_name: r.user.className, grade: r.user.grade, award: r.award, count: 0 };
      awardMap[key].count++;
    });
    const awardSummary = Object.values(awardMap).sort((a, b) =>
      (a.grade || '').localeCompare(b.grade || '') || (a.class_name || '').localeCompare(b.class_name || '') || (a.award || '').localeCompare(b.award || '')
    );

    res.json({ success: true, data: { classStats, eventStats, awardSummary } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 公告管理 ====================

// GET /announcements - 管理员查看所有公告
router.get('/announcements', async (req, res) => {
  try {
    const { category, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;

    const [list, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: { publisher: { select: { name: true } } },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.announcement.count({ where })
    ]);

    res.json({
      success: true,
      data: { list, total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /announcements - 发布公告
router.post('/announcements', async (req, res) => {
  try {
    const { title, content, category, is_pinned, expire_time, status } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: '标题和内容必填' });

    const pubStatus = status || 'published';
    const data = {
      title, content,
      category: category || 'general',
      isPinned: is_pinned ? 1 : 0,
      publishedBy: req.user.id,
      expireTime: expire_time || null,
      status: pubStatus
    };
    if (pubStatus === 'published') {
      data.publishTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    const announcement = await prisma.announcement.create({ data });

    await logOperation(req.user.id, req.user.username, '发布公告', `公告: ${title}`, getIp(req));
    res.json({ success: true, message: '公告已发布', data: { id: announcement.id } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /announcements/:id - 编辑公告
router.put('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await prisma.announcement.findUnique({ where: { id: parseInt(id) } });
    if (!announcement) return res.status(404).json({ success: false, error: '公告不存在' });

    const data = {};
    const fields = ['title', 'content', 'category', 'isPinned', 'expireTime', 'status'];
    const bodyMap = { isPinned: 'is_pinned', expireTime: 'expire_time' };
    for (const f of fields) {
      const k = bodyMap[f] || f;
      if (req.body[k] !== undefined) {
        if (f === 'isPinned') data[f] = req.body[k] ? 1 : 0;
        else data[f] = req.body[k];
      }
    }
    if (req.body.status === 'published' && announcement.status !== 'published') {
      data.publishTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    }
    if (Object.keys(data).length === 0) return res.json({ success: true, message: '无需更新' });

    await prisma.announcement.update({ where: { id: parseInt(id) }, data });
    await logOperation(req.user.id, req.user.username, '编辑公告', `公告ID:${id}`, getIp(req));
    res.json({ success: true, message: '公告已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /announcements/:id - 删除公告
router.delete('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await prisma.announcement.findUnique({ where: { id: parseInt(id) } });
    if (!announcement) return res.status(404).json({ success: false, error: '公告不存在' });
    await prisma.announcement.delete({ where: { id: parseInt(id) } });
    await logOperation(req.user.id, req.user.username, '删除公告', `公告ID:${id}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /announcements/:id/pin - 置顶/取消置顶
router.put('/announcements/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await prisma.announcement.findUnique({ where: { id: parseInt(id) } });
    if (!announcement) return res.status(404).json({ success: false, error: '公告不存在' });
    const newPinned = announcement.isPinned ? 0 : 1;
    await prisma.announcement.update({ where: { id: parseInt(id) }, data: { isPinned: newPinned } });
    await logOperation(req.user.id, req.user.username, `${newPinned ? '置顶' : '取消置顶'}公告`, `公告ID:${id}`, getIp(req));
    res.json({ success: true, message: newPinned ? '已置顶' : '已取消置顶' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 年级班级管理 ====================

// GET /grades - 获取年级和班级
router.get('/grades', async (req, res) => {
  try {
    let grades = [], classes = [];
    try {
      grades = await prisma.$queryRawUnsafe(`SELECT * FROM grades ORDER BY sort_order`);
    } catch (_) {}
    try {
      classes = await prisma.$queryRawUnsafe(`SELECT c.*, g.name as grade_name FROM classes c JOIN grades g ON c.grade_id = g.id ORDER BY g.sort_order, c.sort_order`);
    } catch (_) {}
    res.json({ success: true, data: { grades, classes } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /grades - 添加年级
router.post('/grades', async (req, res) => {
  try {
    const { name, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '年级名称必填' });
    let result;
    try {
      result = await prisma.$queryRawUnsafe(`INSERT INTO grades (name, sort_order) VALUES (?, ?)`, name, sort_order || 0);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: '年级已存在' });
      throw e;
    }
    await logOperation(req.user.id, req.user.username, '添加年级', `年级: ${name}`, getIp(req));
    res.json({ success: true, message: '年级已添加', data: { id: result ? result.lastInsertRowid : null } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /classes - 添加班级
router.post('/classes', async (req, res) => {
  try {
    const { grade_id, name, sort_order } = req.body;
    if (!grade_id || !name) return res.status(400).json({ success: false, error: '年级和班级名称必填' });
    try {
      await prisma.$executeRawUnsafe(`INSERT INTO classes (grade_id, name, sort_order) VALUES (?, ?, ?)`, grade_id, name, sort_order || 0);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: '该年级下班级已存在' });
      throw e;
    }
    await logOperation(req.user.id, req.user.username, '添加班级', `班级: ${name}`, getIp(req));
    res.json({ success: true, message: '班级已添加' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /grades/:id - 删除年级
router.delete('/grades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let grade;
    try { grade = (await prisma.$queryRawUnsafe(`SELECT * FROM grades WHERE id = ?`, parseInt(id)))[0]; } catch (_) {}
    if (!grade) return res.status(404).json({ success: false, error: '年级不存在' });
    await prisma.$executeRawUnsafe(`DELETE FROM grades WHERE id = ?`, parseInt(id));
    await logOperation(req.user.id, req.user.username, '删除年级', `年级: ${grade.name}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /classes/:id - 删除班级
router.delete('/classes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let cls;
    try { cls = (await prisma.$queryRawUnsafe(`SELECT * FROM classes WHERE id = ?`, parseInt(id)))[0]; } catch (_) {}
    if (!cls) return res.status(404).json({ success: false, error: '班级不存在' });
    await prisma.$executeRawUnsafe(`DELETE FROM classes WHERE id = ?`, parseInt(id));
    await logOperation(req.user.id, req.user.username, '删除班级', `班级: ${cls.name}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 日志 ====================

// GET /logs - 操作日志
router.get('/logs', async (req, res) => {
  try {
    const { user_id, action } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const where = {};
    if (user_id) where.userId = parseInt(user_id);
    if (action) where.action = { contains: action };

    const [list, total] = await Promise.all([
      prisma.operationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.operationLog.count({ where })
    ]);

    res.json({
      success: true,
      data: { list, total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 仪表盘 ====================

// GET /dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      totalEvents,
      totalRegistrations,
      pendingRegistrations,
      approvedRegistrations,
      totalSchedules,
      publishedSchedules,
      draftSchedules,
      totalResults,
      publishedResults,
      awardedCount
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'student' } }),
      prisma.event.count({ where: { status: 'active' } }),
      prisma.registration.count(),
      prisma.registration.count({ where: { status: 'pending' } }),
      prisma.registration.count({ where: { status: 'approved' } }),
      prisma.schedule.count(),
      prisma.schedule.count({ where: { status: 'published' } }),
      prisma.schedule.count({ where: { status: 'draft' } }),
      prisma.result.count(),
      prisma.result.count({ where: { isPublished: 1 } }),
      prisma.result.count({ where: { award: { not: '' }, isPublished: 1 } })
    ]);

    const today = new Date().toISOString().split('T')[0];
    let todaySchedules = 0;
    try {
      todaySchedules = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM schedules WHERE date(start_time) = ?`, today
      ).then(r => r[0]?.cnt || 0);
    } catch (_) {}

    const recentLogs = await prisma.operationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({
      success: true, data: {
        total_users: totalUsers,
        total_events: totalEvents,
        total_registrations: totalRegistrations,
        pending_registrations: pendingRegistrations,
        approved_registrations: approvedRegistrations,
        total_schedules: totalSchedules,
        published_schedules: publishedSchedules,
        draft_schedules: draftSchedules,
        total_results: totalResults,
        published_results: publishedResults,
        awarded_count: awardedCount,
        today_schedules: todaySchedules,
        recent_logs: recentLogs
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
