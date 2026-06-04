# 权限体系迭代记录

## 第 1 次迭代

- 目标：抽离统一权限角色解析底座，消除“平台管理员”和“教师账号”都使用 `role=admin` 带来的鉴权歧义。
- 本次变更：
  - 新增 `utils/accessControl.js`，统一解析学生、班主任、任课教师、全局管理员权限画像。
  - 鉴权中间件改为基于权限画像判断 `adminOnly`、`teacherOnly`、`homeroomTeacherOnly`、`eventTeacherOnly`。
  - 登录与 `/api/auth/me` 返回新增 `permission_role`、`permission_code`，为后续前后端拆分角色做兼容铺垫。
  - 教师端后端断言改为基于统一权限画像判断。
- 测试记录：
  - `@' ... resolveAccessProfile ... '@ | node`：输出显示 `student -> student`、`admin + homeroom_teacher -> teacher_homeroom`、`admin + event_teacher -> teacher_event`、`admin + 空 staff_type -> global_admin`。
  - `@' ... require('./server') ... quick-login ... '@ | node`：验证 `admin@hkms.hktedu.com` 返回 `permission_role=global_admin`，`teacher_homeroom@hkms.hktedu.com` 返回 `permission_role=teacher` 且 `permission_code=teacher_homeroom`。
  - `test_all.js`：已新增“权限角色解析兼容旧管理员与教师模型”回归用例，供后续全链路回归继续复用。
- 结果：通过。

## 第 2 次迭代

- 目标：把权限角色从“运行时推断”升级为“数据库持久化字段”，为后续彻底拆分学生 / 教师 / 全局管理员三类用户打底。
- 本次变更：
  - `users` 表新增并回填 `permission_role`，取值固定为 `student / teacher / global_admin`。
  - 默认管理员、默认教师种子账号改为同步写入 `permission_role`。
  - 管理端用户列表、用户详情、用户新增与编辑逻辑支持读写 `permission_role`。
  - 权限解析工具改为优先读取数据库持久化的 `permission_role`，保留旧 `role + staff_type` 兼容。
- 测试记录：
  - `@' ... initDatabase + SELECT email, role, permission_role, staff_type ... '@ | node`：确认 `admin@hkms.hktedu.com -> global_admin`，两类教师账号 -> `teacher`。
  - `@' ... require('./server') + /api/auth/quick-login + /api/admin/users ... '@ | node`：确认全局管理员登录后返回 `permission_role=global_admin`，管理员用户列表可返回教师账号的 `permission_role=teacher`。
  - `test_all.js`：已新增“权限角色解析优先使用持久化 permission_role”回归用例。
- 结果：通过。

## 第 3 次迭代

- 目标：收紧学生端访问范围，确保学生账号只能进入学生接口，且只能查看本人体育数据。
- 本次变更：
  - 新增 `studentOnly` 鉴权中间件，学生路由统一只允许学生账号访问。
  - 学生端班级排名、年级排名接口直接关闭，避免返回跨用户体育数据。
  - 学生好友链路新增目标用户角色过滤，禁止学生通过好友入口接触教师或全局管理员账号资料。
  - 学生好友列表、申请箱、已发申请查询增加学生角色过滤，避免混入非学生对象。
- 测试记录：
  - `@' ... generateToken(student/teacher) + /api/student/profile ... '@ | node`：验证学生访问个人资料返回 `200`，教师访问学生资料返回 `403`。
  - 同一脚本验证 `/api/student/results/class`、`/api/student/results/grade` 均返回 `403`。
  - 同一脚本验证学生向教师账号发起好友申请返回 `404`，不再暴露教师资料入口。
  - `test_all.js`：已补充“教师访问学生接口被拒绝”“学生访问班级/年级排名被拒绝”“学生向教师发好友申请被拦截”等回归用例。
- 结果：通过。

## 第 4 次迭代

- 目标：将班主任教师权限从“班级维度可配置”进一步收紧为“必须严格绑定到唯一负责班级”，避免因配置不完整导致范围放大。
- 本次变更：
  - 班主任查询条件改为必须同时具备 `managed_grade` 与 `managed_class_name`。
  - 班主任总览接口继续只返回所负责班级学生数据，不再接受仅年级或仅班级的半配置状态。
  - 任课教师访问班主任总览仍被拒绝，避免教师角色横向越权。
  - `test_all.js` 补充“班主任总览仅返回本班学生”“任课教师不能访问班主任总览”回归用例。
- 测试记录：
  - `@' ... /api/teacher/homeroom/overview ... '@ | node`：验证班主任总览返回 `200`，且结果中未出现任何非本班学生。
  - 同一脚本验证任课教师访问班主任总览返回 `400`。
  - 同一脚本临时清空班主任 `managed_class_name` 后再次请求，接口返回 `400`，随后已恢复原配置。
- 结果：通过。

## 第 5 次迭代

- 目标：补齐全局管理员查看全部学生与教师数据的总览能力，支持从一个入口查看学生分布、班主任负责范围、任课教师分配与录入工作量。
- 本次变更：
  - `routes/admin.js` 新增 `GET /api/admin/users/insights`，聚合输出学生年级分布、重点班级数据、班主任负责范围、任课教师分配项目与成绩录入量、全局管理员列表。
  - `public/js/api.js` 新增 `API.admin.getUserInsights()`。
  - `public/js/admin.js` 在“用户管理”页顶部补充全局用户总览卡片，以及学生/班主任/任课教师/全局管理员明细表。
  - 该接口继续受 `adminOnly` 保护，仅全局管理员可访问，教师与学生不可见。
- 测试记录：
  - `test_all.js`：新增“GET /api/admin/users/insights”回归用例，校验返回统计结构。
  - `test_all.js`：新增“GET /api/admin/users/insights 拒绝教师访问”回归用例，校验返回 `403`。
- 结果：通过。
