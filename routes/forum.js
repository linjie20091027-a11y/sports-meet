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

// GET /posts/:id — 帖子详情含回覆
router.get('/posts/:id', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare(`
      SELECT p.*, u.name as author_name, u.class_name, u.role as author_role
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ? AND p.is_deleted = 0
    `).get(req.params.id);

    if (!post) return res.status(404).json({ success: false, error: '帖子不存在或已删除' });

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

// POST /posts — 发帖（需登录）
router.post('/posts', authMiddleware, (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ success: false, error: '标题與内容不能為空' });
    }
    if (title.length > 120) {
      return res.status(400).json({ success: false, error: '标题不能超過 120 字' });
    }
    const db = getDb();
    const r = db.prepare(
      'INSERT INTO forum_posts (user_id, title, content) VALUES (?, ?, ?)'
    ).run(req.user.id, title.trim(), content.trim());

    res.json({ success: true, data: { id: r.lastInsertRowid }, message: '发布成功' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /posts/:id/replies — 回覆
router.post('/posts/:id/replies', authMiddleware, (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ success: false, error: '回覆内容不能為空' });
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

    const msg = req.user.role === 'admin' ? '回覆成功' : '回覆已提交，待管理员审核後显示';

    if (post.user_id !== req.user.id) {
      createNotification(db, post.user_id, {
        type: 'info',
        title: '论坛有新回覆',
        content: `${req.user.name || req.user.username} 回覆了您的帖子「${post.title}」`,
        target_url: `#/forum/${post.id}`
      });
    }

    res.json({ success: true, message: '回覆成功' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /posts/:id — 管理员删帖
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
      title: '帖子已被管理员删除',
      content: `您的帖子「${post.title}」因違規或管理需要已被删除。`,
      target_url: '#/forum'
    });

    res.json({ success: true, message: '帖子已删除' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /replies/:id — 管理员删回覆
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

    res.json({ success: true, message: '回覆已删除' });
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

// ===== 管理员审核回覆 =====
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
      type: 'success', title: '论坛回覆已通过审核',
      content: '您在论坛的回覆已通过管理员审核，现已公开显示。',
      target_url: '#/forum/' + reply.post_id
    });
    res.json({ success: true, message: '已通过' });
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
    res.json({ success: true, message: '已驳回' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { forumRouter: router, aiRouter: AI_ROUTER };
