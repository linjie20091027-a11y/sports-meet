const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const svgCaptcha = require('svg-captcha');
const crypto = require('crypto');
const { getDb } = require('../database/init');
const { generateToken, logOperation, authMiddleware } = require('../middleware/auth');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const SCHOOL_EMAIL_SUFFIX = '@hkms.hktedu.com';

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
}

function verifyCaptcha(db, token, code) {
  const captcha = db.prepare(
    "SELECT * FROM captchas WHERE token = ? AND used = 0 AND datetime(created_at, '+5 minutes') > datetime('now','localtime')"
  ).get(token);
  if (!captcha) return false;
  if (captcha.code !== code) return false;
  db.prepare('UPDATE captchas SET used = 1 WHERE id = ?').run(captcha.id);
  return true;
}

router.post('/register', (req, res) => {
  try {
    const db = getDb();
    const { username, email, password, name, student_id, class_name, grade, captchaToken, captchaCode } = req.body;

    if (!username || !email || !password || !name) {
      return res.json({ success: false, error: '用户名、邮箱、密码、姓名为必填项' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.json({ success: false, error: '邮箱必须是 @hkms.hktedu.com 结尾' });
    }

    if (password.length < 6) {
      return res.json({ success: false, error: '密码至少需要6位' });
    }

    if (!captchaToken || !captchaCode) {
      return res.json({ success: false, error: '请输入验证码' });
    }

    if (!verifyCaptcha(db, captchaToken, captchaCode)) {
      return res.json({ success: false, error: '验证码错误或已过期' });
    }

    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return res.json({ success: false, error: '该邮箱已被注册' });
    }

    const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUsername) {
      return res.json({ success: false, error: '该用户名已被使用' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      "INSERT INTO users (username, email, password, role, name, student_id, class_name, grade) VALUES (?, ?, ?, 'student', ?, ?, ?, ?)"
    ).run(username, email, hashedPassword, name, student_id || '', class_name || '', grade || '');

    logOperation(result.lastInsertRowid, username, 'register', `用户注册: ${email}`, getClientIp(req));

    res.json({ success: true, message: '注册成功' });
  } catch (e) {
    console.error('注册失败:', e.message);
    res.json({ success: false, error: '注册失败，请稍后重试' });
  }
});

router.post('/login', (req, res) => {
  try {
    const db = getDb();
    const { email, password, captchaToken, captchaCode } = req.body;

    if (!email || !password) {
      return res.json({ success: false, error: '邮箱和密码为必填项' });
    }

    if (!captchaToken || !captchaCode) {
      return res.json({ success: false, error: '请输入验证码' });
    }

    if (!verifyCaptcha(db, captchaToken, captchaCode)) {
      return res.json({ success: false, error: '验证码错误或已过期' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.json({ success: false, error: '邮箱或密码错误' });
    }

    if (user.status === 'disabled') {
      return res.json({ success: false, error: '该账号已被禁用' });
    }

    if (user.failed_attempts >= 5 && user.locked_until) {
      const now = db.prepare("SELECT datetime('now','localtime') AS now").get().now;
      if (user.locked_until > now) {
        return res.json({ success: false, error: '账号已被锁定，请30分钟后再试' });
      }
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      const newAttempts = user.failed_attempts + 1;
      if (newAttempts >= 5) {
        db.prepare(
          "UPDATE users SET failed_attempts = ?, locked_until = datetime('now','+30 minutes','localtime') WHERE id = ?"
        ).run(newAttempts, user.id);
      } else {
        db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(newAttempts, user.id);
      }
      logOperation(user.id, user.username, 'login_failed', `登录失败(第${newAttempts}次): ${email}`, getClientIp(req));
      return res.json({ success: false, error: '邮箱或密码错误' });
    }

    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name
    });

    logOperation(user.id, user.username, 'login', `用户登录: ${email}`, getClientIp(req));

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name
        }
      }
    });
  } catch (e) {
    console.error('登录失败:', e.message);
    res.json({ success: false, error: '登录失败，请稍后重试' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, email, role, name, student_id, class_name, grade FROM users WHERE id = ?'
    ).get(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用戶不存在' });
    }
    res.json({ success: true, data: user });
  } catch (e) {
    res.status(500).json({ success: false, error: '無法取得用戶資訊' });
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  logOperation(req.user.id, req.user.username, 'logout', '用戶登出', getClientIp(req));
  res.json({ success: true, message: '已登出' });
});

router.get('/captcha', (req, res) => {
  try {
    const db = getDb();
    const captcha = svgCaptcha.create({
      size: 4,
      ignoreChars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      noise: 3,
      color: true,
      background: '#f5f5f5'
    });

    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO captchas (token, code) VALUES (?, ?)').run(token, captcha.text);

    logOperation(null, null, 'captcha', '生成验证码', getClientIp(req));

    res.json({ success: true, data: { token, svg: captcha.data } });
  } catch (e) {
    console.error('验证码生成失败:', e.message);
    res.json({ success: false, error: '验证码生成失败' });
  }
});

router.post('/forgot-password', (req, res) => {
  try {
    const db = getDb();
    const { email } = req.body;

    if (!email) {
      return res.json({ success: false, error: '请输入邮箱地址' });
    }

    const user = db.prepare('SELECT id, username FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.json({ success: false, error: '该邮箱未注册' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    db.prepare(
      "INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, datetime('now','+30 minutes','localtime'))"
    ).run(email, token);

    logOperation(user.id, user.username, 'forgot_password', `密码重置请求: ${email}`, getClientIp(req));

    res.json({ success: true, message: '密码重置链接已发送', data: { token } });
  } catch (e) {
    console.error('忘记密码失败:', e.message);
    res.json({ success: false, error: '操作失败，请稍后重试' });
  }
});

router.post('/reset-password', (req, res) => {
  try {
    const db = getDb();
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.json({ success: false, error: 'token和新密码为必填项' });
    }

    if (newPassword.length < 6) {
      return res.json({ success: false, error: '密码至少需要6位' });
    }

    const resetRecord = db.prepare(
      "SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > datetime('now','localtime')"
    ).get(token);

    if (!resetRecord) {
      return res.json({ success: false, error: '重置链接无效或已过期' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashedPassword, resetRecord.email);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);

    const user = db.prepare('SELECT id, username FROM users WHERE email = ?').get(resetRecord.email);
    logOperation(user.id, user.username, 'reset_password', '密码重置成功', getClientIp(req));

    res.json({ success: true, message: '密码重置成功' });
  } catch (e) {
    console.error('密码重置失败:', e.message);
    res.json({ success: false, error: '密码重置失败，请稍后重试' });
  }
});

module.exports = router;
