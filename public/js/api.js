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
    const retryCount = Math.max(0, Number(opts.retryCount) || 0);
    const retryDelayMs = Math.max(0, Number(opts.retryDelayMs) || 500);
    const timeoutMs = Math.max(0, Number(opts.timeoutMs) || 0);

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) headers['Authorization'] = 'Bearer ' + this.token;

      const options = { method, headers };
      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }

      let controller = null;
      let timer = null;

      try {
        if (timeoutMs && typeof AbortController !== 'undefined') {
          controller = new AbortController();
          options.signal = controller.signal;
          timer = setTimeout(() => controller.abort(), timeoutMs);
        }

        const res = await fetch(url, options);
        let result = {};
        try {
          result = await res.json();
        } catch (_) {
          result = { error: '伺服器回应异常' };
        }

        if (res.status === 401) {
          if (opts.silent401) {
            return { success: false, error: result.error || '未授权', status: 401 };
          }
          this.clearToken();
          if (!opts.noRedirect) window.location.hash = '#/login';
          throw new Error(result.error || '请重新登录');
        }

        if (res.status >= 500) {
          const serverError = new Error(result.error || '伺服器内部错误，请稍後再试');
          serverError.retryable = true;
          throw serverError;
        }

        if (!res.ok && result.success === undefined && !result.error) {
          result.error = '请求失败';
        }

        return result;
      } catch (error) {
        const isTimeout = error?.name === 'AbortError';
        const isNetworkError = error instanceof TypeError;
        const retryable = !!error?.retryable || isTimeout || isNetworkError;
        if (attempt < retryCount && retryable) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        if (isTimeout) throw new Error('请求超时，请稍后重试');
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
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
    try { result = await res.json(); } catch (_) { result = { error: '伺服器回应异常' }; }
    if (res.status === 401) {
      this.clearToken();
      window.location.hash = '#/login';
      throw new Error(result.error || '请重新登录');
    }
    if (res.status >= 500) throw new Error(result.error || '上传失败');
    return result;
  },

  async download(path, filename = '') {
    const url = this.baseURL + path;
    const headers = {};
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const res = await fetch(url, { method: 'GET', headers });
    if (res.status === 401) {
      this.clearToken();
      window.location.hash = '#/login';
      throw new Error('请重新登录');
    }
    if (!res.ok) {
      let errorMessage = '下载失败';
      try {
        const payload = await res.json();
        errorMessage = payload.error || errorMessage;
      } catch (_) {
        // ignore
      }
      throw new Error(errorMessage);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const matched = disposition.match(/filename="?([^"]+)"?/i);
    const finalName = filename || (matched && matched[1]) || 'download.xlsx';
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
    return { success: true, filename: finalName };
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
    search(params) {
      const query = typeof params === 'string' ? { q: params } : params;
      return API.get('/public/search' + API._qs(query));
    },
    searchSuggest(q) {
      return API.get('/public/search/suggest' + API._qs({ q }));
    },
    getHighlights() { return API.get('/public/highlights'); },
    uploadHighlight(formData) { return API.upload('/public/highlights', formData); },
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
    getRegistrationDetail(id) { return API.get('/admin/registrations/' + id); },
    approveRegistration(id) { return API.put('/admin/registrations/' + id + '/approve'); },
    rejectRegistration(id) { return API.put('/admin/registrations/' + id + '/reject'); },
    approveCancel(id) { return API.put('/admin/registrations/' + id + '/approve-cancel'); },
    rejectCancel(id) { return API.put('/admin/registrations/' + id + '/reject-cancel'); },

    // 数据导出
    exportResults(params) { return API.get('/admin/exports/results' + API._qs(params)); },
    exportRegistrations(params) { return API.get('/admin/exports/registrations' + API._qs(params)); },

    getScheduleParticipants(id) { return API.get('/admin/schedules/' + id + '/participants'); },
    getDashboard() { return API.get('/admin/dashboard'); },
    getStats() { return API.get('/admin/stats'); },

    // 文件上传
    uploadImage(formData) { return API.upload('/admin/upload/image', formData); },
    uploadFile(formData) { return API.upload('/admin/upload/file', formData); },

    // 照片管理
    getHighlights() { return API.get('/admin/highlights'); },
    approveHighlight(id) { return API.put('/admin/highlights/' + id + '/approve'); },
    rejectHighlight(id) { return API.put('/admin/highlights/' + id + '/reject'); },
    deleteHighlight(id) { return API.delete('/admin/highlights/' + id); },
  },

  // ==================== AI ====================
  ai: {
    generateSchedule() { return API.get('/ai/generate-schedule'); },
    exportSchedulePDF(schedule) { return API.post('/ai/export-schedule-pdf', { schedule }, { rawResponse: true }); },
    getAIStatus() { return API.get('/ai/ai-status'); },
  },

  // ==================== 学生接口 ====================
  student: {
    getMyProfile() { return API.get('/student/profile'); },
    updatePassword(data) { return API.put('/student/profile/password', data); },
    updateAvatar(avatar) { return API.put('/student/profile/avatar', { avatar }); },
    getFriends(opts = {}) {
      return API.request('GET', '/student/friends', null, {
        timeoutMs: 8000,
        retryCount: 2,
        retryDelayMs: 700,
        ...opts
      });
    },
    sendFriendRequest(data) { return API.post('/student/friends/requests', data); },
    respondFriendRequest(id, action) { return API.put('/student/friends/requests/' + id + '/respond', { action }); },
    getNotifications(params) { return API.get('/student/notifications' + API._qs(params)); },
    getNotificationDetail(id) {
      return API.request('GET', '/student/notifications/' + id, null, {
        timeoutMs: 8000,
        retryCount: 1,
        retryDelayMs: 500
      });
    },
    markNotificationRead(id) { return API.put('/student/notifications/' + id + '/read'); },
    markAllNotificationsRead() { return API.put('/student/notifications/read-all'); },
    deleteNotification(id) { return API.delete('/student/notifications/' + id); },
    getMyRegistrations() { return API.get('/student/registrations'); },
    submitRegistration(eventId) { return API.post('/student/registrations', { event_id: eventId }); },
    cancelRegistration(id, reason) { return API.request('DELETE', '/student/registrations/' + id, { reason }); },
    getMyResults() { return API.get('/student/results'); },
    getMySchedules() { return API.get('/student/my-schedules'); },
    getUpcomingReminders() { return API.get('/student/upcoming-reminders'); },
    markAnnouncementRead(id) { return API.put('/student/announcements/' + id + '/read'); },
  },

  teacher: {
    getProfile() { return API.get('/teacher/me'); },
    getHomeroomOverview(params) { return API.get('/teacher/homeroom/overview' + API._qs(params)); },
    exportHomeroomOverview(params) { return API.download('/teacher/homeroom/overview/export' + API._qs(params), 'homeroom-overview.xlsx'); },
    getHomeroomRegistrations(params) { return API.get('/teacher/homeroom/registrations' + API._qs(params)); },
    reviewRegistration(id, data) { return API.put('/teacher/registrations/' + id + '/review', data); },
    reviewCancelRegistration(id, data) { return API.put('/teacher/registrations/' + id + '/cancel-review', data); },
    batchReviewRegistrations(data) { return API.post('/teacher/registrations/batch-review', data); },
    getAssignments() { return API.get('/teacher/event/assignments'); },
    getResultsEntry(params) { return API.get('/teacher/event/results-entry' + API._qs(params)); },
    batchSaveResults(data) { return API.post('/teacher/event/results/batch-save', data); },
  },

  gallery: {
    getApproved(params) { return API.get('/gallery/approved' + API._qs(params)); },
    upload(formData) { return API.upload('/gallery/upload', formData); },
    // 管理员
    adminList(params) { return API.get('/admin/gallery' + API._qs(params)); },
    approve(id) { return API.put('/admin/gallery/' + id + '/approve'); },
    reject(id) { return API.put('/admin/gallery/' + id + '/reject'); },
    delete(id) { return API.delete('/admin/gallery/' + id); },
  },

  forum: {
    getMeta() { return API.get('/forum/meta'); },
    getPosts(params) { return API.get('/forum/posts' + API._qs(params)); },
    getPost(id) { return API.get('/forum/posts/' + id); },
    createPost(data) {
      if (data instanceof FormData) return API.upload('/forum/posts', data);
      return API.post('/forum/posts', data);
    },
    uploadAttachments(formData) { return API.upload('/forum/attachments', formData); },
    reply(postId, content) { return API.post('/forum/posts/' + postId + '/replies', { content }); },
    likePost(id) { return API.post('/forum/posts/' + id + '/like', {}); },
    favoritePost(id) { return API.post('/forum/posts/' + id + '/favorite', {}); },
    reportPost(id, data) { return API.post('/forum/posts/' + id + '/report', data); },
    deletePost(id) { return API.delete('/forum/posts/' + id); },
    deleteReply(id) { return API.delete('/forum/replies/' + id); },
    deleteImage(postId, filename) { return API.delete('/forum/posts/' + postId + '/images/' + encodeURIComponent(filename)); },
    approveImages(postId) { return API.put('/forum/posts/' + postId + '/images/approve'); },
    rejectImages(postId) { return API.put('/forum/posts/' + postId + '/images/reject'); },
    getAdminPosts(params) { return API.get('/forum/admin/posts' + API._qs(params)); },
    auditPost(id, data) { return API.put('/forum/admin/posts/' + id + '/audit', data); },
    getPendingReplies() { return API.get('/forum/admin/replies/pending'); },
    auditReply(id, data) { return API.put('/forum/admin/replies/' + id + '/audit', data); },
    handleReport(id, data) { return API.put('/forum/admin/reports/' + id + '/handle', data); },
    muteUser(id, data) { return API.put('/forum/admin/users/' + id + '/mute', data); },
    getAdminStats() { return API.get('/forum/admin/stats'); },
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
