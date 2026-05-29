const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:", "www.houkong.edu.mo", "images.unsplash.com", "upload.wikimedia.org"],
      fontSrc: ["'self'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.gstatic.com"],
    },
  },
}));
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试过多，请15分钟后再试' }
});
app.use('/api/auth/login', loginLimiter);

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/student', require('./routes/student'));
app.use('/api/forum', require('./routes/forum'));

// 前端SPA路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

// 异步启动：先初始化数据库，再启动服务器
function runDbMaintenance() {
  try {
    const { getDb } = require('./database/init');
    const db = getDb();
    db.prepare("DELETE FROM events WHERE name LIKE '%500000%'").run();
    db.prepare(`
      UPDATE users SET role = 'student'
      WHERE role = 'admin' AND id != 1
        AND (
          (student_id IS NOT NULL AND student_id != '')
          OR email GLOB '2025*@hkms.hktedu.com'
          OR email = '2100@hkms.hktedu.com'
        )
    `).run();
  } catch (e) {
    console.warn('資料庫維護跳過:', e.message);
  }
}

initDatabase().then(() => {
  runDbMaintenance();
  app.listen(PORT, () => {
    console.log(`運動會管理系統: http://localhost:${PORT}`);
    console.log(`管理員: admin@hkms.hktedu.com / admin123`);
    console.log(`學生測試: 20250001@hkms.hktedu.com / 123456`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});

module.exports = app;
