const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDatabase, getDb } = require('../database/init');
const { autoRankSchedules } = require('../utils/resultEntry');

const ROOT_DIR = path.join(__dirname, '..');
const DATABASE_DIR = path.join(ROOT_DIR, 'database');
const LIVE_DB_PATH = path.join(DATABASE_DIR, 'sports_meet.db');
const DEMO_DB_PATH = path.join(DATABASE_DIR, 'sports_meet_full_demo.db');
const SUMMARY_PATH = path.join(DATABASE_DIR, 'sports_meet_full_demo.summary.json');
const BACKUP_PATH = path.join(DATABASE_DIR, 'sports_meet.__original_backup__.db');

const COURSE_NAMES = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '信息技术', '体育'];
const EXAMS = [
  { name: '2026春季期中考试', type: 'school', subjects: ['语文', '数学', '英语', '物理', '化学'] },
  { name: '2026春季期末考试', type: 'school', subjects: ['语文', '数学', '英语', '物理', '化学'] },
  { name: '2026学业质量监测', type: 'district', subjects: ['语文', '数学', '英语'] }
];
const ACTIVITY_TEMPLATES = [
  { name: '运动会报名宣讲周', type: 'platform', role: 'participant' },
  { name: '班级论坛互动月', type: 'platform', role: 'speaker' },
  { name: '赛事知识问答', type: 'platform', role: 'participant' },
  { name: '学生志愿服务日', type: 'volunteer', role: 'volunteer' },
  { name: '班级体育打卡挑战', type: 'sports', role: 'participant' }
];
const PAGE_TEMPLATES = [
  ['#/', '首页'],
  ['#/events', '赛事项目'],
  ['#/results', '成绩公示'],
  ['#/announcements', '公告通知'],
  ['#/forum', '论坛'],
  ['#/student', '个人中心'],
  ['#/student?tab=registrations', '我的报名'],
  ['#/student?tab=results', '我的成绩']
];
const FEATURE_TEMPLATES = [
  ['auth', '学生登录'],
  ['events', '浏览赛事详情'],
  ['registrations', '提交报名申请'],
  ['results', '查看成绩排名'],
  ['forum', '浏览论坛帖子'],
  ['profile', '查看个人资料']
];
const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦许何吕张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝安常乐于时傅卞齐康伍余元顾孟平黄穆萧尹'.split('');
const GIVEN_A = '子嘉梓宇浩欣雨思博雅俊明志彦卓一可安若诗景承沐浩铭嘉文晨婉'.split('');
const GIVEN_B = '轩宁涵彤睿航婷恩琳琪峰豪洋泽妍昊毅辰怡菲萌皓清言朗雯霖希'.split('');

function mulberry32(seed) {
  return function rng() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(num, size = 2) {
  return String(num).padStart(size, '0');
}

function sample(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function shuffle(rng, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function addDays(date, days, hours = 0, minutes = 0) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function scoreToGpa(score) {
  if (score >= 90) return 4.0;
  if (score >= 85) return 3.7;
  if (score >= 80) return 3.3;
  if (score >= 75) return 3.0;
  if (score >= 70) return 2.7;
  if (score >= 65) return 2.3;
  if (score >= 60) return 2.0;
  return 1.0;
}

function ensureCleanFile(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function buildClassPlan() {
  const grades = [
    { grade: '初一', grade_sort_order: 1, class_count: 4, age: 12 },
    { grade: '初二', grade_sort_order: 2, class_count: 4, age: 13 },
    { grade: '初三', grade_sort_order: 3, class_count: 4, age: 14 },
    { grade: '高一', grade_sort_order: 4, class_count: 6, age: 15 },
    { grade: '高二', grade_sort_order: 5, class_count: 6, age: 16 },
    { grade: '高三', grade_sort_order: 6, class_count: 6, age: 17 }
  ];
  return grades.flatMap((item) => Array.from({ length: item.class_count }, (_, index) => ({
    grade: item.grade,
    grade_sort_order: item.grade_sort_order,
    class_name: `${item.grade}(${index + 1})班`,
    class_sort_order: index + 1,
    age: item.age
  })));
}

function buildStudentName(index) {
  const surname = SURNAMES[index % SURNAMES.length];
  const givenA = GIVEN_A[Math.floor(index / SURNAMES.length) % GIVEN_A.length];
  const givenB = GIVEN_B[Math.floor(index / (SURNAMES.length * GIVEN_A.length)) % GIVEN_B.length];
  return `${surname}${givenA}${givenB}`;
}

function generateTrackPerformance(eventName, gender, rng) {
  const baseMap = {
    '100米': gender === 'male' ? 12.4 : 13.8,
    '200米': gender === 'male' ? 25.6 : 28.4,
    '400米': gender === 'male' ? 58.4 : 64.8,
    '800米': gender === 'male' ? 132.0 : 148.0,
    '1500米': gender === 'male' ? 295.0 : 338.0,
    '3000米': gender === 'male' ? 690.0 : 760.0,
    '110米栏': gender === 'male' ? 17.2 : 18.8,
    '400米栏': gender === 'male' ? 63.0 : 70.2,
    '4×100米接力': gender === 'male' ? 50.5 : 56.5,
    '4×400米接力': gender === 'male' ? 238.0 : 262.0
  };
  const spreadMap = {
    '100米': 1.1, '200米': 2.2, '400米': 5.0, '800米': 10.0,
    '1500米': 16.0, '3000米': 28.0, '110米栏': 1.4, '400米栏': 5.5,
    '4×100米接力': 2.4, '4×400米接力': 16.0
  };
  const base = baseMap[eventName] || 30;
  const spread = spreadMap[eventName] || 5;
  const value = base + (rng() * spread);
  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const seconds = (value - (minutes * 60)).toFixed(2).padStart(5, '0');
    return `${minutes}:${seconds}`;
  }
  return value.toFixed(2);
}

function generateFieldPerformance(eventName, gender, rng) {
  const baseMap = {
    '跳高': gender === 'male' ? 1.48 : 1.28,
    '跳远': gender === 'male' ? 5.25 : 4.35,
    '三级跳远': gender === 'male' ? 10.8 : 9.2,
    '铅球': gender === 'male' ? 9.8 : 7.2,
    '铁饼': gender === 'male' ? 28.5 : 19.4,
    '标枪': gender === 'male' ? 34.8 : 22.6
  };
  const spreadMap = {
    '跳高': 0.28,
    '跳远': 0.9,
    '三级跳远': 1.4,
    '铅球': 2.8,
    '铁饼': 6.2,
    '标枪': 7.5
  };
  const base = baseMap[eventName] || 5;
  const spread = spreadMap[eventName] || 1.5;
  return (base + (rng() * spread)).toFixed(2);
}

function buildDemoSummary(db) {
  const count = (tableName) => db.prepare(`SELECT COUNT(*) AS c FROM ${tableName}`).get().c;
  return {
    users: {
      students: count('users WHERE permission_role = \'student\''),
      teachers: count('users WHERE permission_role = \'teacher\''),
      global_admins: count('users WHERE permission_role = \'global_admin\'')
    },
    business: {
      course_records: count('student_course_records'),
      exam_registrations: count('student_exam_registrations'),
      activity_participations: count('activity_participations'),
      registrations: count('registrations'),
      schedules: count('schedules'),
      results: count('results')
    },
    behavior: {
      login_logs: count('login_logs'),
      page_view_logs: count('page_view_logs'),
      feature_usage_logs: count('feature_usage_logs'),
      operation_logs: count('operation_logs'),
      notifications: count('notifications'),
      forum_posts: count('forum_posts'),
      forum_replies: count('forum_replies'),
      friendships: count('friendships')
    }
  };
}

async function main() {
  const rng = mulberry32(20260611);
  const now = new Date('2026-06-11T09:00:00');
  const studentPasswordHash = bcrypt.hashSync('123456', 10);
  const teacherPasswordHash = bcrypt.hashSync('teacher123', 10);

  const hadOriginalDb = fs.existsSync(LIVE_DB_PATH);
  if (hadOriginalDb) fs.copyFileSync(LIVE_DB_PATH, BACKUP_PATH);

  try {
    ensureCleanFile(DEMO_DB_PATH);
    ensureCleanFile(SUMMARY_PATH);
    ensureCleanFile(LIVE_DB_PATH);

    await initDatabase();
    const db = getDb();

    db.transaction(() => {
      const clearTables = [
        'student_course_records',
        'student_exam_registrations',
        'activity_participations',
        'feature_usage_logs',
        'page_view_logs',
        'login_logs',
        'results',
        'schedules',
        'registrations',
        'announcement_reads',
        'notifications',
        'operation_logs',
        'captchas',
        'password_resets',
        'forum_post_actions',
        'forum_reports',
        'forum_moderation_logs',
        'forum_replies',
        'forum_posts',
        'friend_requests',
        'friendships',
        'highlights',
        'gallery_photos'
      ];
      clearTables.forEach((tableName) => db.exec(`DELETE FROM ${tableName}`));
      db.exec("DELETE FROM users WHERE permission_role != 'global_admin'");
      db.exec('DELETE FROM classes');
      db.exec('DELETE FROM grades');
    })();

    const admin = db.prepare("SELECT id, username FROM users WHERE permission_role = 'global_admin' ORDER BY id LIMIT 1").get();
    if (!admin) throw new Error('缺少全局管理员账号，无法生成演示库');

    const classPlan = buildClassPlan();
    const gradeInsert = db.prepare('INSERT INTO grades (name, sort_order) VALUES (?, ?)');
    const classInsert = db.prepare('INSERT INTO classes (grade_id, name, sort_order) VALUES (?, ?, ?)');
    const uniqueGrades = [...new Map(classPlan.map((item) => [item.grade, item])).values()];
    uniqueGrades.forEach((item) => gradeInsert.run(item.grade, item.grade_sort_order));
    const gradeMap = new Map(db.prepare('SELECT id, name FROM grades ORDER BY sort_order, id').all().map((item) => [item.name, item.id]));
    classPlan.forEach((item) => classInsert.run(gradeMap.get(item.grade), item.class_name, item.class_sort_order));

    const classes = db.prepare(`
      SELECT c.id, c.name AS class_name, c.sort_order, g.name AS grade, g.sort_order AS grade_sort_order
      FROM classes c
      JOIN grades g ON g.id = c.grade_id
      ORDER BY g.sort_order, c.sort_order, c.id
    `).all();

    const students = [];
    const studentInsert = db.prepare(`
      INSERT INTO users (
        username, email, password, role, permission_role, student_id, name, class_name, grade,
        gender, age, sport_group, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'student', 'student', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `);
    classes.forEach((cls, classIndex) => {
      const baseCount = 16 + (classIndex < 20 ? 1 : 0);
      for (let i = 0; i < baseCount; i++) {
        const globalIndex = students.length;
        if (globalIndex >= 500) break;
        const studentNo = `2026${pad(globalIndex + 1, 4)}`;
        const gender = (globalIndex + classIndex) % 2 === 0 ? 'male' : 'female';
        const createdAt = formatDateTime(addDays(now, -(220 + (globalIndex % 60)), 8 + (globalIndex % 8), globalIndex % 50));
        const student = {
          username: studentNo,
          email: `${studentNo}@hkms.hktedu.com`,
          student_id: studentNo,
          name: buildStudentName(globalIndex),
          class_name: cls.class_name,
          grade: cls.grade,
          gender,
          age: classPlan.find((item) => item.class_name === cls.class_name)?.age || 16,
          sport_group: ['A', 'B', 'C', 'D', 'E'][globalIndex % 5],
          created_at: createdAt
        };
        studentInsert.run(
          student.username,
          student.email,
          studentPasswordHash,
          student.student_id,
          student.name,
          student.class_name,
          student.grade,
          student.gender,
          student.age,
          student.sport_group,
          student.created_at,
          student.created_at
        );
        students.push(student);
      }
    });

    const storedStudents = db.prepare(`
      SELECT id, username, email, student_id, name, class_name, grade, gender, age, sport_group, created_at
      FROM users
      WHERE permission_role = 'student'
      ORDER BY id
    `).all();
    if (storedStudents.length !== 500) throw new Error(`学生数量异常，预期 500，实际 ${storedStudents.length}`);

    const homeroomInsert = db.prepare(`
      INSERT INTO users (
        username, email, password, role, permission_role, staff_type, student_id, name, class_name,
        grade, managed_grade, managed_class_name, assigned_event_ids, gender, age, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'admin', 'teacher', 'homeroom_teacher', ?, ?, '', '', ?, ?, '[]', '', 30, 'active', ?, ?)
    `);
    classes.forEach((cls, index) => {
      const code = `HR${pad(index + 1, 3)}`;
      const createdAt = formatDateTime(addDays(now, -(180 + index), 9, index % 40));
      homeroomInsert.run(
        `teacher_hr_${pad(index + 1, 3)}`,
        `teacher_hr_${pad(index + 1, 3)}@hkms.hktedu.com`,
        teacherPasswordHash,
        code,
        `${cls.grade}${cls.class_name.replace(cls.grade, '')}班主任`,
        cls.grade,
        cls.class_name,
        createdAt,
        createdAt
      );
    });

    const events = db.prepare(`
      SELECT id, name, category, event_type, gender_group, max_participants, venue, sort_order
      FROM events
      WHERE status = 'active'
      ORDER BY sort_order, id
    `).all();
    const eventTeacherInsert = db.prepare(`
      INSERT INTO users (
        username, email, password, role, permission_role, staff_type, student_id, name, class_name,
        grade, managed_grade, managed_class_name, assigned_event_ids, gender, age, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'admin', 'teacher', 'event_teacher', ?, ?, '', '', '', '', ?, '', 32, 'active', ?, ?)
    `);
    events.forEach((event, index) => {
      const createdAt = formatDateTime(addDays(now, -(140 + index), 10, index % 35));
      const genderLabel = event.gender_group === 'male' ? '男' : event.gender_group === 'female' ? '女' : '混合';
      eventTeacherInsert.run(
        `teacher_evt_${pad(index + 1, 3)}`,
        `teacher_evt_${pad(index + 1, 3)}@hkms.hktedu.com`,
        teacherPasswordHash,
        `EVT${pad(index + 1, 3)}`,
        `${event.name}${genderLabel}组录入教师`,
        JSON.stringify([event.id]),
        createdAt,
        createdAt
      );
    });

    const homeroomTeachers = db.prepare(`
      SELECT id, name, managed_grade, managed_class_name
      FROM users
      WHERE staff_type = 'homeroom_teacher'
      ORDER BY managed_grade, managed_class_name, id
    `).all();
    const homeroomTeacherMap = new Map(homeroomTeachers.map((item) => [`${item.managed_grade}__${item.managed_class_name}`, item]));

    const eventTeachers = db.prepare(`
      SELECT id, name, assigned_event_ids
      FROM users
      WHERE staff_type = 'event_teacher'
      ORDER BY id
    `).all();
    const eventTeacherMap = new Map();
    eventTeachers.forEach((teacher) => {
      const eventIds = JSON.parse(teacher.assigned_event_ids || '[]');
      eventIds.forEach((eventId) => eventTeacherMap.set(Number(eventId), teacher));
    });

    const courseInsert = db.prepare(`
      INSERT INTO student_course_records (
        user_id, academic_year, term, course_name, course_type, credits, score, grade_point,
        class_rank, teacher_name, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    storedStudents.slice(0, 320).forEach((student, index) => {
      ['2025-2026'].forEach((academicYear) => {
        ['第一学期', '第二学期'].forEach((term, termIndex) => {
          COURSE_NAMES.slice(0, 8).forEach((courseName, courseIndex) => {
            const score = 68 + ((index + courseIndex * 7 + termIndex * 5) % 28) + Number((rng() * 4).toFixed(2));
            const createdAt = formatDateTime(addDays(now, -(130 - termIndex * 40), 8 + (courseIndex % 6), index % 55));
            courseInsert.run(
              student.id,
              academicYear,
              term,
              courseName,
              courseName === '体育' || courseName === '信息技术' ? 'activity' : 'required',
              courseName === '体育' ? 1 : 2,
              Math.min(99.5, Number(score.toFixed(2))),
              scoreToGpa(score),
              (index % 35) + 1,
              `${courseName}教师`,
              'completed',
              createdAt,
              createdAt
            );
          });
        });
      });
    });

    const examInsert = db.prepare(`
      INSERT INTO student_exam_registrations (
        user_id, exam_name, exam_type, subject_name, registration_status, seat_no, exam_date,
        score, grade_level, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    storedStudents.slice(0, 320).forEach((student, index) => {
      EXAMS.forEach((exam, examIndex) => {
        exam.subjects.forEach((subject, subjectIndex) => {
          const examDate = formatDateTime(addDays(now, -(85 - examIndex * 18), 9 + (subjectIndex % 4), 0));
          const score = 62 + ((index + subjectIndex * 9 + examIndex * 11) % 34) + Number((rng() * 3).toFixed(2));
          examInsert.run(
            student.id,
            exam.name,
            exam.type,
            subject,
            'attended',
            `${student.grade}${pad((index % 40) + 1, 2)}-${pad(subjectIndex + 1, 2)}`,
            examDate,
            Math.min(99.5, Number(score.toFixed(2))),
            score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D',
            examDate,
            examDate
          );
        });
      });
    });

    const activityInsert = db.prepare(`
      INSERT INTO activity_participations (
        user_id, activity_name, activity_type, participation_role, participation_status, award_name,
        credit_hours, activity_date, remark, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    storedStudents.forEach((student, index) => {
      ACTIVITY_TEMPLATES.slice(0, 3 + (index % 2)).forEach((activity, activityIndex) => {
        const activityDate = formatDateTime(addDays(now, -(70 - activityIndex * 10), 16, 0));
        activityInsert.run(
          student.id,
          activity.name,
          activity.type,
          activity.role,
          'completed',
          (index + activityIndex) % 17 === 0 ? '积极参与奖' : '',
          Number((1 + ((index + activityIndex) % 3) * 0.5).toFixed(1)),
          activityDate,
          `${student.grade}${student.class_name.replace(student.grade, '')}已完成${activity.name}`,
          activityDate
        );
      });
    });

    const loginInsert = db.prepare(`
      INSERT INTO login_logs (
        user_id, username, login_status, ip_address, user_agent, device_type, login_at, logout_at, session_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const pageInsert = db.prepare(`
      INSERT INTO page_view_logs (
        user_id, route, page_title, referrer, stay_seconds, ip_address, viewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const featureInsert = db.prepare(`
      INSERT INTO feature_usage_logs (
        user_id, module_name, action_name, action_result, detail, source_page, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const operationInsert = db.prepare(`
      INSERT INTO operation_logs (
        user_id, username, action, detail, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    storedStudents.forEach((student, index) => {
      for (let i = 0; i < 6; i++) {
        const loginAt = formatDateTime(addDays(now, -(55 - i * 3), 7 + ((index + i) % 9), (index * 7 + i * 11) % 60));
        const sessionMinutes = 12 + ((index + i * 3) % 55);
        const logoutAt = formatDateTime(addDays(now, -(55 - i * 3), 7 + ((index + i) % 9), ((index * 7 + i * 11) % 60) + sessionMinutes));
        const ip = `10.20.${pad((index % 30) + 1)}.${pad((i % 40) + 10)}`;
        loginInsert.run(student.id, student.username, 'success', ip, 'Mozilla/5.0 Chrome/126.0', i % 3 === 0 ? 'mobile' : 'web', loginAt, logoutAt, sessionMinutes);
      }
      for (let i = 0; i < 12; i++) {
        const page = PAGE_TEMPLATES[(index + i) % PAGE_TEMPLATES.length];
        const viewedAt = formatDateTime(addDays(now, -(40 - Math.floor(i / 3)), 8 + (i % 8), (index + i * 5) % 60));
        pageInsert.run(student.id, page[0], page[1], i === 0 ? '#/login' : PAGE_TEMPLATES[(index + i - 1) % PAGE_TEMPLATES.length][0], 20 + ((index + i) % 180), `10.20.${pad((index % 30) + 1)}.${pad((i % 40) + 10)}`, viewedAt);
      }
      for (let i = 0; i < 8; i++) {
        const feature = FEATURE_TEMPLATES[(index + i) % FEATURE_TEMPLATES.length];
        const createdAt = formatDateTime(addDays(now, -(38 - Math.floor(i / 2)), 9 + (i % 6), (index * 3 + i * 7) % 60));
        featureInsert.run(student.id, feature[0], feature[1], 'success', `${student.name}完成${feature[1]}`, pageInsert ? feature[0] : '#/', createdAt);
        operationInsert.run(student.id, student.username, feature[1], `${student.name}在${feature[0]}模块执行操作`, `10.20.${pad((index % 30) + 1)}.${pad((i % 40) + 10)}`, createdAt);
      }
    });

    const scheduleInsert = db.prepare(`
      INSERT INTO schedules (
        event_id, round_name, start_time, end_time, venue, max_heats, status, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?)
    `);
    const scheduleIds = [];
    events.forEach((event, index) => {
      const startTime = formatDateTime(addDays(new Date('2026-10-22T08:00:00'), Math.floor(index / 8), 8 + ((index % 8) * 1), (index % 2) * 20));
      const endTime = formatDateTime(addDays(new Date('2026-10-22T08:40:00'), Math.floor(index / 8), 8 + ((index % 8) * 1), 30 + (index % 2) * 20));
      scheduleInsert.run(event.id, event.category === 'field' ? '决赛' : '预决赛', startTime, endTime, event.venue, event.category === 'field' ? 1 : 2, '完整模拟数据自动生成', startTime);
    });
    db.prepare('SELECT id FROM schedules ORDER BY id').all().forEach((item) => scheduleIds.push(item.id));
    const scheduleMap = new Map(db.prepare('SELECT id, event_id FROM schedules ORDER BY id').all().map((item) => [Number(item.event_id), Number(item.id)]));

    const remainingSlots = new Map(events.map((event) => [event.id, Number(event.max_participants || 0)]));
    const registrationInsert = db.prepare(`
      INSERT INTO registrations (
        user_id, event_id, status, reject_reason, reviewed_by, reviewed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const approvedRegistrations = [];
    const shuffledStudents = shuffle(rng, storedStudents);
    shuffledStudents.slice(0, 300).forEach((student, index) => {
      const eligibleEvents = events.filter((event) => event.gender_group === student.gender && (remainingSlots.get(event.id) || 0) > 0);
      if (!eligibleEvents.length) return;
      const event = eligibleEvents[(index + student.id) % eligibleEvents.length];
      remainingSlots.set(event.id, (remainingSlots.get(event.id) || 0) - 1);
      const reviewer = homeroomTeacherMap.get(`${student.grade}__${student.class_name}`) || admin;
      const createdAt = formatDateTime(addDays(now, -(34 - (index % 9)), 10 + (index % 7), (index * 4) % 60));
      registrationInsert.run(student.id, event.id, 'approved', '', reviewer.id, createdAt, createdAt);
      approvedRegistrations.push({ user_id: student.id, event_id: event.id, gender: student.gender, grade: student.grade, class_name: student.class_name });
    });

    shuffledStudents.slice(300, 360).forEach((student, index) => {
      const eligibleEvents = events.filter((event) => event.gender_group === student.gender);
      const event = eligibleEvents[(index + student.id) % eligibleEvents.length];
      const reviewer = homeroomTeacherMap.get(`${student.grade}__${student.class_name}`) || admin;
      const createdAt = formatDateTime(addDays(now, -(18 - (index % 5)), 11, (index * 5) % 60));
      const status = index % 3 === 0 ? 'pending' : index % 3 === 1 ? 'rejected' : 'cancelling';
      registrationInsert.run(student.id, event.id, status, status === 'rejected' ? '模拟示例：时间冲突' : '', status === 'pending' ? null : reviewer.id, status === 'pending' ? null : createdAt, createdAt);
    });

    const resultInsert = db.prepare(`
      INSERT INTO results (
        schedule_id, user_id, performance, rank, score, award, is_published, note, is_school_record, recorded_by, created_at, updated_at
      ) VALUES (?, ?, ?, 0, 0, '', ?, ?, 0, ?, ?, ?)
    `);
    approvedRegistrations.forEach((item, index) => {
      const event = events.find((eventRow) => Number(eventRow.id) === Number(item.event_id));
      const scheduleId = scheduleMap.get(item.event_id);
      const eventTeacher = eventTeacherMap.get(item.event_id) || admin;
      if (!event || !scheduleId) return;
      const performance = event.category === 'field'
        ? generateFieldPerformance(event.name, item.gender, rng)
        : generateTrackPerformance(event.name, item.gender, rng);
      const createdAt = formatDateTime(addDays(now, -(4 - (index % 3)), 14 + (index % 4), (index * 3) % 60));
      resultInsert.run(
        scheduleId,
        item.user_id,
        performance,
        index % 6 !== 0 ? 1 : 0,
        index % 7 === 0 ? '模拟成绩已公示' : '模拟成绩待教师复核',
        eventTeacher.id,
        createdAt,
        createdAt
      );
    });

    autoRankSchedules(db, scheduleIds);
    const scoreMap = new Map([[1, 9], [2, 7], [3, 6], [4, 5], [5, 4], [6, 3], [7, 2], [8, 1]]);
    const awardMap = new Map([[1, '第一名'], [2, '第二名'], [3, '第三名']]);
    const updateResult = db.prepare(`
      UPDATE results
      SET score = ?, award = ?, is_school_record = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `);
    db.prepare('SELECT id, rank FROM results ORDER BY id').all().forEach((row) => {
      updateResult.run(
        scoreMap.get(Number(row.rank)) || 0,
        awardMap.get(Number(row.rank)) || '',
        Number(row.rank) === 1 ? 1 : 0,
        row.id
      );
    });

    const notifications = db.prepare('SELECT id, title FROM announcements ORDER BY id LIMIT 3').all();
    const notificationInsert = db.prepare(`
      INSERT INTO notifications (
        user_id, type, title, content, target_url, is_read, sender_name, sender_role, attachments, action_label, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const announcementReadInsert = db.prepare('INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id, read_at) VALUES (?, ?, ?)');
    storedStudents.forEach((student, index) => {
      const firstCreatedAt = formatDateTime(addDays(now, -(26 - (index % 6)), 8 + (index % 8), (index * 2) % 60));
      notificationInsert.run(student.id, 'info', '欢迎进入运动会管理系统', '您的模拟测试账号已准备完成，可直接登录查看个人报名、成绩与论坛动态。', '#/student', 1, '系统通知', 'system', '[]', '进入个人中心', firstCreatedAt);
      notificationInsert.run(student.id, 'success', '班级数据已同步', `已为您同步${student.grade}${student.class_name.replace(student.grade, '')}的班级资料与班主任信息。`, '#/student?tab=registrations', index % 3 === 0 ? 1 : 0, '教务平台', 'system', '[]', '查看报名信息', formatDateTime(addDays(now, -(12 - (index % 5)), 9, (index * 3) % 60)));
      notificationInsert.run(student.id, 'warning', '最近一次平台活动记录已生成', '系统已补充登录、浏览、功能操作与平台活动痕迹，可用于全链路演示。', '#/forum', 0, '系统通知', 'system', '[]', '查看论坛', formatDateTime(addDays(now, -(3 - (index % 2)), 16, (index * 5) % 60)));
      notifications.forEach((announcement) => {
        announcementReadInsert.run(announcement.id, student.id, formatDateTime(addDays(now, -(10 - (index % 4)), 12, index % 50)));
      });
    });

    const studentsByClass = new Map();
    storedStudents.forEach((student) => {
      const key = `${student.grade}__${student.class_name}`;
      if (!studentsByClass.has(key)) studentsByClass.set(key, []);
      studentsByClass.get(key).push(student);
    });
    const friendRequestInsert = db.prepare(`
      INSERT INTO friend_requests (
        requester_id, receiver_id, remark, friend_group, status, handled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const friendshipInsert = db.prepare(`
      INSERT OR IGNORE INTO friendships (
        user_id, friend_id, group_name, source_request_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    studentsByClass.forEach((group) => {
      for (let i = 0; i < group.length - 1; i++) {
        const requester = group[i];
        const receiver = group[i + 1];
        const createdAt = formatDateTime(addDays(now, -(22 - (i % 4)), 17, (i * 7) % 60));
        friendRequestInsert.run(requester.id, receiver.id, '同班同学，便于交流赛事信息', '同班同学', 'accepted', createdAt, createdAt, createdAt);
        const requestId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
        friendshipInsert.run(requester.id, receiver.id, '同班同学', requestId, createdAt, createdAt);
        friendshipInsert.run(receiver.id, requester.id, '同班同学', requestId, createdAt, createdAt);
      }
    });

    shuffle(rng, storedStudents).slice(0, 80).forEach((student, index) => {
      const target = storedStudents[(index * 7 + 13) % storedStudents.length];
      if (!target || target.id === student.id) return;
      const createdAt = formatDateTime(addDays(now, -(6 - (index % 3)), 18, (index * 11) % 60));
      friendRequestInsert.run(student.id, target.id, '邀请一起参加平台互动活动', '赛事伙伴', 'pending', null, createdAt, createdAt);
    });

    const postInsert = db.prepare(`
      INSERT INTO forum_posts (
        user_id, title, content, summary, category, tags, attachments, status, review_stage,
        review_comment, reviewed_by, reviewed_at, like_count, favorite_count, report_count,
        is_featured, last_interaction_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, '[]', 'approved', 2, '完整模拟数据库自动审核通过', ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `);
    const replyInsert = db.prepare(`
      INSERT INTO forum_replies (
        post_id, user_id, content, status, created_at
      ) VALUES (?, ?, ?, 'approved', ?)
    `);
    const actionInsert = db.prepare(`
      INSERT OR IGNORE INTO forum_post_actions (
        post_id, user_id, action_type, created_at
      ) VALUES (?, ?, ?, ?)
    `);
    const forumActors = shuffle(rng, storedStudents).slice(0, 140);
    forumActors.slice(0, 90).forEach((student, index) => {
      const createdAt = formatDateTime(addDays(now, -(14 - (index % 6)), 20, (index * 5) % 60));
      postInsert.run(
        student.id,
        `模拟帖子 ${pad(index + 1, 3)}：${student.grade}${student.class_name.replace(student.grade, '')} 备赛记录`,
        `<p>${student.name} 分享了近期训练、报名与平台使用体验，可用于论坛与审核流程演示。</p>`,
        `${student.name} 发布的备赛与平台互动记录`,
        index % 3 === 0 ? 'sports' : 'general',
        JSON.stringify(['运动会', '班级动态', '模拟数据']),
        admin.id,
        createdAt,
        index % 5,
        index % 4,
        index % 7 === 0 ? 1 : 0,
        createdAt,
        createdAt,
        createdAt
      );
      const postId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
      forumActors.slice(index % 10, (index % 10) + 2).forEach((replier, replyIndex) => {
        const replyAt = formatDateTime(addDays(now, -(13 - (index % 5)), 21, (replyIndex * 9 + index) % 60));
        replyInsert.run(postId, replier.id, `${replier.name} 回复：已了解班级训练安排，系统演示数据完整。`, replyAt);
      });
      forumActors.slice(index % 8, (index % 8) + 2).forEach((actor, actionIndex) => {
        actionInsert.run(postId, actor.id, actionIndex % 2 === 0 ? 'like' : 'favorite', createdAt);
      });
    });
    db.prepare(`
      UPDATE forum_posts
      SET reply_count = (
        SELECT COUNT(*) FROM forum_replies r WHERE r.post_id = forum_posts.id AND COALESCE(r.is_deleted, 0) = 0
      )
    `).run();

    const summary = buildDemoSummary(db);
    fs.copyFileSync(LIVE_DB_PATH, DEMO_DB_PATH);
    fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({
      success: true,
      demo_db: path.relative(ROOT_DIR, DEMO_DB_PATH),
      summary_file: path.relative(ROOT_DIR, SUMMARY_PATH),
      summary
    }, null, 2));
  } finally {
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, LIVE_DB_PATH);
      fs.unlinkSync(BACKUP_PATH);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
