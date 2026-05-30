const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始播种数据...');

  const hash = bcrypt.hashSync('admin123', 10);
  const stuHash = bcrypt.hashSync('123456', 10);

  // 管理员
  await prisma.user.upsert({
    where: { email: 'admin@hkms.hktedu.com' },
    update: {},
    create: {
      username: 'admin', email: 'admin@hkms.hktedu.com', password: hash,
      role: 'admin', studentId: 'ADMIN001', name: '系统管理员'
    }
  });

  // 运动会信息
  await prisma.meetInfo.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: '第三十届田径运动会', theme: 'SPEED · STRENGTH · HONOR',
      startDate: '2026-06-10', endDate: '2026-06-12', registrationOpen: 1
    }
  });

  // 比赛项目
  const events = [
    ['100米','track','individual','male',8,'国际田联标准规则','田径场'],
    ['100米','track','individual','female',8,'国际田联标准规则','田径场'],
    ['200米','track','individual','male',8,'国际田联标准规则','田径场'],
    ['200米','track','individual','female',8,'国际田联标准规则','田径场'],
    ['400米','track','individual','male',8,'国际田联标准规则','田径场'],
    ['400米','track','individual','female',8,'国际田联标准规则','田径场'],
    ['800米','track','individual','male',8,'国际田联标准规则','田径场'],
    ['800米','track','individual','female',8,'国际田联标准规则','田径场'],
    ['1500米','track','individual','male',12,'国际田联标准规则','田径场'],
    ['1500米','track','individual','female',12,'国际田联标准规则','田径场'],
    ['跳远','field','individual','male',12,'每人3次试跳，取最好成绩','沙坑区'],
    ['跳远','field','individual','female',12,'每人3次试跳，取最好成绩','沙坑区'],
    ['跳高','field','individual','male',12,'采用背越式或跨越式','跳高区'],
    ['跳高','field','individual','female',12,'采用背越式或跨越式','跳高区'],
    ['实心球','field','individual','male',12,'每人3次投掷','投掷区'],
    ['实心球','field','individual','female',12,'每人3次投掷','投掷区'],
    ['4×100米接力','relay','team','male',8,'每队4人','田径场接力区'],
    ['4×100米接力','relay','team','female',8,'每队4人','田径场接力区'],
    ['拔河','team','team','mixed',16,'每班15人','篮球场'],
    ['广播体操','team','team','mixed',50,'全班参与','操场'],
  ];
  for (const [name, cat, type, gender, max, rules, venue] of events) {
    await prisma.event.create({
      data: { name, category: cat, eventType: type, genderGroup: gender, maxParticipants: max, rules, venue }
    });
  }

  // 设置
  await prisma.setting.upsert({ where: { key: 'max_events_per_student' }, update: {}, create: { key: 'max_events_per_student', value: '3' } });
  await prisma.setting.upsert({ where: { key: 'site_name' }, update: {}, create: { key: 'site_name', value: '第三十届田径运动会' } });
  await prisma.setting.upsert({ where: { key: 'deepseek_api_key' }, update: {}, create: { key: 'deepseek_api_key', value: 'sk-4978103585944bb7b1243278bb547be7' } });

  // 学校信息
  const schoolData = [
    ['学校概况','学校简介','澳门濠江中学创立于1932年，秉持「忠诚、勤奋、求实、创新」校训。'],
    ['学校概况','学校历史','1932年由黄仁辅先生创办，至今已有90余年历史。'],
    ['校园设施','运动场地','标准400米田径跑道、室内体育馆、游泳池。'],
    ['师资力量','体育科组','8位专业教师，含前澳门田径代表队成员。'],
    ['运动会','本届运动会','第三十届田径运动会，设短跑、长跑、跳跃、投掷、接力及集体项目。'],
  ];
  for (const [cat, title, content] of schoolData) {
    await prisma.schoolInfo.create({ data: { category: cat, title, content } });
  }

  console.log('✅ 种子数据完成');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
