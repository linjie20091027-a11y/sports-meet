const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');

// GET /api/public/meet-info
router.get('/meet-info', (req, res) => {
  try {
    const db = getDb();
    const info = db.prepare(`SELECT id, name, theme, start_date, end_date, registration_open, site_maintenance, logo_url, created_at FROM meet_info LIMIT 1`).get();
    res.json({ success: true, data: info || null });
  } catch (err) {
    res.status(500).json({ error: '获取运动会信息失败' });
  }
});

// GET /api/public/events
router.get('/events', (req, res) => {
  try {
    const db = getDb();
    let sql = `SELECT id, name, category, event_type, gender_group, max_participants, rules, venue, status, sort_order, created_at FROM events WHERE status = 'active'`;
    const conditions = [];
    const params = [];

    if (req.query.category) {
      conditions.push('category = ?');
      params.push(req.query.category);
    }
    if (req.query.gender_group) {
      conditions.push('gender_group = ?');
      params.push(req.query.gender_group);
    }
    if (req.query.event_type) {
      conditions.push('event_type = ?');
      params.push(req.query.event_type);
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY sort_order ASC, id ASC';

    const events = db.prepare(sql).all(...params);
    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ error: '获取项目列表失败' });
  }
});

// GET /api/public/events/:id
router.get('/events/:id', (req, res) => {
  try {
    const db = getDb();
    const event = db.prepare(`
      SELECT id, name, category, event_type, gender_group, max_participants, rules, venue, status, sort_order, created_at
      FROM events WHERE id = ?
    `).get(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, error: '項目不存在' });
    }

    const regCount = db.prepare(
      `SELECT COUNT(*) as cnt FROM registrations WHERE event_id = ? AND status != 'rejected'`
    ).get(req.params.id);
    const approvedCount = db.prepare(
      `SELECT COUNT(*) as cnt FROM registrations WHERE event_id = ? AND status = 'approved'`
    ).get(req.params.id);
    const schedules = db.prepare(`
      SELECT s.id, s.round_name, s.start_time, s.end_time, s.venue, s.status
      FROM schedules s WHERE s.event_id = ? AND s.status = 'published'
      ORDER BY s.start_time
    `).all(req.params.id);

    res.json({
      success: true,
      data: {
        ...event,
        registration_count: regCount.cnt,
        approved_count: approvedCount.cnt,
        schedules
      }
    });
  } catch (err) {
    res.status(500).json({ error: '获取项目详情失败' });
  }
});

// GET /api/public/schedules
router.get('/schedules', (req, res) => {
  try {
    const db = getDb();
    let sql = `SELECT s.id, s.event_id, e.name AS event_name, s.round_name, s.start_time, s.end_time, s.venue, s.max_heats, s.status, s.note, s.created_at FROM schedules s LEFT JOIN events e ON s.event_id = e.id WHERE s.status = 'published'`;
    const conditions = [];
    const params = [];

    if (req.query.date) {
      conditions.push('date(s.start_time) = date(?)');
      params.push(req.query.date);
    }
    if (req.query.venue) {
      conditions.push('s.venue LIKE ?');
      params.push(`%${req.query.venue}%`);
    }
    if (req.query.event_id) {
      conditions.push('s.event_id = ?');
      params.push(req.query.event_id);
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY s.start_time ASC';

    const schedules = db.prepare(sql).all(...params);
    res.json({ success: true, data: schedules });
  } catch (err) {
    res.status(500).json({ error: '获取赛程列表失败' });
  }
});

// GET /api/public/results
router.get('/results', (req, res) => {
  try {
    const db = getDb();
    let sql = `SELECT r.id, r.schedule_id, r.user_id, u.name AS user_name, u.name, u.student_id, u.class_name, u.grade, COALESCE(u.gender, 'male') AS user_gender, COALESCE(u.sport_group, 'A') AS user_sport_group, r.performance, r.rank, r.score, r.award, r.note, r.created_at, r.updated_at, e.name AS event_name, e.category, s.round_name FROM results r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN schedules s ON r.schedule_id = s.id LEFT JOIN events e ON s.event_id = e.id WHERE r.is_published = 1`;
    const conditions = [];
    const params = [];

    if (req.query.event_id) {
      conditions.push('r.schedule_id IN (SELECT id FROM schedules WHERE event_id = ?)');
      params.push(req.query.event_id);
    }
    if (req.query.grade) {
      conditions.push('u.grade = ?');
      params.push(req.query.grade);
    }
    if (req.query.class_name) {
      conditions.push('u.class_name LIKE ?');
      params.push(`%${req.query.class_name}%`);
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY r.created_at DESC';

    const results = db.prepare(sql).all(...params);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ error: '获取成绩列表失败' });
  }
});

// GET /api/public/results/export
router.get('/results/export', (req, res) => {
  try {
    const db = getDb();
    let sql = `SELECT r.id, r.performance, r.rank, r.score, r.award, r.note, u.name AS user_name, u.student_id, u.class_name, u.grade, COALESCE(u.gender, 'male') AS user_gender, COALESCE(u.sport_group, 'A') AS user_sport_group, e.name AS event_name, e.category, e.event_type, e.gender_group, s.round_name, s.start_time FROM results r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN schedules s ON r.schedule_id = s.id LEFT JOIN events e ON s.event_id = e.id WHERE r.is_published = 1`;
    const conditions = [];
    const params = [];

    if (req.query.event_id) {
      conditions.push('e.id = ?');
      params.push(req.query.event_id);
    }
    if (req.query.grade) {
      conditions.push('u.grade = ?');
      params.push(req.query.grade);
    }
    if (req.query.class_name) {
      conditions.push('u.class_name LIKE ?');
      params.push(`%${req.query.class_name}%`);
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY e.name ASC, r.rank ASC';

    const results = db.prepare(sql).all(...params);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ error: '导出成绩数据失败' });
  }
});

// GET /api/public/results/rankings
router.get('/results/rankings', (req, res) => {
  try {
    const db = getDb();
    let sql = `SELECT e.id AS event_id, e.name AS event_name, e.category, e.gender_group, r.rank, r.score, r.award, r.performance, u.id AS user_id, u.name AS user_name, u.student_id, u.class_name, u.grade FROM results r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN schedules s ON r.schedule_id = s.id LEFT JOIN events e ON s.event_id = e.id WHERE r.is_published = 1 AND r.rank > 0`;
    const params = [];

    if (req.query.event_id) {
      sql += ' AND e.id = ?';
      params.push(req.query.event_id);
    }
    if (req.query.grade) {
      sql += ' AND u.grade = ?';
      params.push(req.query.grade);
    }

    sql += ' ORDER BY e.sort_order ASC, e.id ASC, r.rank ASC';

    const rows = db.prepare(sql).all(...params);

    const grouped = {};
    rows.forEach(row => {
      const key = `${row.event_id}_${row.gender_group || ''}`;
      if (!grouped[key]) {
        grouped[key] = {
          event_id: row.event_id,
          event_name: row.event_name,
          category: row.category,
          gender_group: row.gender_group,
          rankings: []
        };
      }
      grouped[key].rankings.push({
        rank: row.rank,
        score: row.score,
        award: row.award,
        performance: row.performance,
        user_id: row.user_id,
        user_name: row.user_name,
        student_id: row.student_id,
        class_name: row.class_name,
        grade: row.grade
      });
    });

    res.json({ success: true, data: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ error: '获取获奖榜单失败' });
  }
});

// GET /api/public/announcements
router.get('/announcements', (req, res) => {
  try {
    const db = getDb();
    let sql = `SELECT a.id, a.title, a.category, a.is_pinned, a.publish_time, a.expire_time, a.view_count, a.created_at, u.name AS publisher_name FROM announcements a LEFT JOIN users u ON a.published_by = u.id WHERE a.status = 'published' AND (a.expire_time IS NULL OR a.expire_time >= datetime('now','localtime'))`;
    const params = [];

    if (req.query.category) {
      sql += ' AND a.category = ?';
      params.push(req.query.category);
    }

    sql += ' ORDER BY a.is_pinned DESC, a.publish_time DESC';

    const announcements = db.prepare(sql).all(...params);
    res.json({ success: true, data: announcements });
  } catch (err) {
    res.status(500).json({ error: '获取公告列表失败' });
  }
});

// GET /api/public/announcements/:id
router.get('/announcements/:id', (req, res) => {
  try {
    const db = getDb();
    const announcement = db.prepare(`SELECT a.id, a.title, a.content, a.category, a.is_pinned, a.publish_time, a.expire_time, a.view_count, a.created_at, u.name AS publisher_name FROM announcements a LEFT JOIN users u ON a.published_by = u.id WHERE a.id = ? AND a.status = 'published'`).get(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: '公告不存在或已下架' });
    }

    db.prepare(`UPDATE announcements SET view_count = view_count + 1 WHERE id = ?`).run(req.params.id);

    res.json({
      success: true,
      data: { ...announcement, view_count: announcement.view_count + 1 }
    });
  } catch (err) {
    res.status(500).json({ error: '获取公告详情失败' });
  }
});

// GET /api/public/grades
router.get('/grades', (req, res) => {
  try {
    const db = getDb();
    const grades = db.prepare(`SELECT id, name, sort_order FROM grades ORDER BY sort_order ASC`).all();
    const classStmt = db.prepare(`SELECT id, grade_id, name, sort_order FROM classes WHERE grade_id = ? ORDER BY sort_order ASC`);

    const data = grades.map(g => ({
      ...g,
      classes: classStmt.all(g.id)
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: '获取年级列表失败' });
  }
});

// GET /api/public/search
router.get('/search', (req, res) => {
  try {
    const db = getDb();
    const q = req.query.q;
    if (!q || !q.trim()) {
      return res.json({ success: true, data: { events: [], students: [], announcements: [], schedules: [], results: [], posts: [] } });
    }

    const keyword = `%${q.trim()}%`;

    const events = db.prepare(`SELECT id, name, category, event_type, gender_group, venue FROM events WHERE name LIKE ? AND status = 'active' LIMIT 8`).all(keyword);

    const students = db.prepare(`SELECT id, name, student_id, class_name, grade FROM users WHERE (name LIKE ? OR student_id LIKE ? OR class_name LIKE ?) AND role = 'student' AND status = 'active' LIMIT 8`).all(keyword, keyword, keyword);

    const announcements = db.prepare(`SELECT a.id, a.title, a.category, a.is_pinned, a.publish_time, u.name AS publisher_name FROM announcements a LEFT JOIN users u ON a.published_by = u.id WHERE a.title LIKE ? AND a.status = 'published' AND (a.expire_time IS NULL OR a.expire_time >= datetime('now','localtime')) ORDER BY a.is_pinned DESC, a.publish_time DESC LIMIT 8`).all(keyword);

    const schedules = db.prepare(`SELECT s.id, e.name AS event_name, s.round_name, s.start_time, s.venue, s.status FROM schedules s LEFT JOIN events e ON s.event_id = e.id WHERE (e.name LIKE ? OR s.round_name LIKE ? OR s.venue LIKE ?) LIMIT 8`).all(keyword, keyword, keyword);

    const results = db.prepare(`SELECT r.id, u.name AS user_name, e.name AS event_name, r.performance, r.rank, r.award FROM results r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN schedules s ON r.schedule_id = s.id LEFT JOIN events e ON s.event_id = e.id WHERE (e.name LIKE ? OR u.name LIKE ?) AND r.is_published = 1 ORDER BY r.rank LIMIT 8`).all(keyword, keyword);

    const posts = db.prepare(`SELECT p.id, p.title, p.content, p.reply_count, p.view_count, p.created_at, u.name AS author_name FROM forum_posts p LEFT JOIN users u ON p.user_id = u.id WHERE (p.title LIKE ? OR p.content LIKE ?) AND p.is_deleted = 0 ORDER BY p.updated_at DESC LIMIT 8`).all(keyword, keyword);

    res.json({
      success: true,
      data: { events, students, announcements, schedules, results, posts }
    });
  } catch (err) {
    res.status(500).json({ error: '搜索失败' });
  }
});

// GET /api/public/stats/overview
router.get('/stats/overview', (req, res) => {
  try {
    const db = getDb();

    const totalReg = db.prepare(`SELECT COUNT(*) AS cnt FROM registrations WHERE status = 'approved'`).get();
    const totalEvents = db.prepare(`SELECT COUNT(*) AS cnt FROM events WHERE status = 'active'`).get();
    const completedSchedules = db.prepare(`SELECT COUNT(*) AS cnt FROM schedules WHERE status = 'published'`).get();
    const publishedResults = db.prepare(`SELECT COUNT(*) AS cnt FROM results WHERE is_published = 1`).get();

    res.json({
      success: true,
      data: {
        total_registrations: totalReg.cnt,
        total_events: totalEvents.cnt,
        completed_schedules: completedSchedules.cnt,
        published_results: publishedResults.cnt
      }
    });
  } catch (err) {
    res.status(500).json({ error: '获取统计概览失败' });
  }
});

module.exports = router;
