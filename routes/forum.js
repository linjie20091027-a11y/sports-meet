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
      SELECT r.id, r.content, r.created_at, r.user_id, r.status,
        u.name as author_name, u.class_name, u.role as author_role
      FROM forum_replies r
      JOIN users u ON r.user_id = u.id
      WHERE r.post_id = ? AND r.is_deleted = 0
        AND (r.status = 'approved' OR r.user_id = ?)
      ORDER BY r.created_at ASC
    `).all(req.params.id, req.user?.id || 0);

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
      'INSERT INTO forum_replies (post_id, user_id, content, status) VALUES (?, ?, ?, ?)'
    ).run(post.id, req.user.id, content.trim(), req.user.role === 'admin' ? 'approved' : 'pending');

    if (req.user.role === 'admin') {
      db.prepare(`
        UPDATE forum_posts SET reply_count = reply_count + 1,
          updated_at = datetime('now','localtime') WHERE id = ?
      `).run(post.id);
    }

    const msg = req.user.role === 'admin' ? '回覆成功' : '回覆已提交，待管理員審核後顯示';

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
    const db = getDb();

    // 構建實時上下文
    const meet = db.prepare("SELECT * FROM meet_info WHERE id=1").get() || {};
    const events = db.prepare("SELECT name, category, event_type, gender_group, venue, max_participants FROM events WHERE status='active' ORDER BY sort_order LIMIT 20").all();
    const totalRegs = db.prepare("SELECT COUNT(*) as cnt FROM registrations").get()?.cnt || 0;
    const pendingRegs = db.prepare("SELECT COUNT(*) as cnt FROM registrations WHERE status='pending'").get()?.cnt || 0;
    const schedules = db.prepare("SELECT COUNT(*) as cnt FROM schedules WHERE status='published'").get()?.cnt || 0;
    const maxEvents = db.prepare("SELECT value FROM settings WHERE key='max_events_per_student'").get()?.value || '3';

    const eventList = events.map(e => {
      const gender = e.gender_group === 'male' ? '男子' : e.gender_group === 'female' ? '女子' : '混合';
      const type = e.event_type === 'team' ? '集體' : '個人';
      return `${e.name}（${gender}${type}，場地：${e.venue||'待定'}）`;
    }).join('；');

    const context = `【澳門濠江中學資料庫】
建校於1932年，校訓「忠誠、勤奮、求實、創新」。位於澳門青洲大馬路，設有幼稚園、小學部、中學部。校園約15,000平方米，擁有標準田徑場、室內體育館、游泳池、圖書館等設施。全校約200名教職員，體育科組8位專業教師。畢業生升學率超95%。
校址：Rua do Comandante João Belo, Macau。電話：(+853) 2822 1234。官網：www.houkong.edu.mo。

【當前運動會實時數據】
- 運動會名稱：${meet.name||'學校運動會'}
- 舉辦日期：${meet.start_date||'待定'} 至 ${meet.end_date||'待定'}
- 報名狀態：${meet.registration_open?'已開放':'已關閉'}
- 比賽項目總數：${events.length}個
- 已報名人次：${totalRegs}，待審核：${pendingRegs}
- 已發布賽程：${schedules}場
- 每人限報：${maxEvents}個項目`;

    const systemPrompt = `你是澳門濠江中學運動會的官方AI助手「小濠」🏅。你的設定：

**身份**：濠江中學學生會宣傳部成員，熱心、專業、靠譜，對運動會瞭如指掌。

**能力範圍**：
1. 回答運動會相關的所有問題（項目規則、報名流程、賽程安排、場地指引、成績查詢等）
2. 根據上方【實時數據】提供準確的最新資訊
3. 引導學生正確完成報名、查看成績等操作

**回答風格**：
- 熱情但專業，像學長學姐般親切
- 繁體中文，可適當夾雜粵語口語詞（如「唔使擔心」「記得準時」）
- 每次回答控制在150字以內，重點突出
- 善用 emoji 增加可讀性但不濫用
- 如果問題超出運動會範圍，友好提示並引導回來

**重要提醒**：提及數字時務必參照上方【實時數據】，不要憑空編造。`;

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
        { role: 'user', content: context },
        { role: 'user', content: message }
      ],
      max_tokens: 600,
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

// ===== 管理員審核回覆 =====
router.get('/pending-replies', authMiddleware, adminOnly, (req, res) => {
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

router.put('/replies/:id/approve', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const reply = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(req.params.id);
    if (!reply) return res.status(404).json({ success: false, error: '回覆不存在' });
    db.prepare("UPDATE forum_replies SET status = 'approved' WHERE id = ?").run(req.params.id);
    db.prepare("UPDATE forum_posts SET reply_count = reply_count + 1, updated_at = datetime('now','localtime') WHERE id = ?").run(reply.post_id);
    createNotification(db, reply.user_id, {
      type: 'success', title: '論壇回覆已通過審核',
      content: '您在論壇的回覆已通過管理員審核，現已公開顯示。',
      target_url: '#/forum/' + reply.post_id
    });
    res.json({ success: true, message: '已通過' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/replies/:id/reject', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const reply = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(req.params.id);
    if (!reply) return res.status(404).json({ success: false, error: '回覆不存在' });
    db.prepare("UPDATE forum_replies SET status = 'rejected' WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: '已駁回' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { forumRouter: router, aiRouter: AI_ROUTER };
