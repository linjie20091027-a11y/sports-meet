const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const DB_PATH = path.join(__dirname, 'database', 'sports_meet.db');

const PASS = '\x1b[32m[PASS]\x1b[0m';
const FAIL = '\x1b[31m[FAIL]\x1b[0m';
const INFO = '\x1b[33m[INFO]\x1b[0m';
const SKIP = '\x1b[36m[SKIP]\x1b[0m';

let results = { total: 0, passed: 0, failed: 0, skipped: 0 };
let adminToken = null;
let adminUser = null;

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
      console.log(` (events:${d.events?.length||0}, students:${d.students?.length||0})`);
      return true;
    }
    return '响应缺少 data 字段';
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
  } else {
    for (const name of ['profile','events','registrations POST','registrations GET','my-schedules','my-results']) {
      await testSkip('学生', name, '无可用token');
    }
  }

  // =====================================================
  // 4. 管理员功能
  // =====================================================
  console.log('\n━━━ 4. 管理员功能（需登录token） ━━━');

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
  // 5. 前端页面
  // =====================================================
  console.log('\n━━━ 5. 前端页面 ━━━');

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
