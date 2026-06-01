const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { getDb } = require('../database/init');

const SEARCH_TYPES = ['all', 'users', 'events', 'news', 'announcements', 'results', 'highlights'];
const HIGHLIGHT_DIR = path.join(__dirname, '..', 'public', 'images');

let highlightCache = {
  key: '',
  items: []
};

function clampInteger(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeSearchType(value) {
  return SEARCH_TYPES.includes(value) ? value : 'all';
}

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  const categoryMap = {
    track: 'track',
    field: 'field',
    relay: 'relay',
    team: 'team',
    '径赛': 'track',
    '田赛': 'field',
    '接力': 'relay',
    '趣味项目': 'team',
    '趣味': 'team'
  };
  return categoryMap[raw] || '';
}

function getCategoryLabel(category) {
  const labelMap = {
    track: '径赛',
    field: '田赛',
    relay: '接力',
    team: '趣味项目'
  };
  return labelMap[category] || category || '未分类';
}

function getUserRoleLabel(role) {
  return role === 'admin' ? '管理员' : '学生';
}

function splitSearchTerms(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
}

function matchTerms(values, terms) {
  if (!terms.length) return true;
  const haystack = values
    .filter(value => value !== null && value !== undefined)
    .map(value => String(value).toLowerCase());
  return terms.every(term => haystack.some(value => value.includes(term)));
}

function buildPagination(rows, page, limit) {
  const total = rows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (currentPage - 1) * limit;
  return {
    total,
    total_pages: totalPages,
    page: currentPage,
    items: rows.slice(start, start + limit)
  };
}

function getHighlightItems() {
  try {
    const files = fs
      .readdirSync(HIGHLIGHT_DIR)
      .filter(name => /\.(png|jpe?g|gif|webp)$/i.test(name))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const cacheKey = files.join('|');
    if (cacheKey === highlightCache.key) return highlightCache.items;

    highlightCache = {
      key: cacheKey,
      items: files.map((name, index) => ({
        id: `highlight-${index + 1}`,
        title: `精彩瞬间 ${index + 1}`,
        description: '校运会精彩图片记录',
        file_name: name,
        media_type: 'image',
        url: `/images/${encodeURIComponent(name)}`,
        created_at: '',
        tags: ['精彩', '瞬间', '图片', '照片', '校运会', '比赛', '运动会']
      }))
    };

    return highlightCache.items;
  } catch (_) {
    return [];
  }
}

function queryUsers(db, terms, filters) {
  const rows = db.prepare(`
    SELECT
      u.id,
      u.name,
      u.username,
      u.email,
      u.role,
      u.student_id,
      u.class_name,
      u.grade,
      u.avatar,
      u.created_at,
      COALESCE((
        SELECT GROUP_CONCAT(DISTINCT e.name)
        FROM registrations r
        LEFT JOIN events e ON e.id = r.event_id
        WHERE r.user_id = u.id AND r.status != 'rejected'
      ), '') AS event_names
    FROM users u
    WHERE u.status = 'active'
    ORDER BY u.updated_at DESC, u.id DESC
  `).all();

  return rows
    .filter(row => {
      if (!matchTerms([
        row.name,
        row.username,
        row.email,
        row.role,
        getUserRoleLabel(row.role),
        row.student_id,
        row.class_name,
        row.grade,
        row.event_names
      ], terms)) {
        return false;
      }
      if (filters.department && !matchTerms([row.class_name, row.grade], splitSearchTerms(filters.department))) {
        return false;
      }
      if (filters.participant_event && !matchTerms([row.event_names], splitSearchTerms(filters.participant_event))) {
        return false;
      }
      return true;
    })
    .map(row => {
      const eventNames = row.event_names ? row.event_names.split(',').filter(Boolean) : [];
      const department = [row.grade, row.class_name].filter(Boolean).join(' ');
      const account = row.username || row.email || row.student_id || '';
      const roleLabel = getUserRoleLabel(row.role);
      const subtitleParts = [`账号 ${account || '-'}`, roleLabel];
      if (department) subtitleParts.push(department);
      return {
        id: row.id,
        user_id: row.id,
        type: 'users',
        title: row.name,
        description: eventNames.length
          ? `参赛项目：${eventNames.join(' / ')}`
          : (row.role === 'admin' ? '系统管理账号' : '暂未报名项目'),
        subtitle: subtitleParts.join(' · '),
        avatar: row.avatar || '',
        account,
        student_id: row.student_id || '',
        role: row.role,
        role_label: roleLabel,
        department,
        events: eventNames,
        href: '',
        sort_time: row.created_at || ''
      };
    });
}

function queryEvents(db, terms, filters) {
  const rows = db.prepare(`
    SELECT
      e.id,
      e.name,
      e.category,
      e.event_type,
      e.gender_group,
      e.venue,
      e.description,
      e.created_at,
      MIN(s.start_time) AS earliest_time,
      MAX(s.end_time) AS latest_time,
      COUNT(DISTINCT CASE WHEN r.status != 'rejected' THEN r.user_id END) AS participant_count,
      COALESCE(GROUP_CONCAT(DISTINCT u.grade), '') AS grade_list,
      COALESCE(GROUP_CONCAT(DISTINCT COALESCE(s.venue, e.venue)), '') AS venue_list
    FROM events e
    LEFT JOIN schedules s ON s.event_id = e.id
    LEFT JOIN registrations r ON r.event_id = e.id
    LEFT JOIN users u ON u.id = r.user_id
    WHERE e.status = 'active'
    GROUP BY e.id
    ORDER BY e.sort_order ASC, e.id ASC
  `).all();

  const normalizedCategory = normalizeCategory(filters.category);
  const startDate = String(filters.start_date || '').trim();
  const endDate = String(filters.end_date || '').trim();

  return rows
    .filter(row => {
      const categoryLabel = getCategoryLabel(row.category);
      if (!matchTerms([
        row.name,
        row.category,
        categoryLabel,
        row.event_type,
        row.gender_group,
        row.venue,
        row.description,
        row.grade_list,
        row.venue_list
      ], terms)) {
        return false;
      }
      if (normalizedCategory && row.category !== normalizedCategory) {
        return false;
      }
      if (filters.grade && !matchTerms([row.grade_list], splitSearchTerms(filters.grade))) {
        return false;
      }
      if (startDate && (!row.earliest_time || row.earliest_time < startDate)) {
        return false;
      }
      if (endDate && (!row.earliest_time || row.earliest_time > `${endDate} 23:59:59`)) {
        return false;
      }
      return true;
    })
    .map(row => ({
      id: row.id,
      type: 'events',
      title: row.name,
      description: `${getCategoryLabel(row.category)} · ${row.venue || '场地待定'}`,
      subtitle: `${row.earliest_time || '时间待定'} · ${Number(row.participant_count) || 0} 人参赛`,
      category: row.category,
      category_label: getCategoryLabel(row.category),
      grade_list: row.grade_list ? row.grade_list.split(',').filter(Boolean) : [],
      start_time: row.earliest_time || '',
      end_time: row.latest_time || '',
      venue: row.venue || row.venue_list || '',
      participant_count: Number(row.participant_count) || 0,
      href: `#/events/${row.id}`,
      sort_time: row.earliest_time || row.created_at || ''
    }));
}

function queryNews(db, terms) {
  const rows = db.prepare(`
    SELECT
      p.id,
      p.title,
      p.content,
      p.reply_count,
      p.view_count,
      p.created_at,
      p.updated_at,
      u.name AS author_name
    FROM forum_posts p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.is_deleted = 0
    ORDER BY p.updated_at DESC, p.id DESC
  `).all();

  return rows
    .filter(row => matchTerms([row.title, row.content, row.author_name], terms))
    .map(row => ({
      id: row.id,
      type: 'news',
      title: row.title,
      description: String(row.content || '').replace(/\s+/g, ' ').slice(0, 90),
      subtitle: `${row.author_name || '匿名'} · ${row.reply_count || 0} 回复 · ${row.view_count || 0} 浏览`,
      author_name: row.author_name || '',
      href: '#/forum',
      sort_time: row.updated_at || row.created_at || ''
    }));
}

function queryAnnouncements(db, terms) {
  const rows = db.prepare(`
    SELECT
      a.id,
      a.title,
      a.content,
      a.category,
      a.is_pinned,
      a.publish_time,
      u.name AS publisher_name
    FROM announcements a
    LEFT JOIN users u ON u.id = a.published_by
    WHERE a.status = 'published'
      AND (a.expire_time IS NULL OR a.expire_time >= datetime('now','localtime'))
    ORDER BY a.is_pinned DESC, a.publish_time DESC, a.id DESC
  `).all();

  return rows
    .filter(row => matchTerms([row.title, row.content, row.category, row.publisher_name], terms))
    .map(row => ({
      id: row.id,
      type: 'announcements',
      title: row.title,
      description: String(row.content || '').replace(/\s+/g, ' ').slice(0, 90),
      subtitle: `${row.publisher_name || '系统'} · ${row.publish_time || '发布时间待定'}`,
      category: row.category || 'general',
      href: `#/announcements/${row.id}`,
      sort_time: row.publish_time || ''
    }));
}

function queryResults(db, terms) {
  const rows = db.prepare(`
    SELECT
      r.id,
      r.performance,
      r.rank,
      r.score,
      r.award,
      r.created_at,
      u.name AS user_name,
      u.student_id,
      u.class_name,
      u.grade,
      e.name AS event_name
    FROM results r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN schedules s ON s.id = r.schedule_id
    LEFT JOIN events e ON e.id = s.event_id
    WHERE r.is_published = 1
    ORDER BY r.rank ASC, r.created_at DESC
  `).all();

  return rows
    .filter(row => matchTerms([
      row.user_name,
      row.student_id,
      row.class_name,
      row.grade,
      row.event_name,
      row.performance,
      row.award,
      row.rank
    ], terms))
    .map(row => ({
      id: row.id,
      type: 'results',
      title: `${row.user_name || '未知选手'} · ${row.event_name || '未知项目'}`,
      description: `成绩 ${row.performance || '-'} · 第 ${row.rank || '-'} 名`,
      subtitle: `${row.award || '未获奖'} · ${[row.grade, row.class_name].filter(Boolean).join(' ') || '班级待定'}`,
      rank: row.rank || 0,
      award: row.award || '',
      performance: row.performance || '',
      href: '#/results',
      sort_time: row.created_at || ''
    }));
}

function queryHighlights(terms) {
  return getHighlightItems()
    .filter(item => matchTerms([item.title, item.description, item.file_name, item.tags.join(' ')], terms))
    .map(item => ({
      id: item.id,
      type: 'highlights',
      title: item.title,
      description: item.description,
      subtitle: '图片素材',
      media_type: item.media_type,
      thumbnail: item.url,
      href: item.url,
      sort_time: item.created_at || ''
    }));
}

function performSearch(db, params = {}) {
  const query = String(params.q || '').trim();
  const type = normalizeSearchType(String(params.type || 'all').trim());
  const page = clampInteger(params.page, 1, 1, 9999);
  const limit = clampInteger(params.limit, 12, 1, 20);
  const filters = {
    category: params.category || '',
    grade: params.grade || '',
    start_date: params.start_date || '',
    end_date: params.end_date || '',
    department: params.department || '',
    participant_event: params.participant_event || ''
  };

  if (!query) {
    return {
      query: '',
      type,
      page: 1,
      limit,
      total: 0,
      total_pages: 0,
      counts: { users: 0, events: 0, news: 0, announcements: 0, results: 0, highlights: 0 },
      items: [],
      sections: {}
    };
  }

  const terms = splitSearchTerms(query);
  const sections = {
    users: queryUsers(db, terms, filters),
    events: queryEvents(db, terms, filters),
    news: queryNews(db, terms),
    announcements: queryAnnouncements(db, terms),
    results: queryResults(db, terms),
    highlights: queryHighlights(terms)
  };

  const counts = Object.fromEntries(
    Object.entries(sections).map(([key, rows]) => [key, rows.length])
  );

  const allItems = Object.values(sections)
    .flat()
    .sort((a, b) => String(b.sort_time || '').localeCompare(String(a.sort_time || '')));

  const sourceRows = type === 'all' ? allItems : sections[type];
  const paged = buildPagination(sourceRows, page, limit);

  return {
    query,
    type,
    page: paged.page,
    limit,
    total: paged.total,
    total_pages: paged.total_pages,
    counts,
    items: paged.items,
    sections: Object.fromEntries(
      Object.entries(sections).map(([key, rows]) => [key, rows.slice(0, 3)])
    )
  };
}

function buildSuggestions(db, query) {
  const normalized = String(query || '').trim();
  if (normalized.length < 3) return [];

  const result = performSearch(db, { q: normalized, type: 'all', page: 1, limit: 8 });
  return result.items.slice(0, 8).map(item => ({
    id: `${item.type}-${item.id}`,
    type: item.type,
    title: item.title,
    subtitle: item.subtitle || item.description || '',
    href: item.href || '',
    thumbnail: item.thumbnail || item.avatar || ''
  }));
}

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
      return res.status(404).json({ success: false, error: '项目不存在' });
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
    let sql = `SELECT a.id, a.title, a.content, a.category, a.is_pinned, a.publish_time, a.expire_time, a.view_count, a.created_at, u.name AS publisher_name FROM announcements a LEFT JOIN users u ON a.published_by = u.id WHERE a.status = 'published' AND (a.expire_time IS NULL OR a.expire_time >= datetime('now','localtime'))`;
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

// GET /api/public/search/suggest
router.get('/search/suggest', (req, res) => {
  try {
    const db = getDb();
    const suggestions = buildSuggestions(db, req.query.q);
    res.json({ success: true, data: suggestions });
  } catch (err) {
    res.status(500).json({ error: '获取搜索联想失败' });
  }
});

// GET /api/public/search
router.get('/search', (req, res) => {
  try {
    const db = getDb();
    const startedAt = Date.now();
    const data = performSearch(db, req.query);
    res.json({
      success: true,
      data,
      meta: {
        elapsed_ms: Date.now() - startedAt
      }
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
    const awardedCount = db.prepare(`SELECT COUNT(DISTINCT user_id) AS cnt FROM results WHERE is_published = 1 AND award != '' AND award IS NOT NULL`).get();

    res.json({
      success: true,
      data: {
        total_registrations: totalReg.cnt,
        total_events: totalEvents.cnt,
        completed_schedules: completedSchedules.cnt,
        awarded_count: awardedCount.cnt
      }
    });
  } catch (err) {
    res.status(500).json({ error: '获取统计概览失败' });
  }
});

module.exports = router;
