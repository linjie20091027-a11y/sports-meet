const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const { getDb } = require('../database/init');
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

function paginate(query, params, page, limit) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (p - 1) * l;
  const db = getDb();
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM (${query})`).get(...params);
  const rows = db.prepare(`${query} LIMIT ? OFFSET ?`).all(...params, l, offset);
  return { list: rows, total: countRow.total, page: p, limit: l, totalPages: Math.ceil(countRow.total / l) };
}

// ==================== 系统设置 ====================

// PUT /settings - 修改系统设置
router.put('/settings', (req, res) => {
  try {
    const db = getDb();
    const { site_name, theme, start_date, end_date, registration_open, site_maintenance, logo_url, ...rest } = req.body;

    const settingsMap = { site_name, theme, timezone: rest.timezone };
    const updateSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','localtime')`);
    for (const [k, v] of Object.entries(settingsMap)) {
      if (v !== undefined) updateSetting.run(k, String(v));
    }

    const meetFields = {};
    if (start_date !== undefined) meetFields.start_date = start_date;
    if (end_date !== undefined) meetFields.end_date = end_date;
    if (registration_open !== undefined) meetFields.registration_open = registration_open ? 1 : 0;
    if (site_maintenance !== undefined) meetFields.site_maintenance = site_maintenance ? 1 : 0;
    if (logo_url !== undefined) meetFields.logo_url = logo_url;

    if (Object.keys(meetFields).length > 0) {
      const sets = Object.keys(meetFields).map(k => `${k} = ?`).join(', ');
      const vals = Object.values(meetFields);
      db.prepare(`UPDATE meet_info SET ${sets} WHERE id = 1`).run(...vals);
    }

    logOperation(req.user.id, req.user.username, '修改系统设置', JSON.stringify(req.body), getIp(req));
    res.json({ success: true, message: '设置已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /settings - 获取所有系统设置
router.get('/settings', (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT key, value FROM settings').all();
    const meet = db.prepare('SELECT * FROM meet_info WHERE id = 1').get();
    const data = {};
    settings.forEach(s => { data[s.key] = s.value; });
    if (meet) Object.assign(data, meet);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 用户管理 ====================

// GET /users - 用户列表
router.get('/users', (req, res) => {
  try {
    const { role, grade, class_name, status, keyword, page, limit } = req.query;
    let conditions = [];
    let params = [];

    if (role) { conditions.push('u.role = ?'); params.push(role); }
    if (grade) { conditions.push('u.grade = ?'); params.push(grade); }
    if (class_name) { conditions.push('u.class_name = ?'); params.push(class_name); }
    if (status) { conditions.push('u.status = ?'); params.push(status); }
    if (keyword) { conditions.push('(u.name LIKE ? OR u.username LIKE ? OR u.student_id LIKE ? OR u.email LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `SELECT u.id, u.username, u.email, u.role, u.student_id, u.name, u.class_name, u.grade, u.status, u.created_at FROM users u ${where} ORDER BY u.id DESC`;
    const result = paginate(query, params, page, limit);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /users - 添加单个学生
router.post('/users', (req, res) => {
  try {
    const db = getDb();
    const { username, email, password, name, student_id, class_name, grade } = req.body;
    if (!username || !email || !password || !name || !student_id || !class_name || !grade) {
      return res.status(400).json({ success: false, error: '所有字段必填' });
    }
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`INSERT INTO users (username, email, password, role, student_id, name, class_name, grade)
      VALUES (?, ?, ?, 'student', ?, ?, ?, ?)`).run(username, email, hash, student_id, name, class_name, grade);
    logOperation(req.user.id, req.user.username, '添加学生', `添加学生: ${name}(${student_id})`, getIp(req));
    res.json({ success: true, message: '添加成功' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: '用户名/邮箱/学号已存在' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /users/batch - 批量导入学生
router.post('/users/batch', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: '请上传Excel文件' });
    const db = getDb();
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const insert = db.prepare(`INSERT OR IGNORE INTO users (username, email, password, role, student_id, name, class_name, grade)
      VALUES (?, ?, ?, 'student', ?, ?, ?, ?)`);
    const hash = bcrypt.hashSync('123456', 10);
    let success = 0, fail = 0;

    // sql.js no transaction, inline calls
    (() => {
      for (const row of rows) {
        const studentId = String(row['学号'] || row['student_id'] || '');
        const name = String(row['姓名'] || row['name'] || '');
        const className = String(row['班级'] || row['class_name'] || '');
        const grade = String(row['年级'] || row['grade'] || '');
        if (!studentId || !name) { fail++; continue; }
        const username = studentId;
        const email = `${studentId}@hkms.hktedu.com`;
        const result = insert.run(username, email, hash, studentId, name, className, grade);
        result.changes > 0 ? success++ : fail++;
      }
    });
    })();

    logOperation(req.user.id, req.user.username, '批量导入学生', `成功${success}条，失败${fail}条`, getIp(req));
    res.json({ success: true, message: `导入完成：成功${success}条，失败${fail}条` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /users/:id - 编辑学生信息
router.put('/users/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, student_id, class_name, grade, email, username, role } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });

    const fields = {};
    if (name !== undefined) fields.name = name;
    if (student_id !== undefined) fields.student_id = student_id;
    if (class_name !== undefined) fields.class_name = class_name;
    if (grade !== undefined) fields.grade = grade;
    if (email !== undefined) fields.email = email;
    if (username !== undefined) fields.username = username;
    if (role !== undefined && ['admin', 'student'].includes(role) && user.id !== 1) {
      fields.role = role;
    }

    if (Object.keys(fields).length > 0) {
      fields.updated_at = `datetime('now','localtime')`;
      const sets = Object.keys(fields).map(k => k === 'updated_at' ? `updated_at = ${fields[k]}` : `${k} = ?`).join(', ');
      const vals = Object.entries(fields).filter(([k]) => k !== 'updated_at').map(([, v]) => v);
      db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...vals, id);
    }

    logOperation(req.user.id, req.user.username, '编辑学生信息', `编辑学生ID:${id}`, getIp(req));
    res.json({ success: true, message: '信息已更新' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: '用户名/邮箱/学号已存在' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /users/:id/reset-password - 重置密码
router.put('/users/:id/reset-password', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    const hash = bcrypt.hashSync('123456', 10);
    db.prepare('UPDATE users SET password = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(hash, id);
    logOperation(req.user.id, req.user.username, '重置密码', `重置用户ID:${id} 密码`, getIp(req));
    res.json({ success: true, message: '密码已重置为123456' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /users/:id/status - 禁用/启用
router.put('/users/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) return res.status(400).json({ success: false, error: '状态值无效' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    db.prepare('UPDATE users SET status = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(status, id);
    logOperation(req.user.id, req.user.username, status === 'active' ? '启用账号' : '禁用账号', `用户ID:${id}`, getIp(req));
    res.json({ success: true, message: status === 'active' ? '账号已启用' : '账号已禁用' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /users/:id - 删除学生
router.delete('/users/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    if (user.role === 'admin') return res.status(400).json({ success: false, error: '不能删除管理员' });
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    logOperation(req.user.id, req.user.username, '删除学生', `删除用户ID:${id} ${user.name}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /users/export - 导出学生名单
router.get('/users/export', (req, res) => {
  try {
    const db = getDb();
    const { grade, class_name } = req.query;
    let conditions = [];
    let params = [];
    if (grade) { conditions.push('u.grade = ?'); params.push(grade); }
    if (class_name) { conditions.push('u.class_name = ?'); params.push(class_name); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') + " AND u.role = 'student'" : "WHERE u.role = 'student'";
    const users = db.prepare(`SELECT u.student_id, u.name, u.class_name, u.grade, u.email, u.status FROM users u ${where} ORDER BY u.grade, u.class_name, u.student_id`).all(...params);
    res.json({ success: true, data: users });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 项目管理 ====================

// GET /events - 获取项目列表
router.get('/events', (req, res) => {
  try {
    const db = getDb();
    const { category, event_type, gender_group, status } = req.query;
    let conditions = [];
    let params = [];
    if (category) { conditions.push('category = ?'); params.push(category); }
    if (event_type) { conditions.push('event_type = ?'); params.push(event_type); }
    if (gender_group) { conditions.push('gender_group = ?'); params.push(gender_group); }
    if (status) { conditions.push('status = ?'); params.push(status); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const events = db.prepare(`SELECT * FROM events ${where} ORDER BY sort_order, id`).all(...params);
    res.json({ success: true, data: events });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /events - 添加项目
router.post('/events', (req, res) => {
  try {
    const db = getDb();
    const { name, category, event_type, gender_group, max_participants, rules, venue, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '项目名称必填' });
    const result = db.prepare(`INSERT INTO events (name, category, event_type, gender_group, max_participants, rules, venue, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      name, category || 'track', event_type || 'individual', gender_group || 'mixed',
      max_participants || 0, rules || '', venue || '', sort_order || 0
    );
    logOperation(req.user.id, req.user.username, '添加项目', `添加项目: ${name}`, getIp(req));
    res.json({ success: true, message: '项目已添加', data: { id: result.lastInsertRowid } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /events/:id - 编辑项目
router.put('/events/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!event) return res.status(404).json({ success: false, error: '项目不存在' });
    const fields = ['name', 'category', 'event_type', 'gender_group', 'max_participants', 'rules', 'venue', 'status', 'sort_order'];
    const sets = [];
    const vals = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
    });
    if (sets.length === 0) return res.json({ success: true, message: '无需更新' });
    vals.push(id);
    db.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    logOperation(req.user.id, req.user.username, '编辑项目', `编辑项目ID:${id}`, getIp(req));
    res.json({ success: true, message: '项目已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /events/:id - 删除项目
router.delete('/events/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!event) return res.status(404).json({ success: false, error: '项目不存在' });
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    logOperation(req.user.id, req.user.username, '删除项目', `删除项目ID:${id} ${event.name}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 报名规则 ====================

// GET /rules - 获取报名规则
router.get('/rules', (req, res) => {
  try {
    const db = getDb();
    const rules = db.prepare('SELECT * FROM registration_rules ORDER BY id').all();
    const data = {};
    rules.forEach(r => { data[r.rule_key] = r.rule_value; });
    res.json({ success: true, data: rules.length === 0 ? null : { rules: data, raw: rules } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /rules - 更新报名规则
router.put('/rules', (req, res) => {
  try {
    const db = getDb();
    const upsert = db.prepare(`INSERT INTO registration_rules (rule_key, rule_value, description) VALUES (?, ?, ?)
      ON CONFLICT(rule_key) DO UPDATE SET rule_value = excluded.rule_value`);
    for (const [key, val] of Object.entries(req.body)) {
      upsert.run(key, String(val), '');
    }
    logOperation(req.user.id, req.user.username, '更新报名规则', JSON.stringify(req.body), getIp(req));
    res.json({ success: true, message: '规则已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 报名管理 ====================

// GET /registrations - 报名记录
router.get('/registrations', (req, res) => {
  try {
    const db = getDb();
    const { event_id, grade, class_name, status, page, limit } = req.query;
    let conditions = [];
    let params = [];
    if (event_id) { conditions.push('r.event_id = ?'); params.push(event_id); }
    if (grade) { conditions.push('u.grade = ?'); params.push(grade); }
    if (class_name) { conditions.push('u.class_name = ?'); params.push(class_name); }
    if (status) { conditions.push('r.status = ?'); params.push(status); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `SELECT r.*, u.name as user_name, u.student_id, u.class_name, u.grade, e.name as event_name, e.category as event_category
      FROM registrations r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN events e ON r.event_id = e.id
      ${where} ORDER BY r.created_at DESC`;
    const result = paginate(query, params, page, limit);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /registrations/:id/approve - 审核通过
router.put('/registrations/:id/approve', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
    if (!reg) return res.status(404).json({ success: false, error: '报名记录不存在' });
    db.prepare("UPDATE registrations SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?").run(req.user.id, id);
    // 发送通知
    const event = db.prepare('SELECT name FROM events WHERE id = ?').get(reg.event_id);
    db.prepare("INSERT INTO notifications (user_id, type, title, content, target_url) VALUES (?, 'success', '报名已通过', ?, '/student')").run(
      reg.user_id, `您报名的【${event ? event.name : '项目'}】已通过审核，请查看赛程安排`
    );
    logOperation(req.user.id, req.user.username, '审核通过报名', `报名ID:${id}`, getIp(req));
    res.json({ success: true, message: '已通过' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /registrations/batch-approve - 批量通过
router.put('/registrations/batch-approve', (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: '请提供ID数组' });
    const stmt = db.prepare("UPDATE registrations SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?");
    const notiStmt = db.prepare("INSERT INTO notifications (user_id, type, title, content, target_url) VALUES (?,'success','报名已通过',?,'/student')");
    ids.forEach(id => {
      stmt.run(req.user.id, id);
      const reg = db.prepare('SELECT user_id, event_id FROM registrations WHERE id = ?').get(id);
      if (reg) {
        const event = db.prepare('SELECT name FROM events WHERE id = ?').get(reg.event_id);
        notiStmt.run(reg.user_id, `您报名的【${event ? event.name : '项目'}】已通过审核`);
      }
    });
    logOperation(req.user.id, req.user.username, '批量通过报名', `批量通过${ids.length}条报名`, getIp(req));
    res.json({ success: true, message: `已批量通过${ids.length}条报名` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /registrations/:id/reject - 驳回
router.put('/registrations/:id/reject', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { reason } = req.body;
    const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
    if (!reg) return res.status(404).json({ success: false, error: '报名记录不存在' });
    db.prepare("UPDATE registrations SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?").run(reason || '', req.user.id, id);
    // 发送通知
    const event = db.prepare('SELECT name FROM events WHERE id = ?').get(reg.event_id);
    db.prepare("INSERT INTO notifications (user_id, type, title, content, target_url) VALUES (?, 'warning', '报名已驳回', ?, '/student')").run(
      reg.user_id, `您报名的【${event ? event.name : '项目'}】已被驳回${reason ? '，原因：' + reason : ''}`
    );
    logOperation(req.user.id, req.user.username, '驳回报名', `报名ID:${id} 原因:${reason}`, getIp(req));
    res.json({ success: true, message: '已驳回' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /registrations/stats - 报名统计
router.get('/registrations/stats', (req, res) => {
  try {
    const db = getDb();
    const eventStats = db.prepare(`SELECT e.id, e.name, e.category, e.gender_group, COUNT(r.id) as count
      FROM events e LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'approved'
      GROUP BY e.id ORDER BY count DESC`).all();

    const classStats = db.prepare(`SELECT u.class_name, u.grade, COUNT(r.id) as count
      FROM users u LEFT JOIN registrations r ON u.id = r.user_id AND r.status = 'approved'
      WHERE u.role = 'student' GROUP BY u.class_name, u.grade ORDER BY u.grade, u.class_name`).all();

    const unregistered = db.prepare(`SELECT u.id, u.name, u.student_id, u.class_name, u.grade
      FROM users u WHERE u.role = 'student' AND u.status = 'active'
      AND u.id NOT IN (SELECT user_id FROM registrations WHERE status = 'approved') ORDER BY u.grade, u.class_name`).all();

    res.json({ success: true, data: { eventStats, classStats, unregistered } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /registrations/export - 导出报名表
router.get('/registrations/export', (req, res) => {
  try {
    const db = getDb();
    const registrations = db.prepare(`SELECT r.id, u.student_id, u.name, u.class_name, u.grade, e.name as event_name,
      e.category, e.gender_group, r.status, r.created_at
      FROM registrations r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN events e ON r.event_id = e.id
      ORDER BY u.grade, u.class_name, e.name`).all();
    res.json({ success: true, data: registrations });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /registrations/heatmap - 报名热度
router.get('/registrations/heatmap', (req, res) => {
  try {
    const db = getDb();
    const heatmap = db.prepare(`SELECT e.id, e.name, e.category, e.gender_group, e.max_participants,
      COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_count,
      COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_count,
      COUNT(r.id) as total_count
      FROM events e LEFT JOIN registrations r ON e.id = r.event_id
      GROUP BY e.id ORDER BY total_count DESC`).all();
    res.json({ success: true, data: heatmap });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 赛程编排 ====================

// GET /schedules - 所有赛程
router.get('/schedules', (req, res) => {
  try {
    const db = getDb();
    const { event_id, status, venue } = req.query;
    let conditions = [];
    let params = [];
    if (event_id) { conditions.push('s.event_id = ?'); params.push(event_id); }
    if (status) { conditions.push('s.status = ?'); params.push(status); }
    if (venue) { conditions.push('s.venue LIKE ?'); params.push(`%${venue}%`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const schedules = db.prepare(`SELECT s.*, e.name as event_name, e.category, e.gender_group
      FROM schedules s LEFT JOIN events e ON s.event_id = e.id
      ${where} ORDER BY s.start_time, s.id`).all(...params);
    res.json({ success: true, data: schedules });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /schedules - 创建赛程
router.post('/schedules', (req, res) => {
  try {
    const db = getDb();
    const { event_id, round_name, start_time, end_time, venue, max_heats, note } = req.body;
    if (!event_id || !start_time) return res.status(400).json({ success: false, error: '项目和开始时间必填' });
    const result = db.prepare(`INSERT INTO schedules (event_id, round_name, start_time, end_time, venue, max_heats, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(event_id, round_name || '预赛', start_time, end_time || '', venue || '', max_heats || 1, note || '');
    logOperation(req.user.id, req.user.username, '创建赛程', `赛程ID:${result.lastInsertRowid}`, getIp(req));
    res.json({ success: true, message: '赛程已创建', data: { id: result.lastInsertRowid } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /schedules/:id - 修改赛程
router.put('/schedules/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!schedule) return res.status(404).json({ success: false, error: '赛程不存在' });
    const fields = ['event_id', 'round_name', 'start_time', 'end_time', 'venue', 'max_heats', 'status', 'note'];
    const sets = [];
    const vals = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
    });
    if (sets.length === 0) return res.json({ success: true, message: '无需更新' });
    vals.push(id);
    db.prepare(`UPDATE schedules SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    logOperation(req.user.id, req.user.username, '修改赛程', `赛程ID:${id}`, getIp(req));
    res.json({ success: true, message: '赛程已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /schedules/:id - 删除赛程
router.delete('/schedules/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!schedule) return res.status(404).json({ success: false, error: '赛程不存在' });
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    logOperation(req.user.id, req.user.username, '删除赛程', `赛程ID:${id}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /schedules/auto - 自动编排
router.post('/schedules/auto', (req, res) => {
  try {
    const db = getDb();
    const { start_date, time_slots, venues } = req.body;

    const events = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM registrations WHERE event_id = e.id AND status = 'approved') as reg_count
      FROM events e WHERE e.status = 'active' ORDER BY e.sort_order`).all();

    const defaultTimeSlots = time_slots || [
      { start: '08:00', end: '09:30' }, { start: '09:30', end: '11:00' },
      { start: '14:00', end: '15:30' }, { start: '15:30', end: '17:00' }
    ];
    const defaultVenues = venues || ['田径场', '沙坑区', '投掷区', '篮球场'];

    const baseDate = start_date || '2026-06-01';
    const existingSchedules = db.prepare('SELECT * FROM schedules').all();

    const isConflict = (eventId, date, timeSlot, venue) => {
      return existingSchedules.some(s =>
        s.event_id === eventId &&
        s.start_time && s.start_time.startsWith(date) &&
        s.venue === venue &&
        ((s.start_time && `${date}T${timeSlot.start}` < s.end_time) && (`${date}T${timeSlot.end}` > s.start_time))
      );
    };

    let createdCount = 0;
    const insert = db.prepare(`INSERT INTO schedules (event_id, round_name, start_time, end_time, venue, max_heats) VALUES (?, ?, ?, ?, ?, ?)`);

    // sql.js no transaction, inline calls
    (() => {
      events.forEach((event, idx) => {
        const dayOffset = Math.floor(idx / (defaultTimeSlots.length * defaultVenues.length));
        const slotIdx = Math.floor(idx / defaultVenues.length) % defaultTimeSlots.length;
        const venueIdx = idx % defaultVenues.length;

        const date = new Date(baseDate);
        date.setDate(date.getDate() + dayOffset);
        const dateStr = date.toISOString().split('T')[0];
        const slot = defaultTimeSlots[slotIdx] || defaultTimeSlots[0];
        const venue = defaultVenues[venueIdx] || defaultVenues[0];

        if (isConflict(event.id, dateStr, slot, venue)) return;

        const heats = Math.max(1, Math.ceil(event.reg_count / 8));
        insert.run(event.id, '预赛', `${dateStr}T${slot.start}:00`, `${dateStr}T${slot.end}:00`, venue, heats);
        createdCount++;
      });
    });
    })();

    logOperation(req.user.id, req.user.username, '自动编排赛程', `创建${createdCount}个赛程`, getIp(req));
    res.json({ success: true, message: `自动编排完成，创建${createdCount}个赛程` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /schedules/publish - 批量发布
router.put('/schedules/publish', (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: '请提供ID数组' });
    const stmt = db.prepare("UPDATE schedules SET status = 'published' WHERE id = ?");
    // sql.js no transaction, inline calls
    (() => {       ids.forEach(id => stmt.run(req.user.id, id));
    })();
    logOperation(req.user.id, req.user.username, '发布赛程', `批量发布${ids.length}个赛程`, getIp(req));
    res.json({ success: true, message: `已发布${ids.length}个赛程` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /schedules/export - 导出赛程表
router.get('/schedules/export', (req, res) => {
  try {
    const db = getDb();
    const schedules = db.prepare(`SELECT s.id, e.name as event_name, e.category, e.gender_group,
      s.round_name, s.start_time, s.end_time, s.venue, s.max_heats, s.status, s.note
      FROM schedules s LEFT JOIN events e ON s.event_id = e.id ORDER BY s.start_time, s.id`).all();
    res.json({ success: true, data: schedules });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 成绩管理 ====================

// GET /results - 所有成绩
router.get('/results', (req, res) => {
  try {
    const db = getDb();
    const { event_id, schedule_id, grade, class_name, award, is_published, page, limit } = req.query;
    let conditions = [];
    let params = [];
    if (event_id) { conditions.push('e.id = ?'); params.push(event_id); }
    if (schedule_id) { conditions.push('r.schedule_id = ?'); params.push(schedule_id); }
    if (grade) { conditions.push('u.grade = ?'); params.push(grade); }
    if (class_name) { conditions.push('u.class_name = ?'); params.push(class_name); }
    if (award) { conditions.push('r.award = ?'); params.push(award); }
    if (is_published !== undefined) { conditions.push('r.is_published = ?'); params.push(parseInt(is_published)); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `SELECT r.*, u.name as user_name, u.student_id, u.class_name, u.grade,
      e.name as event_name, e.category as event_category, s.round_name, s.start_time
      FROM results r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN schedules s ON r.schedule_id = s.id
      LEFT JOIN events e ON s.event_id = e.id
      ${where} ORDER BY r.rank, r.id`;
    const result = paginate(query, params, page, limit);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /results - 录入成绩
router.post('/results', (req, res) => {
  try {
    const db = getDb();
    const { schedule_id, user_id, performance, award } = req.body;
    if (!schedule_id || !user_id) return res.status(400).json({ success: false, error: '赛程和用户必填' });
    db.prepare(`INSERT INTO results (schedule_id, user_id, performance, award, recorded_by)
      VALUES (?, ?, ?, ?, ?)`).run(schedule_id, user_id, performance || '', award || '', req.user.id);
    logOperation(req.user.id, req.user.username, '录入成绩', `赛程ID:${schedule_id} 用户ID:${user_id}`, getIp(req));
    res.json({ success: true, message: '成绩已录入' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: '该用户在此赛程已有成绩' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /results/batch - 批量导入成绩
router.post('/results/batch', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: '请上传Excel文件' });
    const db = getDb();
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let success = 0, fail = 0;
    const insert = db.prepare('INSERT INTO results (schedule_id, user_id, performance, award, recorded_by) VALUES (?, ?, ?, ?, ?)');

    // sql.js no transaction, inline calls
    (() => {
      for (const row of rows) {
        const scheduleId = row['赛程ID'] || row['schedule_id'];
        const userId = row['用户ID'] || row['user_id'];
        const performance = String(row['成绩'] || row['performance'] || '');
        const award = String(row['奖项'] || row['award'] || '');
        if (!scheduleId || !userId) { fail++; continue; }
        try {
          insert.run(scheduleId, userId, performance, award, req.user.id);
          success++;
        } catch { fail++; }
      }
    });
    })();

    logOperation(req.user.id, req.user.username, '批量导入成绩', `成功${success}条，失败${fail}条`, getIp(req));
    res.json({ success: true, message: `导入完成：成功${success}条，失败${fail}条` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /results/:id - 修改成绩
router.put('/results/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const result = db.prepare('SELECT * FROM results WHERE id = ?').get(id);
    if (!result) return res.status(404).json({ success: false, error: '成绩记录不存在' });

    const fields = ['schedule_id', 'user_id', 'performance', 'award', 'score', 'note'];
    const sets = [];
    const vals = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
    });
    if (sets.length === 0) return res.json({ success: true, message: '无需更新' });
    vals.push(id);
    db.prepare(`UPDATE results SET ${sets.join(', ')}, updated_at = datetime('now','localtime') WHERE id = ?`).run(...vals);
    logOperation(req.user.id, req.user.username, '修改成绩', `成绩ID:${id}`, getIp(req));
    res.json({ success: true, message: '成绩已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /results/:id - 删除成绩
router.delete('/results/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const result = db.prepare('SELECT * FROM results WHERE id = ?').get(id);
    if (!result) return res.status(404).json({ success: false, error: '成绩记录不存在' });
    db.prepare('DELETE FROM results WHERE id = ?').run(id);
    logOperation(req.user.id, req.user.username, '删除成绩', `成绩ID:${id}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /results/auto-rank - 自动排名
router.post('/results/auto-rank', (req, res) => {
  try {
    const db = getDb();
    const scheduleIds = db.prepare('SELECT DISTINCT schedule_id FROM results').all().map(r => r.schedule_id);

    const updateRank = db.prepare('UPDATE results SET rank = ? WHERE id = ?');
    let rankedCount = 0;

    // sql.js no transaction, inline calls
    (() => {
      for (const schedId of scheduleIds) {
        const schedule = db.prepare('SELECT s.*, e.category FROM schedules s JOIN events e ON s.event_id = e.id WHERE s.id = ?').get(schedId);
        if (!schedule) continue;

        const results = db.prepare('SELECT * FROM results WHERE schedule_id = ? AND performance != \'\'').all(schedId);
        if (results.length === 0) continue;

        const sorted = results.sort((a, b) => {
          const pa = parseFloat(a.performance);
          const pb = parseFloat(b.performance);
          if (isNaN(pa) && isNaN(pb)) return 0;
          if (isNaN(pa)) return 1;
          if (isNaN(pb)) return -1;
          return pa - pb;
        });

        sorted.forEach((r, i) => {
          updateRank.run(i + 1, r.id);
          rankedCount++;
        });
      }
    });
    })();

    logOperation(req.user.id, req.user.username, '自动排名', `已排名${rankedCount}条成绩`, getIp(req));
    res.json({ success: true, message: `自动排名完成，已排名${rankedCount}条成绩` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /results/publish - 公示成绩
router.put('/results/publish', (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: '请提供ID数组' });
    const stmt = db.prepare('UPDATE results SET is_published = 1 WHERE id = ?');
    // sql.js no transaction, inline calls
    (() => {       ids.forEach(id => stmt.run(req.user.id, id));
    })();
    logOperation(req.user.id, req.user.username, '公示成绩', `公示${ids.length}条`, getIp(req));
    res.json({ success: true, message: `已公示${ids.length}条成绩` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /results/unpublish - 撤回公示
router.put('/results/unpublish', (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: '请提供ID数组' });
    const stmt = db.prepare('UPDATE results SET is_published = 0 WHERE id = ?');
    // sql.js no transaction, inline calls
    (() => {       ids.forEach(id => stmt.run(req.user.id, id));
    })();
    logOperation(req.user.id, req.user.username, '撤回成绩公示', `撤回${ids.length}条`, getIp(req));
    res.json({ success: true, message: `已撤回${ids.length}条成绩公示` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /results/export - 导出获奖名单
router.get('/results/export', (req, res) => {
  try {
    const db = getDb();
    const results = db.prepare(`SELECT r.id, u.student_id, u.name, u.class_name, u.grade,
      e.name as event_name, e.category, s.round_name, r.performance, r.rank, r.award, r.score, r.is_published
      FROM results r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN schedules s ON r.schedule_id = s.id
      LEFT JOIN events e ON s.event_id = e.id
      WHERE r.award != '' ORDER BY r.is_published DESC, r.award, r.rank`).all();
    res.json({ success: true, data: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 数据统计 ====================

// GET /stats/class - 班级统计
router.get('/stats/class', (req, res) => {
  try {
    const db = getDb();
    const stats = db.prepare(`SELECT
      u.class_name, u.grade,
      COUNT(DISTINCT u.id) as total_students,
      COUNT(DISTINCT r.user_id) as registered_count,
      ROUND(CAST(COUNT(DISTINCT r.user_id) AS FLOAT) / NULLIF(COUNT(DISTINCT u.id), 0) * 100, 1) as reg_rate,
      COUNT(DISTINCT CASE WHEN res.award != '' THEN res.user_id END) as awarded_count,
      COALESCE(SUM(res.score), 0) as total_score
      FROM users u
      LEFT JOIN registrations r ON u.id = r.user_id AND r.status = 'approved'
      LEFT JOIN results res ON u.id = res.user_id
      WHERE u.role = 'student'
      GROUP BY u.class_name, u.grade ORDER BY total_score DESC, reg_rate DESC`).all();
    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /stats/grade - 年级统计
router.get('/stats/grade', (req, res) => {
  try {
    const db = getDb();
    const stats = db.prepare(`SELECT
      u.grade,
      COUNT(DISTINCT u.id) as total_students,
      COUNT(DISTINCT r.user_id) as registered_count,
      COUNT(DISTINCT CASE WHEN res.award != '' THEN res.user_id END) as awarded_count,
      COUNT(DISTINCT CASE WHEN res.award = '一等' THEN res.user_id END) as first_prize,
      COUNT(DISTINCT CASE WHEN res.award = '二等' THEN res.user_id END) as second_prize,
      COUNT(DISTINCT CASE WHEN res.award = '三等' THEN res.user_id END) as third_prize,
      COALESCE(SUM(res.score), 0) as total_score
      FROM users u
      LEFT JOIN registrations r ON u.id = r.user_id AND r.status = 'approved'
      LEFT JOIN results res ON u.id = res.user_id
      WHERE u.role = 'student'
      GROUP BY u.grade ORDER BY total_score DESC`).all();
    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /stats/export - 导出统计报表
router.get('/stats/export', (req, res) => {
  try {
    const db = getDb();
    const classStats = db.prepare(`SELECT
      u.class_name, u.grade,
      COUNT(DISTINCT u.id) as total_students,
      COUNT(DISTINCT r.user_id) as registered_count,
      ROUND(CAST(COUNT(DISTINCT r.user_id) AS FLOAT) / NULLIF(COUNT(DISTINCT u.id), 0) * 100, 1) as reg_rate,
      COUNT(DISTINCT CASE WHEN res.award != '' THEN res.user_id END) as awarded_count,
      COALESCE(SUM(res.score), 0) as total_score
      FROM users u
      LEFT JOIN registrations r ON u.id = r.user_id AND r.status = 'approved'
      LEFT JOIN results res ON u.id = res.user_id
      WHERE u.role = 'student'
      GROUP BY u.class_name, u.grade ORDER BY total_score DESC`).all();

    const eventStats = db.prepare(`SELECT e.name, e.category, e.gender_group,
      COUNT(r.id) as reg_count, COUNT(res.id) as result_count
      FROM events e LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'approved'
      LEFT JOIN results res ON r.user_id = res.user_id
      GROUP BY e.id ORDER BY reg_count DESC`).all();

    const awardSummary = db.prepare(`SELECT u.class_name, u.grade, res.award, COUNT(*) as count
      FROM results res JOIN users u ON res.user_id = u.id
      WHERE res.award != '' GROUP BY u.class_name, u.grade, res.award ORDER BY u.grade, u.class_name, res.award`).all();

    res.json({ success: true, data: { classStats, eventStats, awardSummary } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 公告管理 ====================

// GET /announcements - 管理员查看所有公告
router.get('/announcements', (req, res) => {
  try {
    const db = getDb();
    const { category, status, page, limit } = req.query;
    let conditions = [];
    let params = [];
    if (category) { conditions.push('a.category = ?'); params.push(category); }
    if (status) { conditions.push('a.status = ?'); params.push(status); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `SELECT a.*, u.name as publisher_name FROM announcements a
      LEFT JOIN users u ON a.published_by = u.id ${where} ORDER BY a.is_pinned DESC, a.created_at DESC`;
    const result = paginate(query, params, page, limit);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /announcements - 发布公告
router.post('/announcements', (req, res) => {
  try {
    const db = getDb();
    const { title, content, category, is_pinned, expire_time, status } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: '标题和内容必填' });
    const pubStatus = status || 'published';
    const publishTime = pubStatus === 'published' ? "datetime('now','localtime')" : 'NULL';
    const result = db.prepare(`INSERT INTO announcements (title, content, category, is_pinned, published_by, publish_time, expire_time, status)
      VALUES (?, ?, ?, ?, ?, ${publishTime}, ?, ?)`).run(
      title, content, category || 'general', is_pinned ? 1 : 0, req.user.id, expire_time || null, pubStatus
    );
    logOperation(req.user.id, req.user.username, '发布公告', `公告: ${title}`, getIp(req));
    res.json({ success: true, message: '公告已发布', data: { id: result.lastInsertRowid } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /announcements/:id - 编辑公告
router.put('/announcements/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    if (!announcement) return res.status(404).json({ success: false, error: '公告不存在' });

    const fields = ['title', 'content', 'category', 'is_pinned', 'expire_time', 'status'];
    const sets = [];
    const vals = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (f === 'is_pinned') { sets.push('is_pinned = ?'); vals.push(req.body[f] ? 1 : 0); }
        else { sets.push(`${f} = ?`); vals.push(req.body[f]); }
      }
    });
    if (req.body.status === 'published' && announcement.status !== 'published') {
      sets.push("publish_time = datetime('now','localtime')");
    }
    if (sets.length === 0) return res.json({ success: true, message: '无需更新' });
    vals.push(id);
    db.prepare(`UPDATE announcements SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    logOperation(req.user.id, req.user.username, '编辑公告', `公告ID:${id}`, getIp(req));
    res.json({ success: true, message: '公告已更新' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /announcements/:id - 删除公告
router.delete('/announcements/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    if (!announcement) return res.status(404).json({ success: false, error: '公告不存在' });
    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    logOperation(req.user.id, req.user.username, '删除公告', `公告ID:${id}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /announcements/:id/pin - 置顶/取消置顶
router.put('/announcements/:id/pin', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    if (!announcement) return res.status(404).json({ success: false, error: '公告不存在' });
    const newPinned = announcement.is_pinned ? 0 : 1;
    db.prepare('UPDATE announcements SET is_pinned = ? WHERE id = ?').run(newPinned, id);
    logOperation(req.user.id, req.user.username, `${newPinned ? '置顶' : '取消置顶'}公告`, `公告ID:${id}`, getIp(req));
    res.json({ success: true, message: newPinned ? '已置顶' : '已取消置顶' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 年级班级管理 ====================

// GET /grades - 获取年级和班级
router.get('/grades', (req, res) => {
  try {
    const db = getDb();
    const grades = db.prepare('SELECT * FROM grades ORDER BY sort_order').all();
    const classes = db.prepare('SELECT c.*, g.name as grade_name FROM classes c JOIN grades g ON c.grade_id = g.id ORDER BY g.sort_order, c.sort_order').all();
    res.json({ success: true, data: { grades, classes } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /grades - 添加年级
router.post('/grades', (req, res) => {
  try {
    const db = getDb();
    const { name, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '年级名称必填' });
    const result = db.prepare('INSERT INTO grades (name, sort_order) VALUES (?, ?)').run(name, sort_order || 0);
    logOperation(req.user.id, req.user.username, '添加年级', `年级: ${name}`, getIp(req));
    res.json({ success: true, message: '年级已添加', data: { id: result.lastInsertRowid } });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: '年级已存在' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /classes - 添加班级
router.post('/classes', (req, res) => {
  try {
    const db = getDb();
    const { grade_id, name, sort_order } = req.body;
    if (!grade_id || !name) return res.status(400).json({ success: false, error: '年级和班级名称必填' });
    const result = db.prepare('INSERT INTO classes (grade_id, name, sort_order) VALUES (?, ?, ?)').run(grade_id, name, sort_order || 0);
    logOperation(req.user.id, req.user.username, '添加班级', `班级: ${name}`, getIp(req));
    res.json({ success: true, message: '班级已添加', data: { id: result.lastInsertRowid } });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: '该年级下班级已存在' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /grades/:id - 删除年级
router.delete('/grades/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const grade = db.prepare('SELECT * FROM grades WHERE id = ?').get(id);
    if (!grade) return res.status(404).json({ success: false, error: '年级不存在' });
    db.prepare('DELETE FROM grades WHERE id = ?').run(id);
    logOperation(req.user.id, req.user.username, '删除年级', `年级: ${grade.name}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /classes/:id - 删除班级
router.delete('/classes/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
    if (!cls) return res.status(404).json({ success: false, error: '班级不存在' });
    db.prepare('DELETE FROM classes WHERE id = ?').run(id);
    logOperation(req.user.id, req.user.username, '删除班级', `班级: ${cls.name}`, getIp(req));
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 日志 ====================

// GET /logs - 操作日志
router.get('/logs', (req, res) => {
  try {
    const db = getDb();
    const { user_id, action, page, limit } = req.query;
    let conditions = [];
    let params = [];
    if (user_id) { conditions.push('user_id = ?'); params.push(user_id); }
    if (action) { conditions.push('action LIKE ?'); params.push(`%${action}%`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `SELECT * FROM operation_logs ${where} ORDER BY created_at DESC`;
    const result = paginate(query, params, page, limit);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /schedules/:id/participants
router.get('/schedules/:id/participants', (req, res) => {
  try {
    const db = getDb();
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
    if (!schedule) return res.json({ success: false, error: '赛程不存在' });
    const participants = db.prepare(`
      SELECT u.id, u.name, u.student_id, u.class_name, u.grade, r.id as registration_id, r.created_at as registration_time
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      WHERE r.event_id = ? AND r.status = 'approved'
      ORDER BY u.class_name, u.name
    `).all(schedule.event_id);
    res.json({ success: true, data: participants });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /dashboard
router.get('/dashboard', (req, res) => {
  try {
    const db = getDb();
    const totalUsers = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role='student'").get().cnt;
    const totalEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE status='active'").get().cnt;
    const totalRegistrations = db.prepare("SELECT COUNT(*) as cnt FROM registrations").get().cnt;
    const pendingRegistrations = db.prepare("SELECT COUNT(*) as cnt FROM registrations WHERE status='pending'").get().cnt;
    const approvedRegistrations = db.prepare("SELECT COUNT(*) as cnt FROM registrations WHERE status='approved'").get().cnt;
    const totalSchedules = db.prepare("SELECT COUNT(*) as cnt FROM schedules").get().cnt;
    const publishedSchedules = db.prepare("SELECT COUNT(*) as cnt FROM schedules WHERE status='published'").get().cnt;
    const draftSchedules = db.prepare("SELECT COUNT(*) as cnt FROM schedules WHERE status='draft'").get().cnt;
    const totalResults = db.prepare("SELECT COUNT(*) as cnt FROM results").get().cnt;
    const publishedResults = db.prepare("SELECT COUNT(*) as cnt FROM results WHERE is_published=1").get().cnt;
    const awardedCount = db.prepare("SELECT COUNT(*) as cnt FROM results WHERE award != '' AND is_published=1").get().cnt;
    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = db.prepare("SELECT COUNT(*) as cnt FROM schedules WHERE date(start_time) = ?").get(today).cnt;
    const recentLogs = db.prepare("SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 10").all();
    
    res.json({ success: true, data: {
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
    }});
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
