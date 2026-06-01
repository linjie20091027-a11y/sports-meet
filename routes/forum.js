const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const { getDb } = require('../database/init');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createNotification, notifyAdmins } = require('../utils/notify');

const FORUM_CATEGORIES = [
  { value: 'general', label: '综合交流' },
  { value: 'event', label: '赛事讨论' },
  { value: 'experience', label: '经验分享' },
  { value: 'notice', label: '通知问答' },
  { value: 'help', label: '互助求助' }
];
const FORUM_TAGS = ['报名', '赛程', '成绩', '训练', '规则', '后勤', '志愿者', '精彩瞬间'];
const REPORT_REASONS = ['违规内容', '人身攻击', '广告灌水', '虚假信息', '隐私泄露'];
const SENSITIVE_WORDS = ['辱骂', '赌博', '诈骗', '色情', '代发广告', '外挂', '刷单', '毒品'];
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'forum');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2, 10)}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allow = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip'];
    cb(null, allow.includes(ext));
  }
});

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) return next();
  const { verifyToken } = require('../middleware/auth');
  const decoded = verifyToken(token);
  if (decoded) req.user = decoded;
  next();
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizeRichText(html) {
  let value = String(html || '').trim();
  value = value.replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, '');
  value = value.replace(/\son\w+="[^"]*"/gi, '').replace(/\son\w+='[^']*'/gi, '');
  value = value.replace(/javascript:/gi, '');
  value = value.replace(/<(?!\/?(p|br|strong|b|em|i|u|ul|ol|li|blockquote|h3|h4|a|span)\b)[^>]+>/gi, '');
  value = value.replace(/<a\b([^>]*)href="(https?:\/\/[^"]+)"([^>]*)>/gi, '<a$1 href="$2" target="_blank" rel="noopener noreferrer"$3>');
  return value.slice(0, 20000);
}

function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : String(tags || '').split(',');
  return [...new Set(list.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 6);
}

function parseAttachments(input) {
  if (Array.isArray(input)) return input.slice(0, 4);
  if (!input) return [];
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch (_) {
    return [];
  }
}

function containsSensitiveContent(text) {
  const raw = String(text || '');
  const hit = SENSITIVE_WORDS.find((word) => raw.includes(word));
  return hit || '';
}

function ensureActiveUser(db, userId) {
  const user = db.prepare('SELECT id, name, username, role, class_name, muted_until, status FROM users WHERE id = ?').get(userId);
  if (!user || user.status !== 'active') throw new Error('当前账号不可用');
  if (user.muted_until && new Date(user.muted_until).getTime() > Date.now()) {
    throw new Error('当前账号已被禁言，请稍后再试');
  }
  return user;
}

function ensureNotMuted(req, res, next) {
  try {
    const db = getDb();
    ensureActiveUser(db, req.user.id);
    next();
  } catch (e) {
    res.status(403).json({ success: false, error: e.message });
  }
}

function assertPostingRate(db, userId, table, contentColumn, contentValue) {
  const recentCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM ${table}
    WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-60 seconds')
  `).get(userId).cnt;
  if (recentCount >= 2) throw new Error('发送过于频繁，请稍后再试');

  const duplicate = db.prepare(`
    SELECT id FROM ${table}
    WHERE user_id = ? AND ${contentColumn} = ? AND datetime(created_at) >= datetime('now', '-10 minutes')
    LIMIT 1
  `).get(userId, contentValue);
  if (duplicate) throw new Error('检测到重复内容，请勿灌水');
}

function canViewPost(user, post) {
  if (!post || post.is_deleted) return false;
  if (post.status === 'approved') return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Number(post.user_id) === Number(user.id);
}

function buildPostWhere(req, params) {
  const where = ['p.is_deleted = 0'];
  if (req.user?.role === 'admin') {
    if (req.query.status) {
      where.push('p.status = ?');
      params.push(req.query.status);
    }
  } else if (req.user?.id && req.query.mine === '1') {
    where.push('(p.status = \'approved\' OR p.user_id = ?)');
    params.push(req.user.id);
  } else {
    where.push('p.status = \'approved\'');
  }
  if (req.query.category) {
    where.push('p.category = ?');
    params.push(req.query.category);
  }
  if (req.query.tag) {
    where.push('p.tags LIKE ?');
    params.push(`%${req.query.tag}%`);
  }
  if (req.query.keyword) {
    where.push('(p.title LIKE ? OR p.summary LIKE ? OR p.content LIKE ?)');
    params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`, `%${req.query.keyword}%`);
  }
  return where.join(' AND ');
}

function mapPostRow(db, row, currentUserId) {
  const liked = currentUserId ? !!db.prepare(
    'SELECT id FROM forum_post_actions WHERE post_id = ? AND user_id = ? AND action_type = \'like\''
  ).get(row.id, currentUserId) : false;
  const favorited = currentUserId ? !!db.prepare(
    'SELECT id FROM forum_post_actions WHERE post_id = ? AND user_id = ? AND action_type = \'favorite\''
  ).get(row.id, currentUserId) : false;
  return {
    ...row,
    tags: parseAttachments(row.tags),
    attachments: parseAttachments(row.attachments),
    liked,
    favorited
  };
}

function touchPost(db, postId) {
  db.prepare(`
    UPDATE forum_posts
    SET last_interaction_at = datetime('now','localtime'),
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(postId);
}

function rebuildReplyCount(db, postId) {
  const cnt = db.prepare(
    'SELECT COUNT(*) as cnt FROM forum_replies WHERE post_id = ? AND is_deleted = 0 AND status = \'approved\''
  ).get(postId).cnt;
  db.prepare('UPDATE forum_posts SET reply_count = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(cnt, postId);
}

function insertModerationLog(db, payload) {
  db.prepare(`
    INSERT INTO forum_moderation_logs (post_id, reply_id, action, stage, operator_id, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(payload.post_id || null, payload.reply_id || null, payload.action, payload.stage || 1, payload.operator_id || null, payload.comment || '');
}

function setUserMuteState(db, userId, hours) {
  const durationHours = Math.max(0, parseInt(hours, 10) || 0);
  const mutedUntil = durationHours > 0 ? new Date(Date.now() + durationHours * 3600000).toISOString() : '';
  db.prepare('UPDATE users SET muted_until = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(mutedUntil, userId);
  return { mutedUntil, durationHours };
}

function resolveReportTarget(db, report) {
  if (report.target_type === 'post') {
    const post = db.prepare(`
      SELECT id, user_id, title, status, is_deleted
      FROM forum_posts
      WHERE id = ?
    `).get(report.target_id);
    if (!post) return null;
    return {
      kind: 'post',
      id: post.id,
      user_id: post.user_id,
      title: post.title,
      post_id: post.id,
      reply_id: null,
      target_url: '#/forum/' + post.id
    };
  }

  if (report.target_type === 'reply') {
    const reply = db.prepare(`
      SELECT r.id, r.post_id, r.user_id, r.content, p.title as post_title
      FROM forum_replies r
      LEFT JOIN forum_posts p ON p.id = r.post_id
      WHERE r.id = ?
    `).get(report.target_id);
    if (!reply) return null;
    return {
      kind: 'reply',
      id: reply.id,
      user_id: reply.user_id,
      title: reply.post_title || '论坛评论',
      post_id: reply.post_id || null,
      reply_id: reply.id,
      target_url: reply.post_id ? '#/forum/' + reply.post_id : '#/forum'
    };
  }

  return null;
}

function applyReportTargetAction(db, target, postAction, operatorId) {
  if (!target || postAction === 'none') return;

  if (target.kind === 'post') {
    if (postAction === 'hide') {
      db.prepare(`
        UPDATE forum_posts
        SET status = 'rejected', updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(target.id);
      return;
    }
    if (postAction === 'delete') {
      db.prepare(`
        UPDATE forum_posts
        SET is_deleted = 1, deleted_by = ?, deleted_at = datetime('now','localtime')
        WHERE id = ?
      `).run(operatorId, target.id);
    }
    return;
  }

  if (target.kind === 'reply') {
    if (postAction === 'hide') {
      db.prepare(`
        UPDATE forum_replies
        SET status = 'rejected'
        WHERE id = ?
      `).run(target.id);
      rebuildReplyCount(db, target.post_id);
      return;
    }
    if (postAction === 'delete') {
      db.prepare(`
        UPDATE forum_replies
        SET is_deleted = 1, deleted_by = ?, deleted_at = datetime('now','localtime')
        WHERE id = ?
      `).run(operatorId, target.id);
      rebuildReplyCount(db, target.post_id);
    }
  }
}

router.get('/meta', optionalAuth, (_req, res) => {
  res.json({
    success: true,
    data: {
      categories: FORUM_CATEGORIES,
      tags: FORUM_TAGS,
      report_reasons: REPORT_REASONS
    }
  });
});

router.post('/attachments', authMiddleware, ensureNotMuted, upload.array('files', 4), (req, res) => {
  const files = (req.files || []).map((file) => ({
    name: file.originalname,
    size: file.size,
    mime_type: file.mimetype,
    url: `/uploads/forum/${path.basename(file.path)}`
  }));
  res.json({ success: true, data: files, message: '附件上传成功' });
});

router.get('/posts', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const params = [];
    const where = buildPostWhere(req, params);
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM forum_posts p WHERE ${where}`).get(...params).cnt;
    const rows = db.prepare(`
      SELECT p.*, u.name as author_name, u.class_name, u.role as author_role
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      WHERE ${where}
      ORDER BY p.is_pinned DESC, p.is_featured DESC, datetime(COALESCE(p.last_interaction_at, p.updated_at, p.created_at)) DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    const list = rows.map((row) => mapPostRow(db, row, req.user?.id));
    const featured = db.prepare(`
      SELECT p.*, u.name as author_name, u.class_name, u.role as author_role
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_deleted = 0 AND p.status = 'approved' AND p.is_featured = 1
      ORDER BY datetime(COALESCE(p.last_interaction_at, p.updated_at, p.created_at)) DESC
      LIMIT 5
    `).all().map((row) => mapPostRow(db, row, req.user?.id));
    const pinned = db.prepare(`
      SELECT p.*, u.name as author_name, u.class_name, u.role as author_role
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_deleted = 0 AND p.status = 'approved' AND p.is_pinned = 1
      ORDER BY datetime(COALESCE(p.last_interaction_at, p.updated_at, p.created_at)) DESC
      LIMIT 5
    `).all().map((row) => mapPostRow(db, row, req.user?.id));
    res.json({ success: true, data: { list, total, page, limit, featured, pinned } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/posts/:id', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare(`
      SELECT p.*, u.name as author_name, u.class_name, u.role as author_role
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!canViewPost(req.user, post)) return res.status(404).json({ success: false, error: '帖子不存在或无权限查看' });

    db.prepare('UPDATE forum_posts SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
    const replies = db.prepare(`
      SELECT r.*, u.name as author_name, u.class_name, u.role as author_role
      FROM forum_replies r
      JOIN users u ON r.user_id = u.id
      WHERE r.post_id = ? AND r.is_deleted = 0
        AND (r.status = 'approved' OR ? = 'admin' OR r.user_id = ?)
      ORDER BY datetime(r.created_at) ASC
    `).all(req.params.id, req.user?.role || '', req.user?.id || 0);

    res.json({
      success: true,
      data: {
        post: mapPostRow(db, post, req.user?.id),
        replies
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/posts', authMiddleware, ensureNotMuted, (req, res) => {
  try {
    const db = getDb();
    const user = ensureActiveUser(db, req.user.id);
    const title = String(req.body.title || '').trim().slice(0, 120);
    const category = FORUM_CATEGORIES.some((item) => item.value === req.body.category) ? req.body.category : 'general';
    const tags = normalizeTags(req.body.tags);
    const attachments = parseAttachments(req.body.attachments).map((item) => ({
      name: String(item.name || '').slice(0, 120),
      url: String(item.url || '').slice(0, 300),
      mime_type: String(item.mime_type || '').slice(0, 80),
      size: Number(item.size || 0)
    })).filter((item) => item.url);
    const content = sanitizeRichText(req.body.content);
    const summary = stripHtml(content).slice(0, 180);
    if (!title || !summary) return res.status(400).json({ success: false, error: '标题和内容不能为空' });
    if (title.length < 4) return res.status(400).json({ success: false, error: '标题至少 4 个字' });

    const sensitive = containsSensitiveContent(title + ' ' + summary);
    if (sensitive) {
      insertModerationLog(db, { action: 'blocked_post', operator_id: req.user.id, comment: `命中敏感词：${sensitive}` });
      return res.status(400).json({ success: false, error: '帖子内容含违规词，已自动拦截' });
    }

    assertPostingRate(db, req.user.id, 'forum_posts', 'title', title);
    const status = user.role === 'admin' ? 'approved' : 'pending';
    const stage = user.role === 'admin' ? 2 : 1;
    const inserted = db.prepare(`
      INSERT INTO forum_posts (
        user_id, title, summary, content, category, tags, attachments,
        status, review_stage, is_pinned, is_featured, last_interaction_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now','localtime'))
    `).run(req.user.id, title, summary, content, category, JSON.stringify(tags), JSON.stringify(attachments), status, stage);
    insertModerationLog(db, { post_id: inserted.lastInsertRowid, action: status === 'approved' ? 'publish_post' : 'submit_post', stage, operator_id: req.user.id });
    if (status !== 'approved') {
      notifyAdmins(db, {
        type: 'warning',
        title: '论坛有新帖子待审核',
        content: `${user.name || user.username} 发布了新帖子「${title}」`,
        target_url: '#/admin'
      });
    }
    res.json({
      success: true,
      data: { id: inserted.lastInsertRowid, status },
      message: status === 'approved' ? '发布成功' : '帖子已提交，等待审核'
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/posts/:id/replies', authMiddleware, ensureNotMuted, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare('SELECT id, user_id, title, status, is_deleted FROM forum_posts WHERE id = ?').get(req.params.id);
    if (!canViewPost(req.user, post)) return res.status(404).json({ success: false, error: '帖子不存在' });
    const content = sanitizeRichText(req.body.content);
    const text = stripHtml(content);
    if (!text) return res.status(400).json({ success: false, error: '评论内容不能为空' });
    if (containsSensitiveContent(text)) return res.status(400).json({ success: false, error: '评论内容含违规词，已自动拦截' });
    assertPostingRate(db, req.user.id, 'forum_replies', 'content', text);

    const status = req.user.role === 'admin' ? 'approved' : 'pending';
    const inserted = db.prepare(
      'INSERT INTO forum_replies (post_id, user_id, content, status) VALUES (?, ?, ?, ?)'
    ).run(post.id, req.user.id, text, status);
    if (status === 'approved') {
      rebuildReplyCount(db, post.id);
      touchPost(db, post.id);
    } else {
      notifyAdmins(db, {
        type: 'warning',
        title: '论坛有新评论待审核',
        content: `帖子「${post.title}」收到一条新评论`,
        target_url: '#/admin'
      });
    }
    insertModerationLog(db, { post_id: post.id, reply_id: inserted.lastInsertRowid, action: status === 'approved' ? 'approve_reply_auto' : 'submit_reply', stage: status === 'approved' ? 2 : 1, operator_id: req.user.id });
    if (post.user_id !== req.user.id && status === 'approved') {
      createNotification(db, post.user_id, {
        type: 'info',
        title: '论坛有新评论',
        content: `${req.user.name || req.user.username} 评论了您的帖子「${post.title}」`,
        target_url: `#/forum/${post.id}`
      });
    }
    res.json({ success: true, message: status === 'approved' ? '评论成功' : '评论已提交，等待审核' });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/posts/:id/like', authMiddleware, ensureNotMuted, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare('SELECT id FROM forum_posts WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: '帖子不存在' });
    const existing = db.prepare(
      'SELECT id FROM forum_post_actions WHERE post_id = ? AND user_id = ? AND action_type = \'like\''
    ).get(post.id, req.user.id);
    if (existing) {
      db.prepare('DELETE FROM forum_post_actions WHERE id = ?').run(existing.id);
      db.prepare('UPDATE forum_posts SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END WHERE id = ?').run(post.id);
      return res.json({ success: true, data: { liked: false }, message: '已取消点赞' });
    }
    db.prepare('INSERT INTO forum_post_actions (post_id, user_id, action_type) VALUES (?, ?, \'like\')').run(post.id, req.user.id);
    db.prepare('UPDATE forum_posts SET like_count = like_count + 1 WHERE id = ?').run(post.id);
    res.json({ success: true, data: { liked: true }, message: '点赞成功' });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/posts/:id/favorite', authMiddleware, ensureNotMuted, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare('SELECT id FROM forum_posts WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: '帖子不存在' });
    const existing = db.prepare(
      'SELECT id FROM forum_post_actions WHERE post_id = ? AND user_id = ? AND action_type = \'favorite\''
    ).get(post.id, req.user.id);
    if (existing) {
      db.prepare('DELETE FROM forum_post_actions WHERE id = ?').run(existing.id);
      db.prepare('UPDATE forum_posts SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END WHERE id = ?').run(post.id);
      return res.json({ success: true, data: { favorited: false }, message: '已取消收藏' });
    }
    db.prepare('INSERT INTO forum_post_actions (post_id, user_id, action_type) VALUES (?, ?, \'favorite\')').run(post.id, req.user.id);
    db.prepare('UPDATE forum_posts SET favorite_count = favorite_count + 1 WHERE id = ?').run(post.id);
    res.json({ success: true, data: { favorited: true }, message: '收藏成功' });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/posts/:id/report', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare('SELECT id, title FROM forum_posts WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: '帖子不存在' });
    const reason = REPORT_REASONS.includes(req.body.reason) ? req.body.reason : REPORT_REASONS[0];
    const detail = String(req.body.detail || '').trim().slice(0, 300);
    const existing = db.prepare(`
      SELECT id FROM forum_reports
      WHERE target_type = 'post' AND target_id = ? AND reporter_id = ? AND status = 'pending'
    `).get(post.id, req.user.id);
    if (existing) return res.status(400).json({ success: false, error: '该帖子已举报，请勿重复提交' });
    db.prepare(`
      INSERT INTO forum_reports (target_type, target_id, post_id, reporter_id, reason, detail)
      VALUES ('post', ?, ?, ?, ?, ?)
    `).run(post.id, post.id, req.user.id, reason, detail);
    db.prepare('UPDATE forum_posts SET report_count = report_count + 1 WHERE id = ?').run(post.id);
    notifyAdmins(db, {
      type: 'warning',
      title: '论坛帖子被举报',
      content: `帖子「${post.title}」收到新的举报：${reason}`,
      target_url: '#/admin'
    });
    res.json({ success: true, message: '举报已提交' });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.delete('/posts/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare('SELECT id, user_id, title FROM forum_posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: '帖子不存在' });
    if (req.user.role !== 'admin' && Number(post.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: '无权限删除此帖子' });
    }
    db.prepare(`
      UPDATE forum_posts
      SET is_deleted = 1, deleted_by = ?, deleted_at = datetime('now','localtime')
      WHERE id = ?
    `).run(req.user.id, req.params.id);
    insertModerationLog(db, { post_id: post.id, action: 'delete_post', stage: req.user.role === 'admin' ? 2 : 1, operator_id: req.user.id });
    res.json({ success: true, message: '帖子已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/replies/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const reply = db.prepare('SELECT id, post_id, user_id FROM forum_replies WHERE id = ?').get(req.params.id);
    if (!reply) return res.status(404).json({ success: false, error: '评论不存在' });
    if (req.user.role !== 'admin' && Number(reply.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: '无权限删除此评论' });
    }
    db.prepare(`
      UPDATE forum_replies
      SET is_deleted = 1, deleted_by = ?, deleted_at = datetime('now','localtime')
      WHERE id = ?
    `).run(req.user.id, req.params.id);
    rebuildReplyCount(db, reply.post_id);
    insertModerationLog(db, { post_id: reply.post_id, reply_id: reply.id, action: 'delete_reply', stage: req.user.role === 'admin' ? 2 : 1, operator_id: req.user.id });
    res.json({ success: true, message: '评论已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== AI 助手 ====================
const AI_ROUTER = express.Router();

// DeepSeek API 配置
let DEEPSEEK_API_KEY = '';
let DEEPSEEK_API_KEY_LOADED = false;
let DEEPSEEK_BASE_URL = 'https://api.deepseek.com/chat/completions';

function loadApiKey() {
  if (DEEPSEEK_API_KEY_LOADED) return;
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key='deepseek_api_key'").get();
    if (row?.value) DEEPSEEK_API_KEY = row.value;
    DEEPSEEK_API_KEY_LOADED = true;
  } catch(e) {}
}

// 设置 API Key 的路由
AI_ROUTER.post('/ai-key', authMiddleware, adminOnly, (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.json({ success: false, error: '请提供 API Key' });
    DEEPSEEK_API_KEY = key;
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('deepseek_api_key', ?)").run(key);
    res.json({ success: true, message: 'API Key 已保存' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// AI 对话路由（支持会话记忆）
AI_ROUTER.post('/ai-chat', optionalAuth, async (req, res) => {
  try {
    loadApiKey();
    const { message, history } = req.body;
    if (!message?.trim()) return res.json({ success: false, error: '请输入問题' });
    if (!DEEPSEEK_API_KEY) return res.json({ success: false, error: 'AI 助手尚未配置，请管理员设置 API Key' });

    const https = require('https');
    const db = getDb();

    // 构建实时上下文
    const meet = db.prepare("SELECT * FROM meet_info WHERE id=1").get() || {};
    const totalRegs = db.prepare("SELECT COUNT(*) as cnt FROM registrations").get()?.cnt || 0;
    const pendingRegs = db.prepare("SELECT COUNT(*) as cnt FROM registrations WHERE status='pending'").get()?.cnt || 0;
    const schedules = db.prepare("SELECT COUNT(*) as cnt FROM schedules WHERE status='published'").get()?.cnt || 0;
    const maxEvents = db.prepare("SELECT value FROM settings WHERE key='max_events_per_student'").get()?.value || '3';

    const context = `【系统實时数据】
當前时间：${new Date().toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'})}
运动会：濠江中学第三十屆田徑运动会（${meet.start_date||'待定'} 至 ${meet.end_date||'待定'}）
报名：${meet.registration_open?'开放中':'已关闭'}，已有${totalRegs}人次报名（${pendingRegs}待审核）
赛程：已发布${schedules}场，每人限报${maxEvents}项
学校：澳门濠江中学，1932年创校，校訓「忠誠勤奮求實创新」，位於青洲大马路`;

    const systemPrompt = `你是「小濠」，一個全能的AI助手，部署於澳门濠江中学运动会管理系统中。

【核心原則】
- 你有廣博的知識儲备，能回答任何領域的問题（科学、歷史、编程、数学、文学、生活常識等）
- 回答風格：清晰、直接、有条理，避免廢话。像一個聰明靠譜的朋友
- 如果用户問程式开发、代码调试、系统架构等問题，发揮你的编程能力給出實用建議
- 如果用户問数学/科学問题，給出準确的解釋和计算
- 如果問学校/运动会相关，结合上方【系统實时数据】準确回答
- 全程繁体中文，可適度夾雜粵語口語詞增加親切感
- 適度使用 emoji 但不濫用
- 保持誠實：不知道就說不知道，不要编造`;

    // 构建消息列表（含历史）
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context }
    ];

    // 注入最近10轮历史
    if (Array.isArray(history)) {
      history.slice(-10).forEach(h => {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content });
        }
      });
    }

    messages.push({ role: 'user', content: message });

    const apiReq = https.request(DEEPSEEK_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      }
    }, (apiRes) => {
      let body = '';
      apiRes.on('data', c => body += c);
      apiRes.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.choices?.[0]?.message?.content) {
            res.json({ success: true, data: { reply: result.choices[0].message.content } });
          } else {
            res.json({ success: false, error: result.error?.message || 'AI 回应异常' });
          }
        } catch (e) {
          res.json({ success: false, error: 'AI 回应解析失败' });
        }
      });
    });

    apiReq.on('error', (e) => {
      res.json({ success: false, error: 'AI 服务暂不可用：' + e.message });
    });

    apiReq.write(JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    }));
    apiReq.end();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// AI 自动生成赛程
AI_ROUTER.get('/generate-schedule', authMiddleware, adminOnly, async (req, res) => {
  try {
    loadApiKey();
    if (!DEEPSEEK_API_KEY) return res.json({ success: false, error: 'AI 尚未配置 API Key' });

    const db = getDb();
    const https = require('https');

    // 获取所有已通过报名的数据
    const registrations = db.prepare(`
      SELECT r.event_id, e.name as event_name, e.category, e.event_type, e.gender_group,
             e.max_participants, u.id as user_id, u.name as user_name, u.class_name
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      JOIN users u ON r.user_id = u.id
      WHERE r.status = 'approved'
      ORDER BY e.sort_order, u.class_name
    `).all();

    if (!registrations.length) return res.json({ success: false, error: '暂无已通过审核的报名记录' });

    // 构建数据摘要
    const events = {};
    registrations.forEach(r => {
      if (!events[r.event_id]) {
        events[r.event_id] = {
          name: r.event_name, category: r.category, type: r.event_type,
          gender: r.gender_group, max: r.max_participants, students: []
        };
      }
      events[r.event_id].students.push({ name: r.user_name, class: r.class_name, id: r.user_id });
    });

    let eventSummary = '';
    Object.values(events).forEach(e => {
      eventSummary += `\n项目：${e.name}（${e.type==='team'?'集体':'个人'}，${e.gender==='male'?'男子':e.gender==='female'?'女子':'混合'}）| 參赛人数：${e.students.length} | 參赛者：${e.students.map(s=>s.name+'('+s.class+')').join('、')}`;
    });

    const prompt = `你是澳门濠江中学运动会的赛程编排專家。请根据以下报名数据，生成一份合理的比赛时间表。

【编排要求】
1. 运动会日期：第一天上午(8:00-12:00)、下午(14:00-17:00)；第二天上午(8:00-12:00)、下午(14:00-17:00)
2. 徑赛项目安排在上午（天氣較涼爽），田赛和集体项目安排在下午
3. 每個项目按參赛人数分组（每组6-8人），计算需要的轮次
4. 同一运动员不应同时參加兩個项目（根据參赛者名單避免衝突）
5. 100米、200米等短项目先进行預赛再決赛；長跑项目直接決赛
6. 接力项目安排在每天最後时段
7. 请用純JSON格式返回，格式如下：

{
  "day1_am": [{"time":"08:00","event":"100米男子預赛","venue":"田徑场","round":"預赛第1组","students":["姓名(班級)"]}],
  "day1_pm": [...],
  "day2_am": [...],
  "day2_pm": [...]
}

只返回JSON，不要任何其他文字。

【报名数据】
${eventSummary}`;

    const apiReq = https.request(DEEPSEEK_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` }
    }, (apiRes) => {
      let body = '';
      apiRes.on('data', c => body += c);
      apiRes.on('end', () => {
        try {
          const result = JSON.parse(body);
          const content = result.choices?.[0]?.message?.content || '';
          // 提取JSON
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const schedule = JSON.parse(jsonMatch[0]);
            res.json({ success: true, data: schedule });
          } else {
            res.json({ success: false, error: 'AI 生成格式异常', raw: content.substring(0, 200) });
          }
        } catch (e) {
          res.json({ success: false, error: '解析AI回应失败：' + e.message });
        }
      });
    });

    apiReq.on('error', (e) => res.json({ success: false, error: 'AI 服务暂不可用' }));
    apiReq.write(JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: 4000, temperature: 0.3 }));
    apiReq.end();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 检查 API Key 状态
AI_ROUTER.get('/ai-status', (req, res) => {
  res.json({ success: true, data: { configured: !!DEEPSEEK_API_KEY } });
});

router.get('/admin/posts', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const where = ['p.is_deleted = 0'];
    const params = [];
    if (req.query.status) {
      where.push('p.status = ?');
      params.push(req.query.status);
    }
    if (req.query.category) {
      where.push('p.category = ?');
      params.push(req.query.category);
    }
    if (req.query.keyword) {
      where.push('(p.title LIKE ? OR p.summary LIKE ?)');
      params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`);
    }
    const whereSql = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM forum_posts p WHERE ${whereSql}`).get(...params).cnt;
    const list = db.prepare(`
      SELECT p.*, u.name as author_name, u.class_name, u.role as author_role
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      WHERE ${whereSql}
      ORDER BY p.is_pinned DESC, p.is_featured DESC, datetime(COALESCE(p.last_interaction_at, p.updated_at, p.created_at)) DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    res.json({ success: true, data: { list, total, page, limit } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/admin/posts/:id/audit', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare('SELECT * FROM forum_posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: '帖子不存在' });
    const action = String(req.body.action || '').trim();
    const comment = String(req.body.comment || '').trim().slice(0, 200);
    if (action === 'approve') {
      db.prepare(`
        UPDATE forum_posts
        SET status = 'approved', review_stage = 2, review_comment = ?, reviewed_by = ?, reviewed_at = datetime('now','localtime'),
            updated_at = datetime('now','localtime'), last_interaction_at = datetime('now','localtime')
        WHERE id = ?
      `).run(comment, req.user.id, post.id);
      createNotification(db, post.user_id, {
        type: 'success',
        title: '论坛帖子已通过审核',
        content: `您的帖子「${post.title}」已审核通过`,
        target_url: `#/forum/${post.id}`
      });
    } else if (action === 'reject') {
      db.prepare(`
        UPDATE forum_posts
        SET status = 'rejected', review_stage = 2, review_comment = ?, reviewed_by = ?, reviewed_at = datetime('now','localtime'),
            updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(comment || '未通过审核', req.user.id, post.id);
      createNotification(db, post.user_id, {
        type: 'warning',
        title: '论坛帖子未通过审核',
        content: comment || `您的帖子「${post.title}」未通过审核`,
        target_url: '#/forum'
      });
    } else if (action === 'pin' || action === 'unpin') {
      db.prepare('UPDATE forum_posts SET is_pinned = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(action === 'pin' ? 1 : 0, post.id);
    } else if (action === 'feature' || action === 'unfeature') {
      db.prepare('UPDATE forum_posts SET is_featured = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(action === 'feature' ? 1 : 0, post.id);
    } else if (action === 'delete') {
      db.prepare('UPDATE forum_posts SET is_deleted = 1, deleted_by = ?, deleted_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(req.user.id, post.id);
    } else {
      return res.status(400).json({ success: false, error: '操作类型无效' });
    }
    insertModerationLog(db, { post_id: post.id, action: `admin_${action}`, stage: 2, operator_id: req.user.id, comment });
    res.json({ success: true, message: '帖子处理完成' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/admin/replies/pending', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const replies = db.prepare(`
      SELECT r.id, r.content, r.created_at, r.status,
        u.name as author_name, u.class_name,
        p.title as post_title, p.id as post_id
      FROM forum_replies r
      JOIN users u ON r.user_id = u.id
      JOIN forum_posts p ON r.post_id = p.id
      WHERE r.is_deleted = 0 AND r.status = 'pending'
      ORDER BY r.created_at ASC
    `).all();
    res.json({ success: true, data: replies });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/admin/replies/:id/audit', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const reply = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(req.params.id);
    if (!reply) return res.status(404).json({ success: false, error: '评论不存在' });
    const action = String(req.body.action || '').trim();
    const comment = String(req.body.comment || '').trim().slice(0, 200);
    if (action === 'approve') {
      db.prepare("UPDATE forum_replies SET status = 'approved' WHERE id = ?").run(req.params.id);
      rebuildReplyCount(db, reply.post_id);
      touchPost(db, reply.post_id);
      createNotification(db, reply.user_id, {
        type: 'success',
        title: '论坛评论已通过审核',
        content: '您在论坛的评论已通过管理员审核，现已公开显示。',
        target_url: '#/forum/' + reply.post_id
      });
    } else if (action === 'reject') {
      db.prepare("UPDATE forum_replies SET status = 'rejected' WHERE id = ?").run(req.params.id);
    } else if (action === 'delete') {
      db.prepare("UPDATE forum_replies SET is_deleted = 1, deleted_by = ?, deleted_at = datetime('now','localtime') WHERE id = ?").run(req.user.id, req.params.id);
      rebuildReplyCount(db, reply.post_id);
    } else {
      return res.status(400).json({ success: false, error: '操作类型无效' });
    }
    insertModerationLog(db, { post_id: reply.post_id, reply_id: reply.id, action: `admin_${action}_reply`, stage: 2, operator_id: req.user.id, comment });
    res.json({ success: true, message: '评论处理完成' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/admin/reports/:id/handle', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const report = db.prepare(`
      SELECT fr.*, p.title as post_title
      FROM forum_reports fr
      LEFT JOIN forum_posts p ON fr.post_id = p.id
      WHERE fr.id = ?
    `).get(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: '举报记录不存在' });
    if (report.status !== 'pending') return res.status(400).json({ success: false, error: '该举报已处理' });

    const action = String(req.body.action || '').trim();
    if (!['resolve', 'dismiss'].includes(action)) {
      return res.status(400).json({ success: false, error: '操作类型无效' });
    }

    const postAction = ['none', 'hide', 'delete'].includes(req.body.post_action) ? req.body.post_action : 'none';
    const comment = String(req.body.comment || '').trim().slice(0, 200);
    const muteHours = Math.max(0, parseInt(req.body.mute_user_hours, 10) || 0);
    const target = resolveReportTarget(db, report);

    if (action === 'resolve') {
      applyReportTargetAction(db, target, postAction, req.user.id);
      if (target?.post_id) touchPost(db, target.post_id);
    }

    db.prepare(`
      UPDATE forum_reports
      SET status = ?, handled_by = ?, handled_at = datetime('now','localtime')
      WHERE id = ?
    `).run(action === 'resolve' ? 'resolved' : 'dismissed', req.user.id, report.id);

    if (action === 'resolve' && target?.user_id && muteHours > 0) {
      const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(target.user_id);
      if (targetUser && targetUser.role !== 'admin') {
        setUserMuteState(db, targetUser.id, muteHours);
        createNotification(db, targetUser.id, {
          type: 'warning',
          title: '论坛发言权限已限制',
          content: `因内容违规，您已被禁言 ${muteHours} 小时。`,
          target_url: '#/forum'
        });
      }
    }

    createNotification(db, report.reporter_id, {
      type: action === 'resolve' ? 'success' : 'info',
      title: action === 'resolve' ? '举报已处理' : '举报已核查',
      content: action === 'resolve'
        ? `您提交的举报「${report.reason}」已确认并处理。`
        : `您提交的举报「${report.reason}」经核查暂不成立。`,
      target_url: target?.target_url || '#/forum'
    });

    insertModerationLog(db, {
      post_id: target?.post_id || report.post_id || null,
      reply_id: target?.reply_id || null,
      action: `admin_${action}_report`,
      stage: 2,
      operator_id: req.user.id,
      comment: [comment, `report:${report.id}`, `target_action:${postAction}`, `mute_hours:${muteHours}`].filter(Boolean).join(' | ')
    });

    res.json({ success: true, message: action === 'resolve' ? '举报已处理' : '举报已驳回' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/admin/users/:id/mute', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    if (user.role === 'admin') return res.status(400).json({ success: false, error: '不能禁言管理员' });
    const { durationHours } = setUserMuteState(db, user.id, req.body.duration_hours);
    createNotification(db, user.id, {
      type: durationHours > 0 ? 'warning' : 'success',
      title: durationHours > 0 ? '论坛发言权限已限制' : '论坛禁言已解除',
      content: durationHours > 0 ? `您已被禁言 ${durationHours} 小时，请遵守社区规范。` : '您的论坛禁言已解除。',
      target_url: '#/forum'
    });
    res.json({ success: true, message: durationHours > 0 ? '已禁言用户' : '已解除禁言' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/admin/stats', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const overview = {
      total_posts: db.prepare('SELECT COUNT(*) as cnt FROM forum_posts WHERE is_deleted = 0').get().cnt,
      pending_posts: db.prepare("SELECT COUNT(*) as cnt FROM forum_posts WHERE is_deleted = 0 AND status = 'pending'").get().cnt,
      approved_posts: db.prepare("SELECT COUNT(*) as cnt FROM forum_posts WHERE is_deleted = 0 AND status = 'approved'").get().cnt,
      featured_posts: db.prepare('SELECT COUNT(*) as cnt FROM forum_posts WHERE is_deleted = 0 AND is_featured = 1').get().cnt,
      pending_replies: db.prepare("SELECT COUNT(*) as cnt FROM forum_replies WHERE is_deleted = 0 AND status = 'pending'").get().cnt,
      pending_reports: db.prepare("SELECT COUNT(*) as cnt FROM forum_reports WHERE status = 'pending'").get().cnt,
      muted_users: db.prepare("SELECT COUNT(*) as cnt FROM users WHERE muted_until != '' AND datetime(muted_until) > datetime('now')").get().cnt
    };
    const category_stats = db.prepare(`
      SELECT category, COUNT(*) as cnt
      FROM forum_posts
      WHERE is_deleted = 0
      GROUP BY category
      ORDER BY cnt DESC
    `).all();
    const hot_posts = db.prepare(`
      SELECT id, title, like_count, favorite_count, reply_count, report_count
      FROM forum_posts
      WHERE is_deleted = 0 AND status = 'approved'
      ORDER BY (like_count + favorite_count + reply_count * 2) DESC, view_count DESC
      LIMIT 8
    `).all();
    const reports = db.prepare(`
      SELECT fr.*, u.name as reporter_name, p.title as post_title
      FROM forum_reports fr
      JOIN users u ON fr.reporter_id = u.id
      LEFT JOIN forum_posts p ON fr.post_id = p.id
      ORDER BY CASE fr.status WHEN 'pending' THEN 0 ELSE 1 END, datetime(fr.created_at) DESC
      LIMIT 20
    `).all();
    res.json({ success: true, data: { overview, category_stats, hot_posts, reports } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { forumRouter: router, aiRouter: AI_ROUTER };
