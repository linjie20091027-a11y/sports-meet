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
    if (!key) return res.json({ success: false, error: '請提供 API Key' });
    DEEPSEEK_API_KEY = key;
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('deepseek_api_key', ?)").run(key);
    res.json({ success: true, message: 'API Key 已保存' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// AI 对话路由
AI_ROUTER.post('/ai-chat', optionalAuth, async (req, res) => {
  try {
    loadApiKey();
    const { message } = req.body;
    if (!message?.trim()) return res.json({ success: false, error: '請輸入問題' });
    if (!DEEPSEEK_API_KEY) return res.json({ success: false, error: 'AI 助手尚未配置，請管理員設置 API Key' });

    const https = require('https');
    const systemPrompt = `你是澳門濠江中學運動會的智能助手「小濠」。你的職責：
1. 回答運動會相關問題（比賽規則、報名流程、賽程安排等）
2. 風格親切友好，像一個熱心的學生會成員
3. 用繁體中文回答，簡短精煉（200字以內）
4. 如果問題與運動會無關，禮貌引導回正題
5. 適當使用 emoji 增加親和力`;

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
            res.json({ success: false, error: result.error?.message || 'AI 回應異常' });
          }
        } catch (e) {
          res.json({ success: false, error: 'AI 回應解析失敗' });
        }
      });
    });

    apiReq.on('error', (e) => {
      res.json({ success: false, error: 'AI 服務暫不可用：' + e.message });
    });

    apiReq.write(JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    }));
    apiReq.end();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 檢查 API Key 狀態
AI_ROUTER.get('/ai-status', (req, res) => {
  res.json({ success: true, data: { configured: !!DEEPSEEK_API_KEY } });
});

module.exports = { forumRouter: router, aiRouter: AI_ROUTER };
