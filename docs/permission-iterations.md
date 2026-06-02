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
