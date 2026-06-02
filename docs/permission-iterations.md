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
