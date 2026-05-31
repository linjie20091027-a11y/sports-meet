const API = {
  baseURL: '/api',
  token: localStorage.getItem('token') || '',

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  },

  clearToken() {
    this.token = '';
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  async request(method, path, data = null, opts = {}) {
    const url = this.baseURL + path;
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;

    const options = { method, headers };
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const res = await fetch(url, options);
    let result = {};
    try {
      result = await res.json();
    } catch (_) {
      result = { error: '伺服器回應異常' };
    }

    if (res.status === 401) {
      if (opts.silent401) {
        return { success: false, error: result.error || '未授權', status: 401 };
      }
      this.clearToken();
      if (!opts.noRedirect) window.location.hash = '#/login';
      throw new Error(result.error || '請重新登入');
    }

    // 業務校驗錯誤（4xx）仍返回 JSON，由呼叫方依 success / error 處理
    if (res.status >= 500) {
      throw new Error(result.error || '伺服器內部錯誤，請稍後再試');
    }

    if (!res.ok && result.success === undefined && !result.error) {
      result.error = '請求失敗';
    }

    return result;
  },

  get(path) { return this.request('GET', path); },
  post(path, data) { return this.request('POST', path, data); },
  put(path, data) { return this.request('PUT', path, data); },
  delete(path) { return this.request('DELETE', path); },

  async upload(path, formData) {
    const url = this.baseURL + path;
    const headers = {};
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    let result = {};
    try { result = await res.json(); } catch (_) { result = { error: '伺服器回應異常' }; }
    if (res.status === 401) {
      this.clearToken();
      window.location.hash = '#/login';
      throw new Error(result.error || '請重新登入');
    }
    if (res.status >= 500) throw new Error(result.error || '上傳失敗');
    return result;
  },

  exportExcel(data, filename) {
  },

  // ==================== 认证 ====================
  auth: {
    login(data) { return API.post('/auth/login', data); },
    register(data) { return API.post('/auth/register', data); },
    me() { return API.request('GET', '/auth/me', null, { silent401: true }); },
    logout() { return API.post('/auth/logout', {}); },
    getCaptcha() { return API.get('/auth/captcha'); },
    forgotPassword(email) { return API.post('/auth/forgot-password', { email }); },
    resetPassword(token, password) { return API.post('/auth/reset-password', { token, password }); },
  },

  // ==================== 公共接口 ====================
  public: {
    getMeetInfo() { return API.get('/public/meet-info'); },
    getEvents(params) { return API.get('/public/events' + API._qs(params)); },
    getEvent(id) { return API.get('/public/events/' + id); },
    getSchedules(params) { return API.get('/public/schedules' + API._qs(params)); },
    getResults(params) { return API.get('/public/results' + API._qs(params)); },
    getAnnouncements(params) { return API.get('/public/announcements' + API._qs(params)); },
    getAnnouncement(id) { return API.get('/public/announcements/' + id); },
    getGrades() { return API.get('/public/grades'); },
    search(q) { return API.get('/public/search' + API._qs({ q })); },
  },

  // ==================== 管理员接口 ====================
  admin: {
    // 运动会管理
    createMeet(data) { return API.post('/admin/meets', data); },
    updateMeet(id, data) { return API.put('/admin/meets/' + id, data); },
    getMeets(params) { return API.get('/admin/meets' + API._qs(params)); },

    // 项目/赛事管理
    createEvent(data) { return API.post('/admin/events', data); },
    updateEvent(id, data) { return API.put('/admin/events/' + id, data); },
    deleteEvent(id) { return API.delete('/admin/events/' + id); },
    batchImportEvents(data) { return API.post('/admin/events/batch', data); },

    // 赛程管理
    createSchedule(data) { return API.post('/admin/schedules', data); },
    updateSchedule(id, data) { return API.put('/admin/schedules/' + id, data); },
    deleteSchedule(id) { return API.delete('/admin/schedules/' + id); },
    batchImportSchedules(data) { return API.post('/admin/schedules/batch', data); },

    // 成绩管理
    submitResult(data) { return API.post('/admin/results', data); },
    updateResult(id, data) { return API.put('/admin/results/' + id, data); },
    deleteResult(id) { return API.delete('/admin/results/' + id); },
    batchImportResults(data) { return API.post('/admin/results/batch', data); },

    // 公告管理
    createAnnouncement(data) { return API.post('/admin/announcements', data); },
    updateAnnouncement(id, data) { return API.put('/admin/announcements/' + id, data); },
    deleteAnnouncement(id) { return API.delete('/admin/announcements/' + id); },

    // 用户管理
    getUsers(params) { return API.get('/admin/users' + API._qs(params)); },
    getUser(id) { return API.get('/admin/users/' + id); },
    updateUser(id, data) { return API.put('/admin/users/' + id, data); },
    deleteUser(id) { return API.delete('/admin/users/' + id); },
    resetUserPassword(id, data) { return API.put('/admin/users/' + id + '/reset-password', data); },

    // 班级/年级管理
    createGrade(data) { return API.post('/admin/grades', data); },
    updateGrade(id, data) { return API.put('/admin/grades/' + id, data); },
    deleteGrade(id) { return API.delete('/admin/grades/' + id); },
    createClass(data) { return API.post('/admin/classes', data); },
    updateClass(id, data) { return API.put('/admin/classes/' + id, data); },
    deleteClass(id) { return API.delete('/admin/classes/' + id); },

    // 报名管理
    getRegistrations(params) { return API.get('/admin/registrations' + API._qs(params)); },
    approveRegistration(id) { return API.put('/admin/registrations/' + id + '/approve'); },
    rejectRegistration(id) { return API.put('/admin/registrations/' + id + '/reject'); },

    // 数据导出
    exportResults(params) { return API.get('/admin/exports/results' + API._qs(params)); },
    exportRegistrations(params) { return API.get('/admin/exports/registrations' + API._qs(params)); },

    getScheduleParticipants(id) { return API.get('/admin/schedules/' + id + '/participants'); },
    getDashboard() { return API.get('/admin/dashboard'); },
    getStats() { return API.get('/admin/stats'); },

    // 文件上传
    uploadImage(formData) { return API.upload('/admin/upload/image', formData); },
    uploadFile(formData) { return API.upload('/admin/upload/file', formData); },
  },

  // ==================== 学生接口 ====================
  student: {
    getMyProfile() { return API.get('/student/profile'); },
    updatePassword(data) { return API.put('/student/profile/password', data); },
    updateAvatar(avatar) { return API.put('/student/profile/avatar', { avatar }); },
    getMyRegistrations() { return API.get('/student/registrations'); },
    submitRegistration(eventId) { return API.post('/student/registrations', { event_id: eventId }); },
    cancelRegistration(id) { return API.delete('/student/registrations/' + id); },
    getMyResults() { return API.get('/student/results'); },
    getMySchedules() { return API.get('/student/schedules'); },
    markAnnouncementRead(id) { return API.put('/student/announcements/' + id + '/read'); },
    getNotifications(params) { return API.get('/student/notifications' + API._qs(params)); },
    markNotificationRead(id) { return API.put('/student/notifications/' + id + '/read'); },
    markAllNotificationsRead() { return API.put('/student/notifications/read-all'); },
  },

  forum: {
    getPosts(params) { return API.get('/forum/posts' + API._qs(params)); },
    getPost(id) { return API.get('/forum/posts/' + id); },
    createPost(data) { return API.post('/forum/posts', data); },
    reply(postId, content) { return API.post('/forum/posts/' + postId + '/replies', { content }); },
    deletePost(id) { return API.delete('/forum/posts/' + id); },
    deleteReply(id) { return API.delete('/forum/replies/' + id); },
  },

  // ==================== 工具方法 ====================
  _qs(params) {
    if (!params) return '';
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');
    return qs ? '?' + qs : '';
  },
};
