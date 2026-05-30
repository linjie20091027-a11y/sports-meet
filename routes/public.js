const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

router.get('/meet-info', async (req, res) => {
  try {
    const info = await prisma.meetInfo.findFirst();
    res.json({ success: true, data: info || null });
  } catch (err) {
    res.status(500).json({ error: '获取运动会信息失败' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const where = { status: 'active' };
    if (req.query.category) where.category = req.query.category;
    if (req.query.gender_group) where.genderGroup = req.query.gender_group;
    if (req.query.event_type) where.eventType = req.query.event_type;

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    });
    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ error: '获取项目列表失败' });
  }
});

router.get('/events/:id', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ success: false, error: '項目不存在' });
    }

    const regCount = await prisma.registration.count({
      where: { eventId, status: { not: 'rejected' } }
    });
    const approvedCount = await prisma.registration.count({
      where: { eventId, status: 'approved' }
    });
    const schedules = await prisma.schedule.findMany({
      where: { eventId, status: 'published' },
      orderBy: { startTime: 'asc' }
    });

    res.json({
      success: true,
      data: {
        ...event,
        registration_count: regCount,
        approved_count: approvedCount,
        schedules
      }
    });
  } catch (err) {
    res.status(500).json({ error: '获取项目详情失败' });
  }
});

router.get('/schedules', async (req, res) => {
  try {
    const where = { status: 'published' };
    if (req.query.date) {
      where.startTime = { startsWith: req.query.date };
    }
    if (req.query.venue) {
      where.venue = { contains: req.query.venue };
    }
    if (req.query.event_id) {
      where.eventId = parseInt(req.query.event_id);
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: { event: true },
      orderBy: { startTime: 'asc' }
    });

    const data = schedules.map(s => ({
      id: s.id,
      event_id: s.eventId,
      event_name: s.event?.name,
      round_name: s.roundName,
      start_time: s.startTime,
      end_time: s.endTime,
      venue: s.venue,
      max_heats: s.maxHeats,
      status: s.status,
      note: s.note,
      created_at: s.createdAt
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: '获取赛程列表失败' });
  }
});

router.get('/results', async (req, res) => {
  try {
    const where = { isPublished: 1 };
    const userWhere = {};
    if (req.query.grade) userWhere.grade = req.query.grade;
    if (req.query.class_name) userWhere.className = { contains: req.query.class_name };
    if (Object.keys(userWhere).length > 0) where.user = userWhere;
    if (req.query.event_id) {
      where.schedule = { eventId: parseInt(req.query.event_id) };
    }

    const results = await prisma.result.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, studentId: true, className: true, grade: true } },
        schedule: { include: { event: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const data = results.map(r => ({
      id: r.id,
      schedule_id: r.scheduleId,
      user_id: r.userId,
      performance: r.performance,
      rank: r.rank,
      score: r.score,
      award: r.award,
      note: r.note,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
      user_name: r.user?.name,
      student_id: r.user?.studentId,
      class_name: r.user?.className,
      grade: r.user?.grade,
      event_name: r.schedule?.event?.name,
      category: r.schedule?.event?.category,
      round_name: r.schedule?.roundName
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: '获取成绩列表失败' });
  }
});

router.get('/results/export', async (req, res) => {
  try {
    const where = { isPublished: 1 };
    const userWhere = {};
    const eventWhere = {};
    if (req.query.grade) userWhere.grade = req.query.grade;
    if (req.query.class_name) userWhere.className = { contains: req.query.class_name };
    if (Object.keys(userWhere).length > 0) where.user = userWhere;
    if (req.query.event_id) {
      eventWhere.id = parseInt(req.query.event_id);
      where.event = eventWhere;
    }

    const results = await prisma.result.findMany({
      where,
      include: {
        user: { select: { name: true, studentId: true, className: true, grade: true } },
        schedule: { select: { roundName: true, startTime: true } },
        event: { select: { name: true, category: true, eventType: true, genderGroup: true } }
      },
      orderBy: [{ event: { name: 'asc' } }, { rank: 'asc' }]
    });

    const data = results.map(r => ({
      id: r.id,
      performance: r.performance,
      rank: r.rank,
      score: r.score,
      award: r.award,
      note: r.note,
      user_name: r.user?.name,
      student_id: r.user?.studentId,
      class_name: r.user?.className,
      grade: r.user?.grade,
      event_name: r.event?.name,
      category: r.event?.category,
      event_type: r.event?.eventType,
      gender_group: r.event?.genderGroup,
      round_name: r.schedule?.roundName,
      start_time: r.schedule?.startTime
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: '导出成绩数据失败' });
  }
});

router.get('/results/rankings', async (req, res) => {
  try {
    const where = { isPublished: 1, rank: { gt: 0 } };
    if (req.query.event_id) {
      where.schedule = { eventId: parseInt(req.query.event_id) };
    }
    if (req.query.grade) {
      where.user = { grade: req.query.grade };
    }

    const rows = await prisma.result.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, studentId: true, className: true, grade: true } },
        schedule: { include: { event: { select: { id: true, name: true, category: true, genderGroup: true, sortOrder: true } } } }
      },
      orderBy: [{ schedule: { event: { sortOrder: 'asc' } } }, { schedule: { event: { id: 'asc' } } }, { rank: 'asc' }]
    });

    const grouped = {};
    rows.forEach(row => {
      const event = row.schedule?.event;
      if (!event) return;
      const key = `${event.id}_${event.genderGroup || ''}`;
      if (!grouped[key]) {
        grouped[key] = {
          event_id: event.id,
          event_name: event.name,
          category: event.category,
          gender_group: event.genderGroup,
          rankings: []
        };
      }
      grouped[key].rankings.push({
        rank: row.rank,
        score: row.score,
        award: row.award,
        performance: row.performance,
        user_id: row.user.id,
        user_name: row.user.name,
        student_id: row.user.studentId,
        class_name: row.user.className,
        grade: row.user.grade
      });
    });

    res.json({ success: true, data: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ error: '获取获奖榜单失败' });
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const where = { status: 'published' };
    if (req.query.category) {
      where.category = req.query.category;
    }

    const announcements = await prisma.announcement.findMany({
      where,
      include: { publisher: { select: { name: true } } },
      orderBy: [{ isPinned: 'desc' }, { publishTime: 'desc' }]
    });

    const data = announcements.map(a => ({
      ...a,
      publisher_name: a.publisher?.name
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: '获取公告列表失败' });
  }
});

router.get('/announcements/:id', async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const announcement = await prisma.announcement.findFirst({
      where: { id: announcementId, status: 'published' },
      include: { publisher: { select: { name: true } } }
    });
    if (!announcement) {
      return res.status(404).json({ error: '公告不存在或已下架' });
    }

    await prisma.announcement.update({
      where: { id: announcementId },
      data: { viewCount: { increment: 1 } }
    });

    res.json({
      success: true,
      data: {
        ...announcement,
        publisher_name: announcement.publisher?.name,
        view_count: announcement.viewCount + 1
      }
    });
  } catch (err) {
    res.status(500).json({ error: '获取公告详情失败' });
  }
});

router.get('/grades', async (req, res) => {
  try {
    const gradeNames = ['初一', '初二', '初三', '高一', '高二', '高三'];
    const classes = [
      ['1班', '2班', '3班', '4班', '5班'],
      ['1班', '2班', '3班', '4班', '5班'],
      ['1班', '2班', '3班', '4班', '5班'],
      ['1班', '2班', '3班', '4班'],
      ['1班', '2班', '3班', '4班'],
      ['1班', '2班', '3班', '4班'],
    ];

    const data = gradeNames.map((name, i) => ({
      id: i + 1,
      name,
      sort_order: i + 1,
      classes: classes[i].map((c, j) => ({
        id: i * 10 + j + 1,
        grade_id: i + 1,
        name: c,
        sort_order: j + 1
      }))
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: '获取年级列表失败' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || !q.trim()) {
      return res.json({ success: true, data: { events: [], students: [], announcements: [] } });
    }

    const keyword = q.trim();

    const [events, students, announcements] = await Promise.all([
      prisma.event.findMany({
        where: { name: { contains: keyword }, status: 'active' },
        select: { id: true, name: true, category: true, eventType: true, genderGroup: true, venue: true },
        take: 10
      }),
      prisma.user.findMany({
        where: {
          OR: [{ name: { contains: keyword } }, { className: { contains: keyword } }],
          role: 'student',
          status: 'active'
        },
        select: { id: true, name: true, studentId: true, className: true, grade: true },
        take: 10
      }),
      prisma.announcement.findMany({
        where: { title: { contains: keyword }, status: 'published' },
        include: { publisher: { select: { name: true } } },
        orderBy: [{ isPinned: 'desc' }, { publishTime: 'desc' }],
        take: 10
      })
    ]);

    res.json({
      success: true,
      data: {
        events,
        students,
        announcements: announcements.map(a => ({
          ...a,
          publisher_name: a.publisher?.name
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: '搜索失败' });
  }
});

router.get('/stats/overview', async (req, res) => {
  try {
    const [totalEvents, totalReg, completedSchedules, publishedResults] = await Promise.all([
      prisma.event.count({ where: { status: 'active' } }),
      prisma.registration.count({ where: { status: 'approved' } }),
      prisma.schedule.count({ where: { status: 'published' } }),
      prisma.result.count({ where: { isPublished: 1 } })
    ]);

    res.json({
      success: true,
      data: {
        total_registrations: totalReg,
        total_events: totalEvents,
        completed_schedules: completedSchedules,
        published_results: publishedResults
      }
    });
  } catch (err) {
    res.status(500).json({ error: '获取统计概览失败' });
  }
});

module.exports = router;
