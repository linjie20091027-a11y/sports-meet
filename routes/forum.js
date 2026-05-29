const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) return next();
  const { verifyToken } = require('../middleware/auth');
  const decoded = verifyToken(token);
  if (decoded) req.user = decoded;
  next();
}

// GET /posts — 帖子列表
router.get('/posts', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const total = db.prepare(
      'SELECT COUNT(*) as cnt FROM forum_posts WHERE is_deleted = 0'
    ).get().cnt;

    const posts = db.prepare(`
      SELECT p.id, p.title, p.content, p.view_count, p.reply_count, p.created_at, p.updated_at,
        u.id as user_id, u.name as author_name, u.class_name, u.role as author_role
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_deleted = 0
      ORDER BY p.is_pinned DESC, p.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({ success: true, data: { list: posts, total, page, limit } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /posts/:id — 帖子詳情含回覆
router.get('/posts/:id', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare(`
      SELECT p.*, u.name as author_name, u.class_name, u.role as author_role
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ? AND p.is_deleted = 0
    `).get(req.params.id);

    if (!post) return res.status(404).json({ success: false, error: '帖子不存在或已刪除' });

    db.prepare('UPDATE forum_posts SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);

    const replies = db.prepare(`
      SELECT r.id, r.content, r.created_at, r.user_id,
        u.name as author_name, u.class_name, u.role as author_role
      FROM forum_replies r
      JOIN users u ON r.user_id = u.id
      WHERE r.post_id = ? AND r.is_deleted = 0
      ORDER BY r.created_at ASC
    `).all(req.params.id);

    res.json({ success: true, data: { post, replies } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /posts — 發帖（需登入）
router.post('/posts', authMiddleware, (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ success: false, error: '標題與內容不能為空' });
    }
    if (title.length > 120) {
      return res.status(400).json({ success: false, error: '標題不能超過 120 字' });
    }
    const db = getDb();
    const r = db.prepare(
      'INSERT INTO forum_posts (user_id, title, content) VALUES (?, ?, ?)'
    ).run(req.user.id, title.trim(), content.trim());

    res.json({ success: true, data: { id: r.lastInsertRowid }, message: '發布成功' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /posts/:id/replies — 回覆
router.post('/posts/:id/replies', authMiddleware, (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ success: false, error: '回覆內容不能為空' });
    }
    const db = getDb();
    const post = db.prepare(
      'SELECT id, user_id, title FROM forum_posts WHERE id = ? AND is_deleted = 0'
    ).get(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: '帖子不存在' });

    db.prepare(
      'INSERT INTO forum_replies (post_id, user_id, content) VALUES (?, ?, ?)'
    ).run(post.id, req.user.id, content.trim());

    db.prepare(`
      UPDATE forum_posts SET reply_count = reply_count + 1,
        updated_at = datetime('now','localtime') WHERE id = ?
    `).run(post.id);

    if (post.user_id !== req.user.id) {
      createNotification(db, post.user_id, {
        type: 'info',
        title: '論壇有新回覆',
        content: `${req.user.name || req.user.username} 回覆了您的帖子「${post.title}」`,
        target_url: `#/forum/${post.id}`
      });
    }

    res.json({ success: true, message: '回覆成功' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /posts/:id — 管理員刪帖
router.delete('/posts/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare('SELECT id, user_id, title FROM forum_posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: '帖子不存在' });

    db.prepare(`
      UPDATE forum_posts SET is_deleted = 1, deleted_by = ?, deleted_at = datetime('now','localtime')
      WHERE id = ?
    `).run(req.user.id, req.params.id);

    createNotification(db, post.user_id, {
      type: 'warning',
      title: '帖子已被管理員刪除',
      content: `您的帖子「${post.title}」因違規或管理需要已被刪除。`,
      target_url: '#/forum'
    });

    res.json({ success: true, message: '帖子已刪除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /replies/:id — 管理員刪回覆
router.delete('/replies/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const reply = db.prepare('SELECT id, post_id, user_id FROM forum_replies WHERE id = ?').get(req.params.id);
    if (!reply) return res.status(404).json({ success: false, error: '回覆不存在' });

    db.prepare(`
      UPDATE forum_replies SET is_deleted = 1, deleted_by = ?, deleted_at = datetime('now','localtime')
      WHERE id = ?
    `).run(req.user.id, req.params.id);

    db.prepare(
      'UPDATE forum_posts SET reply_count = reply_count - 1 WHERE id = ? AND reply_count > 0'
    ).run(reply.post_id);

    res.json({ success: true, message: '回覆已刪除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
