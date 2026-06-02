const express = require('express');
const publicRouter = express.Router();
const adminRouter = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database/init');

const GALLERY_DIR = path.join(__dirname, '..', 'public', 'images', 'gallery');
if (!fs.existsSync(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: GALLERY_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('仅支持 JPG/PNG/GIF/WEBP 格式'));
  }
});

const authMiddleware = (req, res, next) => {
  const jwt = require('jsonwebtoken');
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    const db = getDb();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'houkong-sports-meet-2026');
    const user = db.prepare('SELECT id, role, status FROM users WHERE id = ?').get(decoded.id);
    if (!user || user.status !== 'active') return res.status(401).json({ error: '账号不可用' });
    req.user = user;
    next();
  } catch (e) { return res.status(401).json({ error: '登录已过期' }); }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: '无权限' });
  next();
};

// POST /api/gallery/upload - 用户上传图片（待审核）
publicRouter.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择图片文件' });
    const db = getDb();
    const desc = req.body.description || '';
    db.prepare(
      'INSERT INTO gallery_photos (user_id, filename, original_name, description, status) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, req.file.filename, req.file.originalname, desc, 'pending');
    res.json({ success: true, message: '图片已上传，等待管理员审核' });
  } catch (e) {
    res.status(500).json({ error: '上传失败' });
  }
});

// GET /api/gallery/approved - 获取已审核通过的图片（公开）
publicRouter.get('/approved', (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const photos = db.prepare(
      `SELECT g.id, g.filename, g.original_name, g.description, g.sort_order, g.created_at, u.name AS uploader_name
       FROM gallery_photos g LEFT JOIN users u ON g.user_id = u.id
       WHERE g.status = 'approved'
       ORDER BY g.sort_order DESC, g.created_at DESC LIMIT ? OFFSET ?`
    ).all(limit, offset);
    const total = db.prepare("SELECT COUNT(*) AS cnt FROM gallery_photos WHERE status = 'approved'").get();
    res.json({ success: true, data: photos, total: total.cnt, page, limit });
  } catch (e) {
    res.status(500).json({ error: '获取图片失败' });
  }
});

// ==================== 管理员接口 ====================

// GET /api/admin/gallery - 管理员获取所有图片（可按状态筛选）
adminRouter.get('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const db = getDb();
    const status = req.query.status || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;
    let sql = `SELECT g.id, g.filename, g.original_name, g.description, g.status, g.created_at, g.approved_at, u.name AS uploader_name, a.name AS approver_name
               FROM gallery_photos g LEFT JOIN users u ON g.user_id = u.id LEFT JOIN users a ON g.approved_by = a.id`;
    const params = [];
    if (status) { sql += ' WHERE g.status = ?'; params.push(status); }
    sql += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const photos = db.prepare(sql).all(...params);
    let totalSql = "SELECT COUNT(*) AS cnt FROM gallery_photos";
    if (status) totalSql += " WHERE status = ?";
    const total = status ? db.prepare(totalSql).get(status) : db.prepare(totalSql).get();
    const counts = db.prepare("SELECT status, COUNT(*) AS cnt FROM gallery_photos GROUP BY status").all();
    const pending = counts.find(c => c.status === 'pending')?.cnt || 0;
    const approved = counts.find(c => c.status === 'approved')?.cnt || 0;
    const rejected = counts.find(c => c.status === 'rejected')?.cnt || 0;
    res.json({ success: true, data: photos, total: total.cnt, page, limit, pending, approved, rejected });
  } catch (e) {
    res.status(500).json({ error: '获取图片列表失败' });
  }
});

// PUT /api/admin/gallery/:id/approve - 审核通过
adminRouter.put('/:id/approve', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const db = getDb();
    const photo = db.prepare('SELECT id, status FROM gallery_photos WHERE id = ?').get(req.params.id);
    if (!photo) return res.status(404).json({ error: '图片不存在' });
    db.prepare(
      "UPDATE gallery_photos SET status = 'approved', approved_by = ?, approved_at = datetime('now','localtime') WHERE id = ?"
    ).run(req.user.id, req.params.id);
    res.json({ success: true, message: '审核已通过' });
  } catch (e) {
    res.status(500).json({ error: '操作失败' });
  }
});

// PUT /api/admin/gallery/:id/reject - 驳回
adminRouter.put('/:id/reject', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const db = getDb();
    const photo = db.prepare('SELECT id, status FROM gallery_photos WHERE id = ?').get(req.params.id);
    if (!photo) return res.status(404).json({ error: '图片不存在' });
    db.prepare(
      "UPDATE gallery_photos SET status = 'rejected', approved_by = ?, approved_at = datetime('now','localtime') WHERE id = ?"
    ).run(req.user.id, req.params.id);
    res.json({ success: true, message: '已驳回' });
  } catch (e) {
    res.status(500).json({ error: '操作失败' });
  }
});

// DELETE /api/admin/gallery/:id - 删除图片
adminRouter.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const db = getDb();
    const photo = db.prepare('SELECT id, filename FROM gallery_photos WHERE id = ?').get(req.params.id);
    if (!photo) return res.status(404).json({ error: '图片不存在' });
    const filePath = path.join(GALLERY_DIR, photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM gallery_photos WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '已删除' });
  } catch (e) {
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = { publicRouter, adminRouter };
