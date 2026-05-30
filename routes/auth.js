const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const svgCaptcha = require('svg-captcha');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { generateToken, logOperation } = require('../middleware/auth');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const SCHOOL_EMAIL_SUFFIX = '@hkms.hktedu.com';

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
}

async function verifyCaptcha(token, code) {
  const captcha = await prisma.captcha.findFirst({
    where: { token, used: 0 }
  });
  if (!captcha) return false;
  const age = Date.now() - new Date(captcha.createdAt).getTime();
  if (age > 5 * 60 * 1000) return false;
  if (captcha.code !== code) return false;
  await prisma.captcha.update({
    where: { id: captcha.id },
    data: { used: 1 }
  });
  return true;
}

router.post('/register', async (req, res) => {
  try {
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

    if (!(await verifyCaptcha(captchaToken, captchaCode))) {
      return res.json({ success: false, error: '验证码错误或已过期' });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.json({ success: false, error: '该邮箱已被注册' });
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return res.json({ success: false, error: '该用户名已被使用' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'student',
        name,
        studentId: student_id || '',
        className: class_name || '',
        grade: grade || ''
      }
    });

    await logOperation(newUser.id, username, 'register', `用户注册: ${email}`, getClientIp(req));

    res.json({ success: true, message: '注册成功' });
  } catch (e) {
    console.error('注册失败:', e.message);
    res.json({ success: false, error: '注册失败，请稍后重试' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, captchaToken, captchaCode } = req.body;

    if (!email || !password) {
      return res.json({ success: false, error: '邮箱和密码为必填项' });
    }

    if (!captchaToken || !captchaCode) {
      return res.json({ success: false, error: '请输入验证码' });
    }

    if (!(await verifyCaptcha(captchaToken, captchaCode))) {
      return res.json({ success: false, error: '验证码错误或已过期' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ success: false, error: '邮箱或密码错误' });
    }

    if (user.status === 'disabled') {
      return res.json({ success: false, error: '该账号已被禁用' });
    }

    if (user.failedAttempts >= 5 && user.lockedUntil) {
      if (new Date(user.lockedUntil) > new Date()) {
        return res.json({ success: false, error: '账号已被锁定，请30分钟后再试' });
      }
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      const newAttempts = user.failedAttempts + 1;
      if (newAttempts >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: newAttempts, lockedUntil: new Date(Date.now() + 30 * 60 * 1000) }
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: newAttempts }
        });
      }
      await logOperation(user.id, user.username, 'login_failed', `登录失败(第${newAttempts}次): ${email}`, getClientIp(req));
      return res.json({ success: false, error: '邮箱或密码错误' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null }
    });

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name
    });

    await logOperation(user.id, user.username, 'login', `用户登录: ${email}`, getClientIp(req));

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

router.get('/me', require('../middleware/auth').authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, email: true, role: true, name: true, studentId: true, className: true, grade: true }
    });
    if (!user) {
      return res.status(404).json({ success: false, error: '用戶不存在' });
    }
    res.json({ success: true, data: user });
  } catch (e) {
    res.status(500).json({ success: false, error: '無法取得用戶資訊' });
  }
});

router.post('/logout', require('../middleware/auth').authMiddleware, async (req, res) => {
  await logOperation(req.user.id, req.user.username, 'logout', '用戶登出', getClientIp(req));
  res.json({ success: true, message: '已登出' });
});

router.get('/captcha', async (req, res) => {
  try {
    const captcha = svgCaptcha.create({
      size: 4,
      ignoreChars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      noise: 3,
      color: true,
      background: '#f5f5f5'
    });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.captcha.create({ data: { token, code: captcha.text } });

    await logOperation(null, null, 'captcha', '生成验证码', getClientIp(req));

    res.json({ success: true, data: { token, svg: captcha.data } });
  } catch (e) {
    console.error('验证码生成失败:', e.message);
    res.json({ success: false, error: '验证码生成失败' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({ success: false, error: '请输入邮箱地址' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ success: false, error: '该邮箱未注册' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.$executeRaw`INSERT INTO password_resets (email, token, created_at, used) VALUES (${email}, ${token}, datetime('now','localtime'), 0)`;

    await logOperation(user.id, user.username, 'forgot_password', `密码重置请求: ${email}`, getClientIp(req));

    res.json({ success: true, message: '密码重置链接已发送', data: { token } });
  } catch (e) {
    console.error('忘记密码失败:', e.message);
    res.json({ success: false, error: '操作失败，请稍后重试' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.json({ success: false, error: 'token和新密码为必填项' });
    }

    if (newPassword.length < 6) {
      return res.json({ success: false, error: '密码至少需要6位' });
    }

    const resetRecords = await prisma.$queryRaw`SELECT * FROM password_resets WHERE token = ${token} AND used = 0 AND created_at > datetime('now','-30 minutes','localtime')`;

    if (!resetRecords || resetRecords.length === 0) {
      return res.json({ success: false, error: '重置链接无效或已过期' });
    }

    const resetRecord = resetRecords[0];
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await prisma.user.update({
      where: { email: resetRecord.email },
      data: { password: hashedPassword }
    });
    await prisma.$executeRaw`UPDATE password_resets SET used = 1 WHERE id = ${resetRecord.id}`;

    const user = await prisma.user.findUnique({ where: { email: resetRecord.email } });
    await logOperation(user.id, user.username, 'reset_password', '密码重置成功', getClientIp(req));

    res.json({ success: true, message: '密码重置成功' });
  } catch (e) {
    console.error('密码重置失败:', e.message);
    res.json({ success: false, error: '密码重置失败，请稍后重试' });
  }
});

module.exports = router;
