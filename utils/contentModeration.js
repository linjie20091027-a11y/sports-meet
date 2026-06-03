// ============================================================
// AI 内容审核模块
// DeepSeek: 论坛文字审核 (管理端开关控制)
// Doubao(豆包): 首页/论坛图片审核
// ============================================================

const https = require('https');
const http = require('http');
const { getDb } = require('../database/init');

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/chat/completions';
const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses';
const DOUBAO_MODEL = 'doubao-seed-2-0-pro-260215';

let DEEPSEEK_API_KEY = '';
let DOUBAO_API_KEY = '11d46d11-ac59-4369-842e-f0b929320344';

function loadKeys() {
  try {
    const db = getDb();
    const deepseekRow = db.prepare("SELECT value FROM settings WHERE key='deepseek_api_key'").get();
    if (deepseekRow) DEEPSEEK_API_KEY = deepseekRow.value;
  } catch(e) {}
}

function isModerationEnabled() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key='ai_moderation_enabled'").get();
    return row && row.value === '1';
  } catch(e) { return false; }
}

function apiRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('审核超时')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * DeepSeek 文字审核
 * @returns {{ safe: boolean, reason: string }}
 */
async function moderateText(text) {
  loadKeys();
  if (!isModerationEnabled()) return { safe: true, reason: '审核未启用' };
  if (!DEEPSEEK_API_KEY) return { safe: true, reason: 'API Key 未配置' };
  if (!text || text.trim().length < 4) return { safe: true, reason: '内容过短，跳过审核' };

  const prompt = `你是学校论坛内容审核员。请审核以下内容是否包含违规信息。
违规类型包括：
- 色情/低俗内容
- 辱骂/人身攻击/校园霸凌
- 广告/推销/外部链接诱导
- 违法/暴力/恐怖信息
- 个人隐私泄露（电话号码、身份证号、家庭住址）

请只回复一个JSON：{"safe":true,"reason":"通过"} 或 {"safe":false,"reason":"具体违规原因"}
不要回复其他任何内容。

待审核内容：
${text.substring(0, 2000)}`;

  try {
    const result = await apiRequest(DEEPSEEK_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      }
    }, {
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
      temperature: 0
    });

    const content = result.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { safe: parsed.safe !== false, reason: parsed.reason || '' };
    }
    return { safe: true, reason: '审核结果解析异常，默认通过' };
  } catch(e) {
    console.error('DeepSeek 文字审核失败:', e.message);
    return { safe: true, reason: '审核服务异常，默认通过' };
  }
}

/**
 * 豆包(Doubao) 图片审核
 * @param {string} imageUrl - 图片URL（完整公网可访问URL）
 * @returns {{ safe: boolean, reason: string }}
 */
async function moderateImage(imageUrl) {
  console.log('[豆包审核] 检查精彩瞬间图片:', imageUrl);
  if (!isModerationEnabled()) { console.log('[豆包审核] 审核未启用'); return { safe: true, reason: '审核未启用' }; }
  if (!imageUrl) return { safe: true, reason: '无图片' };

  try {
    console.log('[豆包审核] 调用豆包 API...');
    const result = await apiRequest(DOUBAO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOUBAO_API_KEY}`
      }
    }, {
      model: DOUBAO_MODEL,
      input: [{
        role: 'user',
        content: [
          { type: 'input_image', image_url: imageUrl },
          { type: 'input_text', text: '请审核这张图片是否包含：色情低俗、暴力血腥、辱骂文字、广告二维码、违法内容。只回复JSON：{"safe":true,"reason":"通过"} 或 {"safe":false,"reason":"违规原因"}。不要回复其他内容。' }
        ]
      }]
    });

    const content = result.output?.[0]?.content?.[0]?.text || result.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { safe: parsed.safe !== false, reason: parsed.reason || '' };
    }
    return { safe: true, reason: '图片审核结果解析异常，默认通过' };
  } catch(e) {
    console.error('豆包图片审核失败:', e.message);
    return { safe: true, reason: '图片审核服务异常，默认通过' };
  }
}

module.exports = { moderateText, moderateImage, isModerationEnabled };
