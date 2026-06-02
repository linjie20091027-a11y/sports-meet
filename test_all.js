const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { sortSportGroups, BUSINESS_ORDER } = require('./utils/sportGroupOrder');
const { buildCloudDbConfig, maskDatabaseUrl } = require('./config/cloudDatabase');
const { buildBackupFileName, pruneBackupList } = require('./database/backupManager');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const DB_PATH = path.join(__dirname, 'database', 'sports_meet.db');

const PASS = '\x1b[32m[PASS]\x1b[0m';
const FAIL = '\x1b[31m[FAIL]\x1b[0m';
const INFO = '\x1b[33m[INFO]\x1b[0m';
const SKIP = '\x1b[36m[SKIP]\x1b[0m';

let results = { total: 0, passed: 0, failed: 0, skipped: 0 };
let adminToken = null;
let adminUser = null;
let studentPrimaryToken = null;
let studentSecondaryToken = null;
let studentTertiaryToken = null;
let forumTestPostId = null;
let forumTestReplyId = null;

// ========== HTTP ==========
function request(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    const parsed = new URL(path, BASE);
    const options = {
      hostname: parsed.hostname, port: parsed.port,
      path: parsed.pathname + parsed.search, method, headers, timeout: 10000
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let data;
        try { data = JSON.parse(body); } catch { data = body; }
        resolve({ status: res.statusCode, headers: res.headers, body: data, raw: body });
      });
    });
    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

async function test(module, name, fn) {
  results.total++;
  process.stdout.write(`  [${module}] ${name}... `);
  try {
    const r = await fn();
    if (r === true) { results.passed++; console.log(PASS); }
    else { results.failed++; console.log(`${FAIL} ${r}`); }
  } catch (e) {
    results.failed++;
    console.log(`${FAIL} ${e.message}`);
  }
}

async function testSkip(module, name, reason) {
  results.total++; results.skipped++;
  console.log(`  [${module}] ${name}... ${SKIP} ${reason}`);
}

// ========== 从数据库读取验证码 ==========
async function readCaptchaFromDb(captchaToken) {
  const initSqlJs = require('sql.js');
  await new Promise(r => setTimeout(r, 300));
  try {
    const buf = fs.readFileSync(DB_PATH);
    const sql = await initSqlJs();
    const db = new sql.Database(buf);
    // sql.js exec() 不支持参数绑定，用 prepare 方式
    let code = null;
    try {
      const stmt = db.prepare("SELECT code FROM captchas WHERE token = ? ORDER BY id DESC LIMIT 1");
      stmt.bind([captchaToken]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        code = row.code;
      }
      stmt.free();
    } catch (e) {
      console.error(`\n  DB读取错误: ${e.message}`);
    }
    db.close();
    return code;
  } catch (e) {
    return null;
  }
}

// ========== 登录函数 ==========
async function tryLogin(email, password) {
  // 获取验证码
  const capRes = await request('GET', '/api/auth/captcha');
  if (!capRes.body?.data?.token) return null;

  const token = capRes.body.data.token;
  // 从数据库读取验证码
  const code = await readCaptchaFromDb(token);
  if (!code) return null;

  // 尝试登录
  const res = await request('POST', '/api/auth/login', {
    body: { email, password, captchaToken: token, captchaCode: code }
  });

  if (res.status === 200 && res.body?.success && res.body?.data?.token) {
    return { token: res.body.data.token, user: res.body.data.user };
  }
  // 如果验证码被消耗但密码错误，可能需要重新获取
  return null;
}

async function runAllTests() {
  console.log('\n========== 全面功能测试报告 ==========');
  console.log(`目标: ${BASE}`);
  console.log(`时间: ${new Date().toISOString()}\n`);

  // =====================================================
  // 1. 公开 API
  // =====================================================
  console.log('━━━ 1. 公开页面（无需登录） ━━━');

  await test('公开', 'GET /api/public/meet-info', async () => {
    const res = await request('GET', '/api/public/meet-info');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if (res.body?.data) {
      console.log(` (名称:"${res.body.data.name}", 主题:"${(res.body.data.theme||'').slice(0,20)}")`);
      return true;
    }
    return '响应缺少 data 字段';
  });

  await test('公开', 'GET /api/public/events', async () => {
    const res = await request('GET', '/api/public/events');
    if (res.status !== 200) return `状态码 ${res.status}`;
    const len = Array.isArray(res.body?.data) ? res.body.data.length : '?';
    console.log(` (${len} 个项目)`);
    return true;
  });

  await test('公开', 'GET /api/public/events/1', async () => {
    const res = await request('GET', '/api/public/events/1');
    if (res.status !== 200) return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,120)}`;
    if (res.body?.data) {
      console.log(` (项目: ${res.body.data.name}, 类型: ${res.body.data.category})`);
      return true;
    }
    return '响应缺少 data 字段';
  });

  await test('公开', 'GET /api/public/results', async () => {
    const res = await request('GET', '/api/public/results');
    if (res.status !== 200) return `状态码 ${res.status}`;
    const len = Array.isArray(res.body?.data) ? res.body.data.length : '?';
    console.log(` (${len} 条成绩)`);
    return true;
  });

  await test('公开', 'GET /api/public/announcements', async () => {
    const res = await request('GET', '/api/public/announcements');
    if (res.status !== 200) return `状态码 ${res.status}`;
    const len = Array.isArray(res.body?.data) ? res.body.data.length : '?';
    console.log(` (${len} 条公告)`);
    return true;
  });

  await test('公开', 'GET /api/public/grades', async () => {
    const res = await request('GET', '/api/public/grades');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if (res.body?.data) {
      const cnt = Array.isArray(res.body.data) ? `${res.body.data.length}个年级` : 'OK';
      console.log(` (${cnt})`);
      return true;
    }
    return '响应缺少 data 字段';
  });

  await test('公开', 'GET /api/public/stats/overview', async () => {
    const res = await request('GET', '/api/public/stats/overview');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if (res.body?.data) {
      console.log(` (报名${res.body.data.total_registrations}, 项目${res.body.data.total_events}, 赛程${res.body.data.completed_schedules})`);
      return true;
    }
    return '响应缺少 data 字段';
  });

  await test('公开', 'GET /api/public/search?q=100米', async () => {
    const res = await request('GET', '/api/public/search?q=100%E7%B1%B3');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if (res.body?.data) {
      const d = res.body.data;
      console.log(` (items:${d.items?.length||0}, total:${d.total||0})`);
      return true;
    }
    return '响应缺少 data 字段';
  });

  await test('公开', 'GET /api/public/search 空输入', async () => {
    const res = await request('GET', '/api/public/search?q=');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if ((res.body?.data?.total || 0) !== 0) return `预期 total=0，实际 ${res.body?.data?.total}`;
    return true;
  });

  await test('公开', 'GET /api/public/search 联想词', async () => {
    const res = await request('GET', '/api/public/search/suggest?q=100');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if (!Array.isArray(res.body?.data)) return '联想结果不是数组';
    console.log(` (${res.body.data.length} 条联想)`);
    return true;
  });

  await test('公开', 'GET /api/public/search 学生账号检索', async () => {
    const res = await request('GET', '/api/public/search?q=20250001');
    if (res.status !== 200) return `状态码 ${res.status}`;
    const hasUser = Array.isArray(res.body?.data?.items) && res.body.data.items.some(item => item.type === 'users' && item.account === '20250001');
    if (!hasUser) return '未返回匹配的学生账号结果';
    return true;
  });

  await test('公开', 'GET /api/public/search 管理员账号检索', async () => {
    const res = await request('GET', '/api/public/search?q=admin');
    if (res.status !== 200) return `状态码 ${res.status}`;
    const hasUser = Array.isArray(res.body?.data?.items) && res.body.data.items.some(item => item.type === 'users' && item.account === 'admin');
    if (!hasUser) return '未返回匹配的管理员账号结果';
    return true;
  });

  await test('公开', 'GET /api/public/search 管理员邮箱检索', async () => {
    const res = await request('GET', '/api/public/search?q=admin%40hkms.hktedu.com');
    if (res.status !== 200) return `状态码 ${res.status}`;
    const hasUser = Array.isArray(res.body?.data?.items) && res.body.data.items.some(item => item.type === 'users' && item.account === 'admin');
    if (!hasUser) return '未返回匹配的管理员邮箱结果';
    return true;
  });

  await test('公开', 'GET /api/public/search 多关键字组合', async () => {
    const res = await request('GET', '/api/public/search?q=100%E7%B1%B3%20%E7%94%B7%E5%AD%90&type=events');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if (!Array.isArray(res.body?.data?.items)) return 'items 不是数组';
    console.log(` (${res.body.data.items.length} 条项目结果)`);
    return true;
  });

  await test('公开', 'GET /api/public/search 无匹配结果', async () => {
    const res = await request('GET', '/api/public/search?q=__no_match_keyword__');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if ((res.body?.data?.total || 0) !== 0) return `预期无匹配，实际 ${res.body?.data?.total}`;
    return true;
  });

  await test('公开', 'GET /api/public/search 分类筛选与分页', async () => {
    const res = await request('GET', '/api/public/search?q=%E7%B1%B3&type=events&page=1&limit=5&category=track');
    if (res.status !== 200) return `状态码 ${res.status}`;
    const data = res.body?.data || {};
    if ((data.items || []).length > 5) return `分页失败，返回 ${(data.items || []).length} 条`;
    return true;
  });

  await test('公开', 'GET /api/public/search 响应时长', async () => {
    const startedAt = Date.now();
    const res = await request('GET', '/api/public/search?q=100%E7%B1%B3&type=all&limit=12');
    const elapsed = Date.now() - startedAt;
    if (res.status !== 200) return `状态码 ${res.status}`;
    console.log(` (${elapsed}ms)`);
    if (elapsed > 500) return `响应超过 500ms: ${elapsed}ms`;
    return true;
  });

  await test('公开', '运动组别业务排序规则', async () => {
    const sorted = sortSportGroups(['A', 'C', 'E', 'B', 'D', 'A', 'Z']);
    const expected = ['E', 'D', 'C', 'B', 'A', 'Z'];
    if (JSON.stringify(BUSINESS_ORDER) !== JSON.stringify(['E', 'D', 'C', 'B', 'A'])) {
      return `业务顺序异常: ${JSON.stringify(BUSINESS_ORDER)}`;
    }
    if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
      return `排序结果异常: ${JSON.stringify(sorted)}`;
    }
    console.log(` (${sorted.join(' -> ')})`);
    return true;
  });

  await test('公开', '云数据库配置脱敏', async () => {
    const masked = maskDatabaseUrl('postgresql://sports:secret123@example.com:5432/meet');
    if (!masked.includes('sports:***@')) return `脱敏失败: ${masked}`;
    if (masked.includes('secret123')) return `密码泄漏: ${masked}`;
    return true;
  });

  await test('公开', '云数据库配置构建', async () => {
    const config = buildCloudDbConfig({
      DATABASE_URL: 'postgresql://sports:secret123@example.com:5432/meet?sslmode=require',
      CLOUD_DB_SSL: 'true',
      CLOUD_DB_SCHEMA: 'public',
      LOCAL_DB_PATH: 'database/sports_meet.db'
    });
    if (!config.enabled) return '应识别为已启用云数据库';
    if (!config.sslEnabled) return 'SSL 标记解析失败';
    if (config.schema !== 'public') return `schema 异常: ${config.schema}`;
    if (!/sports:\*\*\*@/.test(config.maskedUrl)) return `脱敏 URL 异常: ${config.maskedUrl}`;
    return true;
  });

  await test('公开', '数据库备份命名与轮转', async () => {
    const backupName = buildBackupFileName('sports_meet', 'db', new Date('2026-06-02T10:11:12Z'));
    if (!/^sports_meet-\d{8}-\d{6}\.db$/.test(backupName)) return `备份文件名异常: ${backupName}`;
    const obsolete = pruneBackupList([
      { name: 'sports_meet-20260602-101112.db' },
      { name: 'sports_meet-20260602-101212.db' },
      { name: 'sports_meet-20260602-101312.db' }
    ], 2);
    if (obsolete.length !== 1 || obsolete[0].name !== 'sports_meet-20260602-101112.db') {
      return `备份轮转异常: ${JSON.stringify(obsolete)}`;
    }
    return true;
  });

  // =====================================================
  // 2. 认证功能
  // =====================================================
  console.log('\n━━━ 2. 认证功能 ━━━');

  await test('认证', 'GET /api/auth/captcha', async () => {
    const res = await request('GET', '/api/auth/captcha');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if (res.body?.data?.token && res.body?.data?.svg) {
      console.log(` (token:${res.body.data.token.slice(0,16)}..., 含SVG)`);
      return true;
    }
    return `格式异常: ${JSON.stringify(res.body).slice(0,120)}`;
  });

  // 管理员登录
  let loginSuccess = false;
  const loginResult = await tryLogin('admin@hkms.hktedu.com', 'admin123');
  if (loginResult) {
    adminToken = loginResult.token;
    adminUser = loginResult.user;
    loginSuccess = true;
  }

  await test('认证', 'POST /api/auth/login', async () => {
    if (loginSuccess) {
      console.log(` (${adminUser.role}: ${adminUser.name}, id=${adminUser.id})`);
      return true;
    }
    return '登录失败 — 无法认证';
  });

  await test('认证', 'POST /api/auth/register', async () => {
    const testEmail = `test_${Date.now()}@hkms.hktedu.com`;
    const regBody = {
      username: `test_${Date.now()}`, email: testEmail, password: 'test123456', name: '测试用户'
    };
    const res = await request('POST', '/api/auth/register', { body: regBody });
    if (res.status === 200 || res.status === 400) {
      console.log(` (状态${res.status})`);
      return true;
    }
    return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,100)}`;
  });

  // =====================================================
  // 3. 学生功能
  // =====================================================
  console.log('\n━━━ 3. 学生功能（需登录token） ━━━');

  // 尝试获取学生token
  let studentToken = null;
  if (adminToken) {
    // 尝试学生登录
    const stuResult = await tryLogin('20250001@hkms.hktedu.com', '123456');
    if (stuResult) {
      studentToken = stuResult.token;
      studentPrimaryToken = stuResult.token;
      const stu2Result = await tryLogin('20250002@hkms.hktedu.com', '123456');
      const stu3Result = await tryLogin('20250003@hkms.hktedu.com', '123456');
      studentSecondaryToken = stu2Result?.token || null;
      studentTertiaryToken = stu3Result?.token || null;
    } else {
      studentToken = adminToken; // 用管理员token回退
    }
  }

  if (studentToken) {
    await test('学生', 'GET /api/student/profile', async () => {
      const res = await request('GET', '/api/student/profile', { token: studentToken });
      if (res.status !== 200) return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,80)}`;
      if (res.body?.data) {
        console.log(` (用户: ${res.body.data.name || res.body.data.username})`);
        return true;
      }
      return `响应异常: ${JSON.stringify(res.body).slice(0,60)}`;
    });

    await test('学生', 'GET /api/student/events', async () => {
      const res = await request('GET', '/api/student/events', { token: studentToken });
      if (res.status !== 200) return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,80)}`;
      const len = Array.isArray(res.body?.data) ? res.body.data.length : '?';
      console.log(` (${len}个项目)`);
      return true;
    });

    await test('学生', 'POST /api/student/registrations', async () => {
      const res = await request('POST', '/api/student/registrations', {
        token: studentToken, body: { eventId: 1 }
      });
      if ([200, 201, 400, 403, 409].includes(res.status)) {
        console.log(` (状态${res.status})`);
        return true;
      }
      return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,100)}`;
    });

    await test('学生', 'GET /api/student/registrations', async () => {
      const res = await request('GET', '/api/student/registrations', { token: studentToken });
      if (res.status !== 200) return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,80)}`;
      const len = Array.isArray(res.body?.data) ? res.body.data.length : '?';
      console.log(` (${len}条报名)`);
      return true;
    });

    await test('学生', 'GET /api/student/my-schedules', async () => {
      const res = await request('GET', '/api/student/my-schedules', { token: studentToken });
      if (res.status !== 200) return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,80)}`;
      const len = Array.isArray(res.body?.data) ? res.body.data.length : '?';
      console.log(` (${len}条赛程)`);
      return true;
    });

    await test('学生', 'GET /api/student/my-results', async () => {
      const res = await request('GET', '/api/student/my-results', { token: studentToken });
      if (res.status !== 200) return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,80)}`;
      const len = Array.isArray(res.body?.data) ? res.body.data.length : '?';
      console.log(` (${len}条成绩)`);
      return true;
    });

    await test('学生', 'GET /api/student/friends', async () => {
      const res = await request('GET', '/api/student/friends', { token: studentToken });
      if (res.status !== 200) return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,120)}`;
      if (!res.body?.success) return `接口返回失败: ${JSON.stringify(res.body).slice(0,120)}`;
      if (!Array.isArray(res.body?.data?.friends)) return '好友列表不是数组';
      return true;
    });

    await test('学生', 'GET /api/student/notifications', async () => {
      const res = await request('GET', '/api/student/notifications', { token: studentToken });
      if (res.status !== 200) return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,120)}`;
      if (!Array.isArray(res.body?.data?.list)) return '通知列表不是数组';
      console.log(` (${res.body.data.list.length}条通知)`);
      return true;
    });

    await test('学生', 'GET /api/student/notifications/:id', async () => {
      const listRes = await request('GET', '/api/student/notifications', { token: studentToken });
      if (listRes.status !== 200) return `获取通知列表失败: ${listRes.status}`;
      const first = (listRes.body?.data?.list || [])[0];
      if (!first?.id) return '暂无通知可验证详情接口';
      const res = await request('GET', `/api/student/notifications/${first.id}`, { token: studentToken });
      if (res.status !== 200) return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,120)}`;
      if (!res.body?.data?.title) return '通知详情缺少标题';
      if (!Array.isArray(res.body?.data?.attachments)) return '通知附件字段不是数组';
      return true;
    });

    await test('学生', '好友申请同意流程闭环', async () => {
      if (!studentPrimaryToken || !studentSecondaryToken) return '缺少两个学生账号 token';

      const me = await request('GET', '/api/student/friends', { token: studentPrimaryToken });
      const peer = await request('GET', '/api/student/friends', { token: studentSecondaryToken });
      if (me.status !== 200 || peer.status !== 200) return `好友接口状态异常 ${me.status}/${peer.status}`;

      const myData = me.body?.data || {};
      const peerData = peer.body?.data || {};
      const alreadyFriends = (myData.friend_ids || []).includes(8) && (peerData.friend_ids || []).includes(7);

      if (!alreadyFriends) {
        const peerIncoming = (peerData.incoming || []).find(item => Number(item.requester_id) === 7 && item.status === 'pending');
        const myOutgoing = (myData.outgoing || []).find(item => Number(item.receiver_id) === 8 && item.status === 'pending');

        if (!peerIncoming && !myOutgoing) {
          const sendRes = await request('POST', '/api/student/friends/requests', {
            token: studentPrimaryToken,
            body: { target_user_id: 8, remark: '测试好友申请', friend_group: '同学' }
          });
          if (sendRes.status !== 200 || !sendRes.body?.success) {
            return `发送好友申请失败: ${JSON.stringify(sendRes.body).slice(0,120)}`;
          }
        }

        const peerRefresh = await request('GET', '/api/student/friends', { token: studentSecondaryToken });
        const pendingRequest = (peerRefresh.body?.data?.incoming || []).find(item => Number(item.requester_id) === 7 && item.status === 'pending');
        if (!pendingRequest) return '发送后仍未出现在接收方申请箱';

        const acceptRes = await request('PUT', `/api/student/friends/requests/${pendingRequest.id}/respond`, {
          token: studentSecondaryToken,
          body: { action: 'accept' }
        });
        if (acceptRes.status !== 200 || !acceptRes.body?.success) {
          return `同意好友申请失败: ${JSON.stringify(acceptRes.body).slice(0,120)}`;
        }
      }

      const doneA = await request('GET', '/api/student/friends', { token: studentPrimaryToken });
      const doneB = await request('GET', '/api/student/friends', { token: studentSecondaryToken });
      const pass = (doneA.body?.data?.friend_ids || []).includes(8) && (doneB.body?.data?.friend_ids || []).includes(7);
      if (!pass) return '双方好友列表未同步更新';
      console.log(' (7 <-> 8 已互为好友)');
      return true;
    });

    await test('学生', '好友申请拒绝流程闭环', async () => {
      if (!studentPrimaryToken || !studentTertiaryToken) return '缺少第三个学生账号 token';

      const thirdInbox = await request('GET', '/api/student/friends', { token: studentTertiaryToken });
      if (thirdInbox.status !== 200) return `获取第三个学生好友资料失败: ${thirdInbox.status}`;
      let pendingRequest = (thirdInbox.body?.data?.incoming || []).find(item => Number(item.requester_id) === 7 && item.status === 'pending');

      if (!pendingRequest) {
        const sendRes = await request('POST', '/api/student/friends/requests', {
          token: studentPrimaryToken,
          body: { target_user_id: 9, remark: '测试拒绝流程', friend_group: '同学' }
        });
        if (!(sendRes.status === 200 && sendRes.body?.success) && !String(sendRes.body?.error || '').includes('请到好友中心处理')) {
          return `发起拒绝测试申请失败: ${JSON.stringify(sendRes.body).slice(0,120)}`;
        }
        const refreshed = await request('GET', '/api/student/friends', { token: studentTertiaryToken });
        pendingRequest = (refreshed.body?.data?.incoming || []).find(item => Number(item.requester_id) === 7 && item.status === 'pending');
      }

      if (!pendingRequest) return '拒绝流程未找到待处理申请';

      const rejectRes = await request('PUT', `/api/student/friends/requests/${pendingRequest.id}/respond`, {
        token: studentTertiaryToken,
        body: { action: 'reject' }
      });
      if (rejectRes.status !== 200 || !rejectRes.body?.success) {
        return `拒绝好友申请失败: ${JSON.stringify(rejectRes.body).slice(0,120)}`;
      }

      const done = await request('GET', '/api/student/friends', { token: studentPrimaryToken });
      const outgoingRejected = (done.body?.data?.outgoing || []).some(item => Number(item.receiver_id) === 9 && item.status === 'rejected');
      if (!outgoingRejected) return '发起方未看到申请被拒绝状态';
      console.log(' (7 -> 9 已拒绝)');
      return true;
    });
  } else {
    for (const name of ['profile','events','registrations POST','registrations GET','my-schedules','my-results','friends accept flow','friends reject flow']) {
      await testSkip('学生', name, '无可用token');
    }
  }

  // =====================================================
  // 4. 论坛功能
  // =====================================================
  console.log('\n━━━ 4. 论坛功能 ━━━');

  await test('论坛', 'GET /api/forum/meta', async () => {
    const res = await request('GET', '/api/forum/meta');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if (!Array.isArray(res.body?.data?.categories)) return '分类数据缺失';
    console.log(` (分类${res.body.data.categories.length}项, 标签${res.body.data.tags?.length || 0}项)`);
    return true;
  });

  await test('论坛', 'GET /api/forum/posts', async () => {
    const res = await request('GET', '/api/forum/posts?page=1&limit=5');
    if (res.status !== 200) return `状态码 ${res.status}`;
    if (!Array.isArray(res.body?.data?.list)) return '帖子列表不是数组';
    console.log(` (列表${res.body.data.list.length}条, total:${res.body.data.total || 0})`);
    return true;
  });

  if (adminToken && studentPrimaryToken && studentSecondaryToken && studentTertiaryToken) {
    const primaryProfile = await request('GET', '/api/student/profile', { token: studentPrimaryToken });
    const secondaryProfile = await request('GET', '/api/student/profile', { token: studentSecondaryToken });
    const tertiaryProfile = await request('GET', '/api/student/profile', { token: studentTertiaryToken });
    const preflightUserIds = [primaryProfile.body?.data?.id, secondaryProfile.body?.data?.id, tertiaryProfile.body?.data?.id].filter(Boolean);
    for (const userId of preflightUserIds) {
      await request('PUT', `/api/forum/admin/users/${userId}/mute`, {
        token: adminToken,
        body: { duration_hours: 0 }
      });
    }

    const postStamp = Date.now();
    const postTitle = `论坛联调测试帖-${postStamp}`;
    const replyContent = `论坛联调评论-${postStamp}`;
    const forumAuthorToken = studentTertiaryToken;
    const forumViewerToken = studentSecondaryToken;
    const forumActorToken = studentPrimaryToken;

    await test('论坛', '学生发布待审帖子', async () => {
      const res = await request('POST', '/api/forum/posts', {
        token: forumAuthorToken,
        body: {
          title: postTitle,
          content: `<p>${replyContent} 正文 <strong>加粗</strong></p>`,
          category: 'general',
          tags: ['报名', '赛程'],
          attachments: []
        }
      });
      if (res.status !== 200 || !res.body?.success) return `发帖失败: ${JSON.stringify(res.body).slice(0, 120)}`;
      forumTestPostId = res.body?.data?.id || null;
      if (!forumTestPostId) return '返回缺少帖子ID';
      if (res.body?.data?.status !== 'pending') return `预期 pending，实际 ${res.body?.data?.status}`;
      console.log(` (post:${forumTestPostId})`);
      return true;
    });

    await test('论坛', '管理员审核通过帖子', async () => {
      if (!forumTestPostId) return '缺少帖子ID';
      const res = await request('PUT', `/api/forum/admin/posts/${forumTestPostId}/audit`, {
        token: adminToken,
        body: { action: 'approve', comment: '自动化测试通过' }
      });
      if (res.status !== 200 || !res.body?.success) return `审核失败: ${JSON.stringify(res.body).slice(0, 120)}`;
      return true;
    });

    await test('论坛', '帖子详情可见且支持互动状态', async () => {
      if (!forumTestPostId) return '缺少帖子ID';
      const res = await request('GET', `/api/forum/posts/${forumTestPostId}`, { token: forumViewerToken });
      if (res.status !== 200) return `状态码 ${res.status}`;
      if (Number(res.body?.data?.post?.id) !== Number(forumTestPostId)) return '帖子详情返回异常';
      return true;
    });

    await test('论坛', '第二学生点赞与收藏帖子', async () => {
      if (!forumTestPostId) return '缺少帖子ID';
      const likeRes = await request('POST', `/api/forum/posts/${forumTestPostId}/like`, {
        token: forumViewerToken,
        body: {}
      });
      const favRes = await request('POST', `/api/forum/posts/${forumTestPostId}/favorite`, {
        token: forumViewerToken,
        body: {}
      });
      if (likeRes.status !== 200 || !likeRes.body?.data?.liked) return `点赞失败: ${JSON.stringify(likeRes.body).slice(0, 120)}`;
      if (favRes.status !== 200 || !favRes.body?.data?.favorited) return `收藏失败: ${JSON.stringify(favRes.body).slice(0, 120)}`;
      return true;
    });

    await test('论坛', '第二学生提交待审评论', async () => {
      if (!forumTestPostId) return '缺少帖子ID';
      const res = await request('POST', `/api/forum/posts/${forumTestPostId}/replies`, {
        token: forumActorToken,
        body: { content: `<p>${replyContent}</p>` }
      });
      if (res.status !== 200 || !res.body?.success) return `评论失败: ${JSON.stringify(res.body).slice(0, 120)}`;
      return true;
    });

    await test('论坛', '管理员审核通过评论', async () => {
      const pendingRes = await request('GET', '/api/forum/admin/replies/pending', { token: adminToken });
      if (pendingRes.status !== 200) return `获取待审评论失败: ${pendingRes.status}`;
      const reply = (pendingRes.body?.data || []).find((item) => Number(item.post_id) === Number(forumTestPostId) && String(item.content || '').includes(replyContent));
      if (!reply) return '未找到刚提交的待审评论';
      forumTestReplyId = reply.id;
      const auditRes = await request('PUT', `/api/forum/admin/replies/${reply.id}/audit`, {
        token: adminToken,
        body: { action: 'approve', comment: '自动化测试通过' }
      });
      if (auditRes.status !== 200 || !auditRes.body?.success) return `评论审核失败: ${JSON.stringify(auditRes.body).slice(0, 120)}`;
      return true;
    });

    await test('论坛', '评论审核后详情页可见', async () => {
      if (!forumTestPostId) return '缺少帖子ID';
      const res = await request('GET', `/api/forum/posts/${forumTestPostId}`, { token: forumAuthorToken });
      if (res.status !== 200) return `状态码 ${res.status}`;
      const hasReply = Array.isArray(res.body?.data?.replies) && res.body.data.replies.some((item) => Number(item.id) === Number(forumTestReplyId));
      if (!hasReply) return '审核通过的评论未出现在详情页';
      return true;
    });

    await test('论坛', '第二学生举报帖子', async () => {
      if (!forumTestPostId) return '缺少帖子ID';
      const res = await request('POST', `/api/forum/posts/${forumTestPostId}/report`, {
        token: forumActorToken,
        body: { reason: '广告灌水', detail: '自动化测试举报流程' }
      });
      if (res.status !== 200 || !res.body?.success) return `举报失败: ${JSON.stringify(res.body).slice(0, 120)}`;
      return true;
    });

    await test('论坛', '管理员处理举报并触发禁言', async () => {
      const statsRes = await request('GET', '/api/forum/admin/stats', { token: adminToken });
      if (statsRes.status !== 200) return `获取论坛统计失败: ${statsRes.status}`;
      const report = (statsRes.body?.data?.reports || []).find((item) => Number(item.post_id) === Number(forumTestPostId) && item.status === 'pending');
      if (!report) return '未找到待处理举报';
      const handleRes = await request('PUT', `/api/forum/admin/reports/${report.id}/handle`, {
        token: adminToken,
        body: { action: 'resolve', post_action: 'none', mute_user_hours: 1, comment: '自动化测试处理' }
      });
      if (handleRes.status !== 200 || !handleRes.body?.success) return `处理举报失败: ${JSON.stringify(handleRes.body).slice(0, 120)}`;
      return true;
    });

    await test('论坛', '被禁言用户无法继续发帖', async () => {
      const res = await request('POST', '/api/forum/posts', {
        token: forumAuthorToken,
        body: {
          title: `禁言校验帖-${Date.now()}`,
          content: '<p>禁言状态发帖校验</p>',
          category: 'general',
          tags: ['规则']
        }
      });
      if (res.status !== 403) return `预期 403，实际 ${res.status}`;
      if (!String(res.body?.error || '').includes('禁言')) return `错误信息异常: ${JSON.stringify(res.body).slice(0, 120)}`;
      return true;
    });

    await test('论坛', '管理员解除禁言', async () => {
      const profile = await request('GET', '/api/student/profile', { token: forumAuthorToken });
      const userId = profile.body?.data?.id;
      if (!userId) return '未获取到被禁言用户ID';
      const res = await request('PUT', `/api/forum/admin/users/${userId}/mute`, {
        token: adminToken,
        body: { duration_hours: 0 }
      });
      if (res.status !== 200 || !res.body?.success) return `解除禁言失败: ${JSON.stringify(res.body).slice(0, 120)}`;
      return true;
    });

    await test('论坛', '管理员清理自动化测试帖子', async () => {
      if (!forumTestPostId) return '缺少帖子ID';
      const res = await request('DELETE', `/api/forum/posts/${forumTestPostId}`, { token: adminToken });
      if (res.status !== 200 || !res.body?.success) return `清理失败: ${JSON.stringify(res.body).slice(0, 120)}`;
      return true;
    });
  } else {
    for (const name of ['GET meta','GET posts','create post','approve post','detail','like/favorite','reply','approve reply','report','handle report','mute verify','unmute','cleanup']) {
      await testSkip('论坛', name, '缺少管理员或学生 token');
    }
  }

  // =====================================================
  // 5. 管理员功能
  // =====================================================
  console.log('\n━━━ 5. 管理员功能（需登录token） ━━━');

  if (adminToken) {
    const adminEndpoints = [
      { path: 'dashboard', desc: '仪表盘' },
      { path: 'users', desc: '用户列表' },
      { path: 'events', desc: '项目管理' },
      { path: 'registrations', desc: '报名管理' },
      { path: 'schedules', desc: '赛程管理' },
      { path: 'results', desc: '成绩管理' },
      { path: 'logs', desc: '操作日志' },
    ];
    for (const ep of adminEndpoints) {
      await test('管理员', `GET /api/admin/${ep.path}`, async () => {
        const res = await request('GET', `/api/admin/${ep.path}`, { token: adminToken });
        if (res.status === 403) return `权限不足(403)`;
        if (res.status !== 200) return `状态码 ${res.status}: ${JSON.stringify(res.body).slice(0,80)}`;
        let info = '';
        if (res.body?.data && Array.isArray(res.body.data)) info = ` (${res.body.data.length}条)`;
        else if (res.body?.data) info = ' (OK)';
        console.log(info);
        return true;
      });
    }
  } else {
    for (const ep of ['dashboard','users','events','registrations','schedules','results','logs']) {
      await testSkip('管理员', `GET /api/admin/${ep}`, '无可用token');
    }
  }

  // =====================================================
  // 6. 前端页面
  // =====================================================
  console.log('\n━━━ 6. 前端页面 ━━━');

  const pages = [
    { path: '/', name: '首页' },
    { path: '/#/events', name: '赛事页' },
    { path: '/#/results', name: '成绩页' },
    { path: '/#/announcements', name: '公告页' },
    { path: '/#/forum', name: '论坛页' },
    { path: '/#/login', name: '登录页' },
  ];

  for (const page of pages) {
    await test('前端', `${page.name} GET ${page.path}`, async () => {
      const res = await request('GET', page.path);
      if (res.status !== 200) return `状态码 ${res.status}`;
      const html = res.raw.toLowerCase();
      if (!html.includes('<html') && !html.includes('<!doctype')) return '非HTML响应';
      const hasRoot = html.includes('id="root"') || html.includes('id="app"');
      console.log(` (${res.raw.length}bytes, root:${hasRoot})`);
      return true;
    });
  }

  // =====================================================
  // 总结
  // =====================================================
  console.log('\n========== 测试总结 ==========');
  console.log(`总计: ${results.total} 项`);
  console.log(`${PASS} 通过: ${results.passed}`);
  console.log(`${FAIL} 失败: ${results.failed}`);
  console.log(`${SKIP} 跳过: ${results.skipped}`);
  const valid = results.passed + results.failed;
  const rate = valid > 0 ? Math.round(results.passed / valid * 100) : 0;
  console.log(`通过率: ${rate}% (不含跳过)`);
  console.log('================================\n');
}

runAllTests().catch(e => {
  console.error('测试脚本异常:', e);
  process.exit(1);
});
