const PRIMARY_ROLES = Object.freeze({
  STUDENT: 'student',
  TEACHER: 'teacher',
  GLOBAL_ADMIN: 'global_admin'
});

const ROLE_CODES = Object.freeze({
  STUDENT: 'student',
  HOMEROOM_TEACHER: 'teacher_homeroom',
  EVENT_TEACHER: 'teacher_event',
  GLOBAL_ADMIN: 'global_admin'
});

const TEACHER_TYPES = Object.freeze({
  HOMEROOM: 'homeroom_teacher',
  EVENT: 'event_teacher'
});

function normalizeText(value) {
  return String(value || '').trim();
}

function resolveAccessProfile(user = {}) {
  const legacyRole = normalizeText(user.role);
  const permissionRole = normalizeText(user.permission_role);
  const staffType = normalizeText(user.staff_type);
  const isTeacher = permissionRole === PRIMARY_ROLES.TEACHER || legacyRole === PRIMARY_ROLES.TEACHER || (legacyRole === 'admin' && Boolean(staffType));
  const isGlobalAdmin = permissionRole === PRIMARY_ROLES.GLOBAL_ADMIN || legacyRole === PRIMARY_ROLES.GLOBAL_ADMIN || (legacyRole === 'admin' && !staffType);
  const isStudent = permissionRole === PRIMARY_ROLES.STUDENT || legacyRole === PRIMARY_ROLES.STUDENT || (!isTeacher && !isGlobalAdmin);
  const isHomeroomTeacher = isTeacher && staffType === TEACHER_TYPES.HOMEROOM;
  const isEventTeacher = isTeacher && staffType === TEACHER_TYPES.EVENT;

  let primaryRole = PRIMARY_ROLES.STUDENT;
  let roleCode = ROLE_CODES.STUDENT;
  if (isHomeroomTeacher) {
    primaryRole = PRIMARY_ROLES.TEACHER;
    roleCode = ROLE_CODES.HOMEROOM_TEACHER;
  } else if (isEventTeacher) {
    primaryRole = PRIMARY_ROLES.TEACHER;
    roleCode = ROLE_CODES.EVENT_TEACHER;
  } else if (isGlobalAdmin) {
    primaryRole = PRIMARY_ROLES.GLOBAL_ADMIN;
    roleCode = ROLE_CODES.GLOBAL_ADMIN;
  }

  return {
    legacyRole,
    permissionRole: permissionRole || primaryRole,
    primaryRole,
    roleCode,
    staffType,
    isStudent,
    isTeacher,
    isGlobalAdmin,
    isHomeroomTeacher,
    isEventTeacher
  };
}

function buildPermissionPayload(user = {}) {
  const access = resolveAccessProfile(user);
  return {
    permission_role: access.primaryRole,
    permission_code: access.roleCode,
    staff_type: access.staffType
  };
}

module.exports = {
  PRIMARY_ROLES,
  ROLE_CODES,
  TEACHER_TYPES,
  resolveAccessProfile,
  buildPermissionPayload
};
