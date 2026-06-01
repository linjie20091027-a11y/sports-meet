const App = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  countdownTimer: null,
  notificationPanelOpen: false,
  notificationPollTimer: null,
  notificationItems: [],
  notificationUnread: 0,
  notificationReady: false,
  searchState: {
    query: '',
    type: 'all',
    page: 1,
    limit: 12,
    filters: {
      category: '',
      grade: '',
      start_date: '',
      end_date: '',
      department: '',
      participant_event: ''
    },
    counts: {},
    total: 0,
    total_pages: 0,
    items: [],
    sections: {}
  },
  searchSuggestTimer: null,
  searchLastRequestId: 0,
  searchHistoryKey: 'sports_meet_search_history',
  friendState: {
    loaded: false,
    friends: [],
    incoming: [],
    outgoing: [],
    friendIds: [],
    pendingReceivedIds: [],
    pendingSentIds: [],
    groups: []
  },
  _shownReminders: new Set(),
  _reminderPollTimer: null,

  async init() {
    this.bindNavigation();
    this._initNotifications();
    this.bindSearch();
    this.updateNav();
    this.handleRoute();
    this._initMusic();
    // 倒计时独立启动，不依赖API
    this._startCountdownSafe();
    window.addEventListener('hashchange', () => this.handleRoute());
  },

  _startCountdownSafe() {
    // 硬编码目标时间，不依赖API响应
    var target = new Date('2026-10-22T08:00:00+08:00');
    var self = this;
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    
    var tick = function() {
      var diff = target - new Date();
      var els = {
        days: document.getElementById('cd-days'),
        hours: document.getElementById('cd-hours'),
        mins: document.getElementById('cd-mins'),
        secs: document.getElementById('cd-secs')
      };
      // 如果元素不存在，跳过
      if (!els.days) return;
      
      if (diff <= 0) {
        els.days.textContent = '0';
        els.hours.textContent = '0';
        els.mins.textContent = '0';
        els.secs.textContent = '0';
        clearInterval(self.countdownTimer);
        return;
      }
      els.days.textContent = Math.floor(diff / 86400000);
      els.hours.textContent = Math.floor((diff % 86400000) / 3600000);
      els.mins.textContent = Math.floor((diff % 3600000) / 60000);
      els.secs.textContent = Math.floor((diff % 60000) / 1000);
    };
    tick();
    this.countdownTimer = setInterval(tick, 1000);
  },

  syncSessionFromStorage() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    API.token = token || '';
    if (token && userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch (_) {
        this.user = null;
      }
    } else {
      this.user = null;
      this._resetFriendState();
    }
  },

  async refreshUser() {
    this.syncSessionFromStorage();
    const token = localStorage.getItem('token');
    if (!token) {
      this.user = null;
      API.token = '';
      this._resetFriendState();
      this.updateNav();
      return;
    }
    API.token = token;
    try {
      const res = await API.auth.me();
      if (res.success && res.data) {
        this.user = res.data;
        localStorage.setItem('user', JSON.stringify(res.data));
      } else if (res.status === 401) {
        API.clearToken();
        this.user = null;
        this._resetFriendState();
      }
    } catch (_) {
      /* 网路异常时保留本地登录状态 */
    }
    if (!this.user || this.user.role !== 'student') this._resetFriendState();
    this.updateNav();
  },

  _resetFriendState() {
    this.friendState = {
      loaded: false,
      friends: [],
      incoming: [],
      outgoing: [],
      friendIds: [],
      pendingReceivedIds: [],
      pendingSentIds: [],
      groups: []
    };
  },

  async ensureFriendState(force = false) {
    if (!this.user || this.user.role !== 'student') {
      this._resetFriendState();
      return this.friendState;
    }
    if (this.friendState.loaded && !force) return this.friendState;
    const res = await API.student.getFriends();
    if (!res.success) throw new Error(res.error || '加载好友资料失败');
    const data = res.data || {};
    this.friendState = {
      loaded: true,
      friends: data.friends || [],
      incoming: data.incoming || [],
      outgoing: data.outgoing || [],
      friendIds: (data.friend_ids || []).map(Number),
      pendingReceivedIds: (data.pending_received_ids || []).map(Number),
      pendingSentIds: (data.pending_sent_ids || []).map(Number),
      groups: data.groups || []
    };
    return this.friendState;
  },

  _getFriendActionMeta(item) {
    const targetId = Number(item?.user_id || item?.id || 0);
    if (!targetId || !this.user || this.user.role !== 'student') return null;
    if (Number(this.user.id) === targetId) {
      return { state: 'self', label: '自己', disabled: true };
    }
    if (this.friendState.friendIds.includes(targetId)) {
      return { state: 'friend', label: '已是好友', disabled: true };
    }
    if (this.friendState.pendingReceivedIds.includes(targetId)) {
      return { state: 'incoming', label: '待你处理', disabled: true };
    }
    if (this.friendState.pendingSentIds.includes(targetId)) {
      return { state: 'pending', label: '申请中', disabled: true };
    }
    return { state: 'ready', label: '添加好友', disabled: false };
  },

  showFriendRequestModal(targetUser) {
    if (!this.user || this.user.role !== 'student') {
      this.showToast('请先使用学生账号登录', 'warning');
      return;
    }
    const userId = Number(targetUser?.user_id || targetUser?.id || 0);
    if (!userId) return;
    const groups = Array.from(new Set(['同学', '舍友', '同项目', ...(this.friendState.groups || [])]));
    this.showModal(`
      <div class="modal__header">
        <h3 class="modal__title">添加好友</h3>
        <button type="button" class="modal__close" data-close-modal><i class="fas fa-times"></i></button>
      </div>
      <div class="modal__body">
        <div class="friend-request-card">
          <div class="friend-request-card__avatar">
            ${targetUser.avatar ? `<img src="${this._escAttr(targetUser.avatar)}" alt="${this._escAttr(targetUser.title || targetUser.name || '')}">` : '<i class="fas fa-user"></i>'}
          </div>
          <div>
            <strong>${this._escHtml(targetUser.title || targetUser.name || '未命名用户')}</strong>
            <small>${this._escHtml(targetUser.subtitle || targetUser.account || '发起好友申请')}</small>
          </div>
        </div>
        <div class="form__group">
          <label class="form__label">好友分组</label>
          <select id="friend-group-input" class="form__input">
            ${groups.map(group => `<option value="${this._escAttr(group)}">${this._escHtml(group)}</option>`).join('')}
          </select>
        </div>
        <div class="form__group">
          <label class="form__label">申请备注</label>
          <textarea id="friend-remark-input" class="form__input" rows="4" placeholder="我是 ${this._escAttr(this.user.name || this.user.username || '')}，想加你为好友"></textarea>
          <small class="form-hint">可填写身份说明、共同项目或想打招呼的话</small>
        </div>
      </div>
      <div class="modal__footer">
        <button type="button" class="btn btn-secondary btn-sm" data-close-modal>取消</button>
        <button type="button" class="btn btn-primary btn-sm" id="friend-request-submit-btn">发送申请</button>
      </div>
    `);
    document.getElementById('friend-request-submit-btn')?.addEventListener('click', async () => {
      const remark = document.getElementById('friend-remark-input')?.value || '';
      const friendGroup = document.getElementById('friend-group-input')?.value || '同学';
      try {
        this.showLoading();
        const res = await API.student.sendFriendRequest({
          target_user_id: userId,
          remark,
          friend_group: friendGroup
        });
        if (!res.success) throw new Error(res.error || '发送好友申请失败');
        await this.ensureFriendState(true);
        this.hideLoading();
        this.hideModal(true);
        this.showToast(res.message || '好友申请已发送', 'success');
        if (!document.getElementById('search-overlay')?.classList.contains('hidden')) {
          this._showSearchResults(this.searchState);
        }
        if (typeof Student !== 'undefined' && Student.currentTab === 'friends') {
          Student._renderFriends();
        }
      } catch (e) {
        this.hideLoading();
        this.showToast(e.message || '发送好友申请失败', 'error');
      }
    });
  },

  // ====== 路由 ======
  handleRoute() {
    this.syncSessionFromStorage();
    const hash = window.location.hash.slice(1) || '/';
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    if (hash === '/' || hash === '') {
      document.getElementById('page-home').classList.remove('hidden');
      document.querySelector('[href="#/"]')?.classList.add('active');
      this.renderHome();
    } else if (hash === '/login') {
      if (this.user) {
        window.location.hash = this.user.role === 'admin' ? '#/admin' : '#/student';
        return;
      }
      Auth.renderLogin();
      document.getElementById('page-login').classList.remove('hidden');
    } else if (hash === '/register') {
      if (this.user) { window.location.hash = '#/'; return; }
      Auth.renderRegister();
      document.getElementById('page-register').classList.remove('hidden');
    } else if (hash === '/events') {
      document.getElementById('page-events').classList.remove('hidden');
      document.querySelector('[href="#/events"]')?.classList.add('active');
      this.renderEvents();
    } else if (hash === '/results') {
      document.getElementById('page-results').classList.remove('hidden');
      document.querySelector('[href="#/results"]')?.classList.add('active');
      // 确保容器可见
      var c = document.getElementById('results-table');
      if (c) c.style.display = 'block';
      this.renderResults();
    } else if (hash.startsWith('/results/group/')) {
      document.getElementById('page-results').classList.remove('hidden');
      document.querySelector('[href="#/results"]')?.classList.add('active');
      var parts = hash.replace('/results/group/','').split('/').filter(Boolean);
      if (parts.length === 1) this._renderGroupDetail(parts[0]);
      else if (parts.length === 2) this._renderGenderDetail(parts[0], parts[1]);
      else if (parts.length === 3) this._renderEventRanking(parts[0], parts[1], decodeURIComponent(parts[2]));
    } else if (hash === '/announcements') {
      document.getElementById('page-announcements').classList.remove('hidden');
      document.querySelector('[href="#/announcements"]')?.classList.add('active');
      this.renderAnnouncements();
    } else if (hash.startsWith('/events/') || hash.startsWith('/event/')) {
      const eventId = hash.split('/')[2];
      document.getElementById('page-event-detail')?.classList.remove('hidden');
      document.querySelector('[href="#/events"]')?.classList.add('active');
      this.renderEventDetailPage(eventId);
    } else if (hash.startsWith('/forum')) {
      document.getElementById('page-forum')?.classList.remove('hidden');
      document.querySelector('[href="#/forum"]')?.classList.add('active');
      if (typeof Forum !== 'undefined') {
        Forum.handleRoute(hash);
        Forum._initAIChat();
      }
    } else if (hash.startsWith('/announcements/')) {
      var annId = hash.split('/')[2];
      if (annId && /^\d+$/.test(annId)) {
        document.getElementById('page-announcement-detail').classList.remove('hidden');
        document.querySelector('[href="#/announcements"]')?.classList.add('active');
        this.showAnnouncementDetail(annId);
      } else {
        document.getElementById('page-announcements').classList.remove('hidden');
        document.querySelector('[href="#/announcements"]')?.classList.add('active');
        this.renderAnnouncements();
      }
    } else if (hash === '/admin') {
      if (!this.user || this.user.role !== 'admin') { window.location.hash = '#/login'; return; }
      document.getElementById('page-admin').classList.remove('hidden');
      document.querySelector('[href="#/admin"]')?.classList.add('active');
      Admin.render();
    } else if (hash === '/student' || hash.startsWith('/student/')) {
      if (!this.user) { window.location.hash = '#/login'; return; }
      if (this.user.role === 'admin') {
        this.showToast('管理员账号无法报名，请使用学生账号登录', 'warning');
        window.location.hash = '#/';
        return;
      }
      const tab = hash.split('/')[2];
      if (tab) Student.currentTab = tab;
      document.getElementById('page-student').classList.remove('hidden');
      document.querySelector('#nav-register-link')?.classList.add('active');
      document.querySelector('[href="#/student"]')?.classList.add('active');
      Student.render();
    }
  },

  // ====== 导航 ======
  bindNavigation() {
    document.getElementById('nav-toggle')?.addEventListener('click', () => {
      document.getElementById('nav-links')?.classList.toggle('show');
    });
    document.getElementById('menu-logout')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.logout();
    });
    // 移动端点击切换用户下拉菜单
    document.getElementById('user-name-display')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelector('.user-dropdown')?.classList.toggle('show');
    });
    document.getElementById('notify-wrapper')?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    // 点击其他地方关闭
    document.addEventListener('click', () => {
      document.querySelector('.user-dropdown')?.classList.remove('show');
      this._toggleNotificationPanel(false);
      this._closeSwipedNotifications();
      this._hideSearchSuggest();
    });
  },

  updateNav() {
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    const authBtns = document.getElementById('auth-btns');
    const userMenu = document.getElementById('user-menu');
    const notifyBell = document.getElementById('notify-bell');
    const notifyWrapper = document.getElementById('notify-wrapper');
    if (!authBtns || !userMenu) return;

    if (this.user) {
      authBtns.classList.add('hidden');
      userMenu.classList.remove('hidden');
      const nameEl = document.getElementById('user-name-display');
      if (nameEl) nameEl.textContent = this.user.name || this.user.username || '';
      // 根据角色显示管理后台/个人中心
      const adminLink = document.getElementById('menu-admin-link');
      const studentLink = document.getElementById('menu-student-link');
      if (adminLink) adminLink.classList.toggle('hidden', this.user.role !== 'admin');
      if (studentLink) studentLink.classList.toggle('hidden', this.user.role !== 'student');
      if (notifyBell) notifyBell.classList.remove('hidden');
      if (notifyWrapper) notifyWrapper.classList.remove('hidden');
      this._ensureNotificationPolling();
      this._startReminderPolling();
      this._loadNotifications({ silent: true });
    } else {
      authBtns.classList.remove('hidden');
      userMenu.classList.add('hidden');
      if (notifyBell) notifyBell.classList.add('hidden');
      if (notifyWrapper) notifyWrapper.classList.add('hidden');
      this._toggleNotificationPanel(false);
      this._stopNotificationPolling();
      this._stopReminderPolling();
      this.notificationItems = [];
      this.notificationUnread = 0;
      this.notificationReady = false;
      this._updateNotificationBadge(0);
    }
  },

  _initNotifications() {
    const bell = document.getElementById('notify-bell');
    const panel = document.getElementById('notify-panel');
    const list = document.getElementById('notify-panel-list');
    const markAll = document.getElementById('notify-mark-all-btn');

    bell?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.user) return;
      this._toggleNotificationPanel();
    });

    panel?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    markAll?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this._markAllRead();
    });

    list?.addEventListener('click', async (e) => {
      const item = e.target.closest('.notify-item');
      if (!item) return;
      const id = parseInt(item.dataset.id, 10);
      const targetUrl = item.dataset.url || '';

      if (e.target.closest('[data-action="delete"]')) {
        e.preventDefault();
        await this._deleteNotification(id);
        return;
      }

      if (e.target.closest('[data-action="read"]')) {
        e.preventDefault();
        await this._markNotificationRead(id);
        return;
      }

      if (e.target.closest('[data-action="open"]')) {
        e.preventDefault();
        await this._openNotification(id, targetUrl);
      }
    });
  },

  _ensureNotificationPolling() {
    if (this.notificationPollTimer || !this.user) return;
    this.notificationPollTimer = setInterval(() => {
      if (!this.user) return;
      this._loadNotifications({ silent: true });
    }, 30000);
  },

  _stopNotificationPolling() {
    if (this.notificationPollTimer) {
      clearInterval(this.notificationPollTimer);
      this.notificationPollTimer = null;
    }
  },

  _startReminderPolling() {
    if (this._reminderPollTimer || !this.user || this.user.role !== 'student') return;
    this._checkUpcomingReminders();
    this._reminderPollTimer = setInterval(() => {
      if (!this.user || this.user.role !== 'student') return;
      this._checkUpcomingReminders();
    }, 30000);
  },

  _stopReminderPolling() {
    if (this._reminderPollTimer) {
      clearInterval(this._reminderPollTimer);
      this._reminderPollTimer = null;
    }
  },

  async _checkUpcomingReminders() {
    try {
      const res = await API.student.getUpcomingReminders();
      if (!res.success || !res.data?.length) return;
      res.data.forEach(r => {
        const key = r.schedule_id;
        if (this._shownReminders.has(key)) return;
        this._shownReminders.add(key);
        this._showReminderToast(r);
      });
    } catch (e) {}
  },

  _showReminderToast(reminder) {
    const time = reminder.start_time ? reminder.start_time.replace('T',' ').substring(0,16) : '-';
    const genderL = { male: '男子', female: '女子', mixed: '混合' };
    const eventLabel = `${reminder.event_name}（${genderL[reminder.gender_group] || ''}${reminder.round_name ? '·' + reminder.round_name : ''}）`;
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-reminder';
    toast.innerHTML = `<div class="toast-reminder-header"><i class="fas fa-bell"></i> 检录提醒</div>
      <div class="toast-reminder-body">
        <p><strong>${eventLabel}</strong></p>
        <p>\u{1f552} 比赛时间：${time}</p>
        <p>\u{1f4cd} 检录地点：${reminder.venue || '请留意公告'}</p>
        ${reminder.note ? '<p class="text-sm text-muted">' + this._escHtml(reminder.note) + '</p>' : ''}
      </div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toast-out .3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 8000);
  },

  _toggleNotificationPanel(force) {
    const panel = document.getElementById('notify-panel');
    const bell = document.getElementById('notify-bell');
    if (!panel || !bell) return;

    const nextOpen = typeof force === 'boolean' ? force : !this.notificationPanelOpen;
    this.notificationPanelOpen = nextOpen;
    panel.classList.toggle('is-open', nextOpen);
    panel.setAttribute('aria-hidden', String(!nextOpen));
    bell.classList.toggle('is-open', nextOpen);
    bell.setAttribute('aria-expanded', String(nextOpen));
    if (nextOpen) this._loadNotifications({ silent: true });
  },

  _updateNotificationBadge(unread) {
    const badge = document.getElementById('notify-badge');
    const bell = document.getElementById('notify-bell');
    if (badge) {
      badge.textContent = unread > 99 ? '99+' : String(unread || 0);
      badge.dataset.count = String(unread || 0);
    }
    if (bell) bell.classList.toggle('has-unread', unread > 0);
  },

  _triggerNotificationBell() {
    const bell = document.getElementById('notify-bell');
    if (!bell) return;
    bell.classList.remove('ring-once');
    void bell.offsetWidth;
    bell.classList.add('ring-once');
  },

  async _loadNotifications(options = {}) {
    if (!this.user) return;
    const silent = options.silent === true;

    try {
      const previousIds = this.notificationItems.map((item) => item.id);
      const res = await API.student.getNotifications({ limit: 50 });
      const list = res.data?.list || [];
      const unread = res.data?.unread || 0;
      const hasNewNotification = this.notificationReady && list.some((item) => !previousIds.includes(item.id));

      this.notificationItems = list;
      this.notificationUnread = unread;
      this.notificationReady = true;
      this._updateNotificationBadge(unread);
      this._renderNotifications();

      if (hasNewNotification && !silent) {
        this._triggerNotificationBell();
      } else if (hasNewNotification) {
        this._triggerNotificationBell();
      }
    } catch (e) {
      if (!silent) this.showToast(e.message || '加载通知失败', 'error');
    }
  },

  _renderNotifications() {
    const list = document.getElementById('notify-panel-list');
    const subtitle = document.getElementById('notify-panel-subtitle');
    const markAll = document.getElementById('notify-mark-all-btn');
    if (!list || !subtitle || !markAll) return;

    subtitle.textContent = this.notificationItems.length
      ? `共 ${this.notificationItems.length} 条，未读 ${this.notificationUnread} 条`
      : '暂无通知';
    markAll.disabled = this.notificationUnread <= 0;
    markAll.style.opacity = this.notificationUnread > 0 ? '1' : '.45';

    if (!this.notificationItems.length) {
      list.innerHTML = '<div class="notify-panel__empty"><i class="fas fa-bell-slash"></i><p>暂无通知</p></div>';
      return;
    }

    list.innerHTML = this.notificationItems.map((item) => {
      const meta = this._getNotificationMeta(item.type);
      const unreadClass = item.is_read ? 'is-read' : 'unread';
      return `
        <div class="notify-item ${unreadClass}" data-id="${item.id}" data-url="${this._escAttr(item.target_url || '')}">
          <button type="button" class="notify-item__action" data-action="delete">删除</button>
          <div class="notify-item__content" data-role="swipe-surface">
            <div class="notify-item__icon"><i class="fas ${meta.icon}"></i></div>
            <div class="notify-item__main">
              <div class="notify-item__top">
                <div class="notify-item__title">${this._escHtml(item.title || '通知')}</div>
                <span class="notify-item__time">${this.formatDate(item.created_at)}</span>
              </div>
              <div class="notify-item__body">${this._escHtml(item.content || '暂无内容')}</div>
              <div class="notify-item__tools">
                ${item.is_read ? '' : '<button type="button" class="notify-item__read" data-action="read">标记已读</button>'}
                ${item.target_url ? '<button type="button" class="notify-item__link" data-action="open">查看</button>' : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.notify-item').forEach((item) => this._bindNotificationSwipe(item));
  },

  _getNotificationMeta(type) {
    const map = {
      success: { icon: 'fa-check-circle' },
      warning: { icon: 'fa-exclamation-triangle' },
      danger: { icon: 'fa-times-circle' },
      info: { icon: 'fa-bell' }
    };
    return map[type] || map.info;
  },

  _bindNotificationSwipe(item) {
    const surface = item.querySelector('[data-role="swipe-surface"]');
    if (!surface) return;

    let startX = 0;
    let deltaX = 0;
    let dragging = false;
    const maxSwipe = 78;

    const setTranslate = (value) => {
      surface.style.transform = `translateX(${value}px)`;
    };

    const handlePointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startX = e.clientX;
      deltaX = item.classList.contains('is-swiped') ? -maxSwipe : 0;
      dragging = true;
      surface.style.transition = 'none';
      this._closeSwipedNotifications(item.dataset.id);
      if (surface.setPointerCapture) surface.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
      if (!dragging) return;
      const offset = Math.max(-maxSwipe, Math.min(0, e.clientX - startX + deltaX));
      setTranslate(offset);
    };

    const handlePointerUp = (e) => {
      if (!dragging) return;
      dragging = false;
      surface.style.transition = '';
      const offset = Math.max(-maxSwipe, Math.min(0, e.clientX - startX + deltaX));
      const open = offset < -36;
      item.classList.toggle('is-swiped', open);
      setTranslate(open ? -maxSwipe : 0);
      if (surface.releasePointerCapture) {
        try { surface.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      }
    };

    surface.onpointerdown = handlePointerDown;
    surface.onpointermove = handlePointerMove;
    surface.onpointerup = handlePointerUp;
    surface.onpointercancel = handlePointerUp;
  },

  _closeSwipedNotifications(exceptId) {
    document.querySelectorAll('.notify-item.is-swiped').forEach((item) => {
      if (exceptId && item.dataset.id === String(exceptId)) return;
      item.classList.remove('is-swiped');
      const surface = item.querySelector('[data-role="swipe-surface"]');
      if (surface) surface.style.transform = 'translateX(0)';
    });
  },

  async _markAllRead() {
    try {
      await API.student.markAllNotificationsRead();
      this.notificationItems = this.notificationItems.map((item) => ({ ...item, is_read: 1 }));
      this.notificationUnread = 0;
      this._updateNotificationBadge(0);
      this._renderNotifications();
      this.showToast('已全部标记为已读', 'success');
    } catch(e) { this.showToast(e.message, 'error'); }
  },

  async _markNotificationRead(id) {
    try {
      await API.student.markNotificationRead(id);
      this.notificationItems = this.notificationItems.map((item) =>
        item.id === id ? { ...item, is_read: 1 } : item
      );
      this.notificationUnread = this.notificationItems.filter((item) => !item.is_read).length;
      this._updateNotificationBadge(this.notificationUnread);
      this._renderNotifications();
    } catch (e) {
      this.showToast(e.message || '标记已读失败', 'error');
    }
  },

  async _deleteNotification(id) {
    try {
      await API.student.deleteNotification(id);
      const item = this.notificationItems.find((entry) => entry.id === id);
      const el = document.querySelector(`.notify-item[data-id="${id}"]`);
      if (el) {
        el.classList.add('is-removing');
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
      this.notificationItems = this.notificationItems.filter((entry) => entry.id !== id);
      if (item && !item.is_read) this.notificationUnread = Math.max(0, this.notificationUnread - 1);
      this._updateNotificationBadge(this.notificationUnread);
      this._renderNotifications();
      this.showToast('通知已删除', 'success');
    } catch (e) {
      this.showToast(e.message || '删除通知失败', 'error');
    }
  },

  async _openNotification(id, targetUrl) {
    const current = this.notificationItems.find((item) => item.id === id);
    if (current && !current.is_read) {
      await this._markNotificationRead(id);
    }
    this._toggleNotificationPanel(false);
    this._closeSwipedNotifications();
    if (targetUrl) {
      window.location.hash = targetUrl.startsWith('#') ? targetUrl : '#' + targetUrl;
    }
  },

  async logout() {
    API.clearToken();
    this.user = null;
    this._resetFriendState();
    this._stopNotificationPolling();
    this._toggleNotificationPanel(false);
    this.updateNav();
    window.location.hash = '#/';
    this.showToast('已退出登录', 'info');
  },

  // ====== 搜索 ======
  bindSearch() {
    const input = document.getElementById('nav-search-input');
    const btn = document.getElementById('nav-search-btn');
    if (!input || !btn) return;

    btn.addEventListener('click', () => this._submitSearch());
    input.addEventListener('focus', () => {
      const value = input.value.trim();
      if (value.length >= 3) this._queueSearchSuggest(value);
      else this._renderSearchSuggest([]);
    });
    input.addEventListener('input', () => {
      const value = input.value.trim();
      if (!value) {
        this._renderSearchSuggest([]);
        return;
      }
      if (value.length >= 3) this._queueSearchSuggest(value);
      else this._renderSearchSuggest([], false);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._submitSearch();
      }
    });
  },

  async _submitSearch(override = {}) {
    const input = document.getElementById('nav-search-input');
    const query = String(override.q ?? input?.value ?? '').trim();
    if (!query) {
      this.showToast('请输入搜索关键词', 'warning');
      return;
    }

    if (input) input.value = query;
    this._saveSearchHistory(query);
    this._hideSearchSuggest();
    this.searchState.query = query;
    this.searchState.type = override.type || this.searchState.type || 'all';
    this.searchState.page = override.page || 1;
    if (override.filters) {
      this.searchState.filters = { ...this.searchState.filters, ...override.filters };
    }

    await this._loadSearchResults();
  },

  async _loadSearchResults() {
    const reqId = ++this.searchLastRequestId;
    const params = {
      q: this.searchState.query,
      type: this.searchState.type,
      page: this.searchState.page,
      limit: this.searchState.limit,
      ...this.searchState.filters
    };

    try {
      this.showLoading();
      const res = await API.public.search(params);
      if (reqId !== this.searchLastRequestId) return;
      if (!res.success) throw new Error(res.error || '搜索失败');

      const data = this._normalizeSearchResponse(res.data || {});
      if (this.user?.role === 'student' && ((data.counts?.users || 0) > 0 || (data.items || []).some(item => item.type === 'users'))) {
        await this.ensureFriendState();
      }
      this.searchState = {
        ...this.searchState,
        query: data.query || this.searchState.query,
        type: data.type || this.searchState.type,
        page: data.page || 1,
        limit: data.limit || this.searchState.limit,
        total: data.total || 0,
        total_pages: data.total_pages || 0,
        counts: data.counts || {},
        items: data.items || [],
        sections: data.sections || {}
      };
      this._showSearchResults(this.searchState, res.meta || {});
    } catch (e) {
      this.showToast(e.message || '搜索失败', 'error');
    } finally {
      this.hideLoading();
    }
  },

  _normalizeSearchResponse(data) {
    const payload = data || {};
    const legacyKeys = ['events', 'students', 'announcements', 'schedules', 'results', 'posts'];
    const isLegacy = !Array.isArray(payload.items) && legacyKeys.some(key => Array.isArray(payload[key]));
    if (!isLegacy) return payload;

    const toLegacyUsers = (payload.students || []).map(item => ({
      id: item.id,
      type: 'users',
      title: item.name || item.username || item.student_id || '未命名用户',
      description: item.class_name ? `班级：${item.class_name}` : '用户搜索结果',
      subtitle: `账号 ${item.student_id || item.username || '-'} · 学生${item.grade ? ' · ' + item.grade : ''}`,
      avatar: item.avatar || '',
      account: item.username || item.student_id || '',
      student_id: item.student_id || '',
      role: 'student',
      role_label: '学生',
      department: [item.grade, item.class_name].filter(Boolean).join(' '),
      events: [],
      href: '',
      sort_time: item.created_at || ''
    }));

    const toLegacyEvents = (payload.events || []).map(item => ({
      id: item.id,
      type: 'events',
      title: item.name || '未命名项目',
      description: `${item.category || '项目'} · ${item.venue || '场地待定'}`,
      subtitle: [item.event_type, item.gender_group].filter(Boolean).join(' · '),
      href: `#/events/${item.id}`,
      sort_time: item.created_at || ''
    }));

    const toLegacySchedules = (payload.schedules || []).map(item => ({
      id: `schedule-${item.id}`,
      type: 'events',
      title: `${item.event_name || '赛程'}${item.round_name ? ' · ' + item.round_name : ''}`,
      description: item.venue || '场地待定',
      subtitle: item.start_time ? this.formatDate(item.start_time) : '时间待定',
      href: '#/events',
      sort_time: item.start_time || ''
    }));

    const toLegacyAnnouncements = (payload.announcements || []).map(item => ({
      id: item.id,
      type: 'announcements',
      title: item.title || '未命名公告',
      description: item.content || (item.category ? `分类：${item.category}` : '公告通知'),
      subtitle: item.publish_time ? this.formatDate(item.publish_time) : '发布时间待定',
      href: `#/announcements/${item.id}`,
      sort_time: item.publish_time || ''
    }));

    const toLegacyResults = (payload.results || []).map(item => ({
      id: item.id,
      type: 'results',
      title: `${item.user_name || '未知选手'} · ${item.event_name || '未知项目'}`,
      description: `成绩 ${item.performance || '-'} · 第 ${item.rank || '-'} 名`,
      subtitle: item.award || '未获奖',
      href: '#/results',
      sort_time: item.created_at || ''
    }));

    const toLegacyPosts = (payload.posts || []).map(item => ({
      id: item.id,
      type: 'news',
      title: item.title || '未命名帖子',
      description: String(item.content || '').replace(/\s+/g, ' ').slice(0, 90),
      subtitle: `${item.author_name || '匿名'} · ${item.reply_count || 0} 回复`,
      href: '#/forum',
      sort_time: item.created_at || ''
    }));

    const sections = {
      users: toLegacyUsers,
      events: [...toLegacyEvents, ...toLegacySchedules],
      news: toLegacyPosts,
      announcements: toLegacyAnnouncements,
      results: toLegacyResults,
      highlights: []
    };
    const counts = Object.fromEntries(Object.entries(sections).map(([key, rows]) => [key, rows.length]));
    const allItems = [
      ...sections.users,
      ...sections.events,
      ...sections.announcements,
      ...sections.results,
      ...sections.news
    ];
    const sourceRows = this.searchState.type === 'all'
      ? allItems
      : (sections[this.searchState.type] || []);

    return {
      query: this.searchState.query,
      type: this.searchState.type,
      page: 1,
      limit: this.searchState.limit,
      total: sourceRows.length,
      total_pages: sourceRows.length ? 1 : 0,
      counts,
      items: sourceRows.slice(0, this.searchState.limit),
      sections: Object.fromEntries(Object.entries(sections).map(([key, rows]) => [key, rows.slice(0, 3)]))
    };
  },

  _showSearchResults(state, meta = {}) {
    const el = document.getElementById('search-results');
    if (!el) return;

    const typeLabels = {
      all: '全部',
      users: '用户',
      events: '项目',
      news: '新闻',
      announcements: '公告',
      results: '成绩',
      highlights: '精彩瞬间'
    };
    const resultCards = (state.items || []).map(item => this._renderSearchItem(item)).join('');
    const history = this._getSearchHistory();
    const filterBar = ['all', 'users', 'events', 'news', 'announcements', 'results', 'highlights']
      .map(type => {
        const count = type === 'all'
          ? Object.values(state.counts || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
          : (state.counts?.[type] || 0);
        return `<button type="button" class="search-tab ${state.type === type ? 'active' : ''}" data-search-type="${type}">
          <span>${typeLabels[type]}</span><em>${count}</em>
        </button>`;
      }).join('');

    const summarySections = state.type === 'all'
      ? Object.entries(state.sections || {}).map(([type, rows]) => {
          if (!rows?.length) return '';
          return `<section class="search-summary-section">
            <div class="search-summary-title">${typeLabels[type]}</div>
            <div class="search-summary-list">${rows.map(item => this._renderSearchCompact(item)).join('')}</div>
          </section>`;
        }).join('')
      : '';

    let html = `
      <div class="search-header">
        <div>
          <h3>搜索结果</h3>
          <small>关键词“${this._escHtml(state.query)}” · ${state.total || 0} 条结果 · ${meta.elapsed_ms || 0}ms</small>
        </div>
        <button class="search-close" type="button" onclick="App.hideSearch()">&times;</button>
      </div>
      <div class="search-query-bar">
        <div class="search-query-bar__input">
          <i class="fas fa-search"></i>
          <input type="text" id="search-query-inline" value="${this._escAttr(state.query)}" placeholder="搜索用户、项目、公告、成绩、精彩瞬间">
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="search-query-inline-btn">重新搜索</button>
      </div>
      <div class="search-toolbar">
        <div class="search-toolbar__filters">${filterBar}</div>
        <div class="search-toolbar__meta">
          <span>${typeLabels[state.type] || '全部'} · 第 ${state.page}/${state.total_pages || 1} 页</span>
        </div>
      </div>
      <div class="search-advanced">
        <input type="text" id="search-filter-department" class="form__input" placeholder="院系/班级" value="${this._escAttr(state.filters.department)}">
        <input type="text" id="search-filter-event" class="form__input" placeholder="参赛项目" value="${this._escAttr(state.filters.participant_event)}">
        <select id="search-filter-category" class="form__input">
          <option value="">全部项目类别</option>
          <option value="track"${state.filters.category === 'track' ? ' selected' : ''}>径赛</option>
          <option value="field"${state.filters.category === 'field' ? ' selected' : ''}>田赛</option>
          <option value="team"${state.filters.category === 'team' ? ' selected' : ''}>趣味项目</option>
          <option value="relay"${state.filters.category === 'relay' ? ' selected' : ''}>接力</option>
        </select>
        <input type="text" id="search-filter-grade" class="form__input" placeholder="参赛年级" value="${this._escAttr(state.filters.grade)}">
        <input type="date" id="search-filter-start" class="form__input" value="${this._escAttr(state.filters.start_date)}">
        <input type="date" id="search-filter-end" class="form__input" value="${this._escAttr(state.filters.end_date)}">
        <button type="button" class="btn btn-primary btn-sm" id="search-apply-filters">筛选</button>
        <button type="button" class="btn btn-outline btn-sm" id="search-reset-filters">重置</button>
      </div>
      <div class="search-history-row">
        <span>历史搜索</span>
        <div class="search-history-list">
          ${history.length ? history.map(item => `<button type="button" class="search-history-chip" data-history-keyword="${this._escAttr(item)}">${this._escHtml(item)}</button>`).join('') : '<small>暂无历史记录</small>'}
        </div>
      </div>
      <div class="search-body">
        ${summarySections}
        ${state.items?.length ? `<div class="search-result-grid">${resultCards}</div>` : '<div class="search-none"><i class="fas fa-search"></i>未查询到相关结果，请调整搜索关键词后重试</div>'}
      </div>
      <div class="search-footer">
        ${this._renderSearchPagination(state)}
      </div>
    `;

    el.innerHTML = html;
    this._bindSearchResultEvents();
    document.getElementById('search-overlay')?.classList.remove('hidden');
  },
  hideSearch() {
    document.getElementById('search-overlay')?.classList.add('hidden');
    this._hideSearchSuggest();
  },

  _renderSearchItem(item) {
    const iconMap = {
      users: 'fa-user',
      events: 'fa-running',
      news: 'fa-newspaper',
      announcements: 'fa-bullhorn',
      results: 'fa-trophy',
      highlights: 'fa-image'
    };
    const imageBlock = item.thumbnail || item.avatar
      ? `<div class="search-card-media"><img src="${this._escAttr(item.thumbnail || item.avatar)}" alt="${this._escAttr(item.title)}"></div>`
      : `<div class="search-card-icon ${this._escAttr(item.type)}"><i class="fas ${iconMap[item.type] || 'fa-search'}"></i></div>`;
    const hrefAttr = item.href ? `data-search-href="${this._escAttr(item.href)}"` : '';
    const friendMeta = item.type === 'users' ? this._getFriendActionMeta(item) : null;
    const actionBlock = friendMeta
      ? `<div class="search-card-actions">
          <button type="button" class="btn btn-sm ${friendMeta.state === 'ready' ? 'btn-primary' : 'btn-outline'}" data-friend-action="${friendMeta.state}" data-user-id="${this._escAttr(item.user_id || item.id)}" ${friendMeta.disabled ? 'disabled' : ''}>
            ${this._escHtml(friendMeta.label)}
          </button>
        </div>`
      : '';
    return `<article class="search-card search-card--detail" ${hrefAttr}>
      ${imageBlock}
      <div class="search-card-body">
        <h4>${this._escHtml(item.title || '')}</h4>
        <small>${this._escHtml(item.subtitle || '')}</small>
        <p>${this._escHtml(item.description || '')}</p>
      </div>
      ${actionBlock}
      <div class="search-card-arrow"><i class="fas fa-angle-right"></i></div>
    </article>`;
  },

  _renderSearchCompact(item) {
    const hrefAttr = item.href ? `data-search-href="${this._escAttr(item.href)}"` : '';
    return `<button type="button" class="search-summary-item" ${hrefAttr}>
      <strong>${this._escHtml(item.title || '')}</strong>
      <small>${this._escHtml(item.subtitle || item.description || '')}</small>
    </button>`;
  },

  _renderSearchPagination(state) {
    if (!state.total_pages || state.total_pages <= 1) {
      return `<small>单页最多 20 条，当前共 ${state.total || 0} 条</small>`;
    }
    return `
      <button type="button" class="btn btn-outline btn-sm" data-search-page="${Math.max(1, state.page - 1)}" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
      <small>第 ${state.page} / ${state.total_pages} 页，共 ${state.total} 条</small>
      <button type="button" class="btn btn-outline btn-sm" data-search-page="${Math.min(state.total_pages, state.page + 1)}" ${state.page >= state.total_pages ? 'disabled' : ''}>下一页</button>
    `;
  },

  _bindSearchResultEvents() {
    document.getElementById('search-query-inline-btn')?.addEventListener('click', () => {
      const nextQuery = document.getElementById('search-query-inline')?.value || '';
      this._submitSearch({ q: nextQuery, page: 1 });
    });

    document.getElementById('search-query-inline')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._submitSearch({ q: e.target.value || '', page: 1 });
      }
    });

    document.querySelectorAll('[data-search-type]').forEach(button => {
      button.addEventListener('click', () => {
        const type = button.getAttribute('data-search-type') || 'all';
        this.searchState.type = type;
        this.searchState.page = 1;
        this._loadSearchResults();
      });
    });

    document.querySelectorAll('[data-search-page]').forEach(button => {
      button.addEventListener('click', () => {
        const nextPage = parseInt(button.getAttribute('data-search-page') || '1', 10);
        this.searchState.page = nextPage > 0 ? nextPage : 1;
        this._loadSearchResults();
      });
    });

    document.querySelectorAll('[data-history-keyword]').forEach(button => {
      button.addEventListener('click', () => {
        const keyword = button.getAttribute('data-history-keyword') || '';
        this._submitSearch({ q: keyword, page: 1 });
      });
    });

    document.querySelectorAll('[data-search-href]').forEach(node => {
      node.addEventListener('click', () => {
        const href = node.getAttribute('data-search-href');
        if (!href) return;
        this.hideSearch();
        if (/^#\//.test(href)) {
          window.location.hash = href;
          return;
        }
        window.open(href, '_blank', 'noopener');
      });
    });

    document.querySelectorAll('[data-friend-action="ready"]').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetUserId = Number(button.getAttribute('data-user-id') || 0);
        const targetUser = (this.searchState.items || []).find(item => Number(item.user_id || item.id) === targetUserId);
        if (!targetUser) return;
        this.showFriendRequestModal(targetUser);
      });
    });

    document.getElementById('search-apply-filters')?.addEventListener('click', () => {
      this.searchState.filters = {
        ...this.searchState.filters,
        category: document.getElementById('search-filter-category')?.value || '',
        grade: document.getElementById('search-filter-grade')?.value.trim() || '',
        start_date: document.getElementById('search-filter-start')?.value || '',
        end_date: document.getElementById('search-filter-end')?.value || '',
        department: document.getElementById('search-filter-department')?.value.trim() || '',
        participant_event: document.getElementById('search-filter-event')?.value.trim() || ''
      };
      this.searchState.page = 1;
      this._loadSearchResults();
    });

    document.getElementById('search-reset-filters')?.addEventListener('click', () => {
      this.searchState.filters = {
        category: '',
        grade: '',
        start_date: '',
        end_date: '',
        department: '',
        participant_event: ''
      };
      this.searchState.page = 1;
      this._loadSearchResults();
    });
  },

  _queueSearchSuggest(query) {
    clearTimeout(this.searchSuggestTimer);
    this.searchSuggestTimer = setTimeout(() => this._loadSearchSuggest(query), 180);
  },

  async _loadSearchSuggest(query) {
    const keyword = String(query || '').trim();
    if (keyword.length < 3) {
      this._renderSearchSuggest([]);
      return;
    }
    try {
      const res = await API.public.searchSuggest(keyword);
      if (!res.success) return;
      const input = document.getElementById('nav-search-input');
      if (input && input.value.trim() !== keyword) return;
      this._renderSearchSuggest(res.data || [], true);
    } catch (_) {
      this._renderSearchSuggest([]);
    }
  },

  _renderSearchSuggest(items = [], allowHistory = true) {
    const container = document.getElementById('nav-search-suggest');
    const input = document.getElementById('nav-search-input');
    if (!container || !input) return;

    const keyword = input.value.trim();
    const history = allowHistory && keyword.length < 3 ? this._getSearchHistory().slice(0, 6) : [];
    const rows = items.length
      ? items.map(item => `
          <button type="button" class="search-suggest__item" data-suggest-keyword="${this._escAttr(item.title)}">
            <strong>${this._escHtml(item.title)}</strong>
            <small>${this._escHtml(item.subtitle || item.type || '')}</small>
          </button>
        `).join('')
      : history.map(item => `
          <button type="button" class="search-suggest__item" data-suggest-keyword="${this._escAttr(item)}">
            <strong>${this._escHtml(item)}</strong>
            <small>历史记录</small>
          </button>
        `).join('');

    if (!rows) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    container.innerHTML = rows;
    container.classList.remove('hidden');
    container.querySelectorAll('[data-suggest-keyword]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextKeyword = button.getAttribute('data-suggest-keyword') || '';
        input.value = nextKeyword;
        this._submitSearch({ q: nextKeyword, page: 1 });
      });
    });
  },

  _hideSearchSuggest() {
    const container = document.getElementById('nav-search-suggest');
    if (!container) return;
    container.classList.add('hidden');
    container.innerHTML = '';
  },

  _getSearchHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.searchHistoryKey) || '[]');
      return Array.isArray(raw) ? raw.filter(Boolean).slice(0, 10) : [];
    } catch (_) {
      return [];
    }
  },

  _saveSearchHistory(keyword) {
    const value = String(keyword || '').trim();
    if (!value) return;
    const history = this._getSearchHistory().filter(item => item !== value);
    history.unshift(value);
    localStorage.setItem(this.searchHistoryKey, JSON.stringify(history.slice(0, 10)));
  },

  // ====== Toast ======
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toast-out .3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // ====== 加载 ======
  showLoading() { document.getElementById('loading-overlay')?.classList.remove('hidden'); },
  hideLoading() { document.getElementById('loading-overlay')?.classList.add('hidden'); },

  // ====== 模态框 ======
  showModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (!overlay || !content) return;
    this._modalBeforeClose = null;
    content.innerHTML = html;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // 防止背景滚动
  },
  hideModal(forceClose = false) {
    if (!forceClose && typeof this._modalBeforeClose === 'function') {
      const allowClose = this._modalBeforeClose();
      if (allowClose === false) return;
    }
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
    this._modalBeforeClose = null;
  },
  confirmDialog(message) {
    return new Promise((resolve) => {
      this.showModal(`
        <div class="confirm-dialog">
          <p>${message}</p>
          <div class="confirm-actions">
            <button type="button" class="btn btn-secondary" id="confirm-cancel">取消</button>
            <button type="button" class="btn btn-primary" id="confirm-ok">确认</button>
          </div>
        </div>
      `);
      document.getElementById('confirm-cancel').onclick = () => { this.hideModal(true); resolve(false); };
      document.getElementById('confirm-ok').onclick = () => { this.hideModal(true); resolve(true); };
    });
  },

  // ====== 首页 ======
  async renderHome() {
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    try {
      let [meet, stats, ann, results, events] = await Promise.allSettled([
        API.get('/public/meet-info'),
        API.get('/public/stats/overview'),
        API.get('/public/announcements?limit=3'),
        API.get('/public/results'),
        API.get('/public/events')
      ]);

      const m = meet.value?.data || {};
      this._updateSchoolLogo(m.logo_url || '/images/school-emblem-default.svg');
      document.getElementById('hero-title').textContent = m.name || '学校运动会';
      var sub = document.getElementById('hero-subtitle');
      if (sub) sub.textContent = m.theme || '';
      var dateEl = document.getElementById('hero-date');
      if (dateEl) dateEl.textContent = '比赛时间：2026年10月22日 至 10月24日';

      // ── 数据看板 ──
      const s = stats.value?.data || {};
      document.getElementById('stat-events').textContent = s.total_events || 0;
      document.getElementById('stat-regs').textContent = s.total_registrations || 0;
      document.getElementById('stat-done').textContent = s.completed_schedules || 0;
      document.getElementById('stat-awards').textContent = s.awarded_count || 0;

      // ── 赛事项目总览：横向4卡片 ──
      const homeEv = document.getElementById('home-events');
      const genderL = g => g === 'male' ? '男子' : g === 'female' ? '女子' : '混合';
      const typeL = t => t === 'team' ? '集体' : '个人';
      const eventList = (events.value?.data || []);
      if (eventList.length) {
        let evH = '<div class="events-horiz-row">';
        eventList.slice(0, 4).forEach(e => {
          const iconMap = {track:'fa-person-running',field:'fa-arrow-up-right-dots',relay:'fa-people-arrows',team:'fa-people-group'};
          const icon = iconMap[e.category] || 'fa-running';
          evH += `<a href="#/events/${e.id}" class="event-horiz-card">
            <div class="event-horiz-icon"><i class="fas ${icon}"></i></div>
            <h4>${e.name}</h4>
            <div class="event-horiz-tags">
              <span class="badge badge-info">${genderL(e.gender_group)}</span>
              <span class="badge badge-success">${typeL(e.event_type)}</span>
            </div>
            <small class="text-muted"><i class="fas fa-location-dot"></i> ${e.venue || '待定'}</small>
          </a>`;
        });
        evH += '</div>';
        homeEv.innerHTML = evH;
      } else {
        homeEv.innerHTML = '<p class="text-muted text-center" style="padding:2rem">暂无更多信息</p>';
      }

      // ── 最新公告：3卡片，置頂優先 ──
      const annData = ann.value?.data || [];
      let annH = '';
      if (annData.length) {
        const catL = {event:'赛事通知',registration:'报名截止',result:'成绩公示',urgent:'紧急通知',general:'一般'};
        const sorted = [...annData].sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return 0;
        });
        annH = '<div class="home-ann-cards">';
        sorted.slice(0, 3).forEach(a => {
          annH += `<a href="#/announcements/${a.id}" class="home-ann-card ${a.is_pinned ? 'pinned' : ''}">
            <div class="home-ann-card-top">
              <span class="badge badge-${a.category || 'general'}">${catL[a.category] || a.category}</span>
              ${a.is_pinned ? '<span class="badge badge-pin">置顶</span>' : ''}
            </div>
            <h4>${a.title}</h4>
            <span class="home-ann-card-time"><i class="far fa-clock"></i> ${this.formatDate(a.publish_time)}</span>
          </a>`;
        });
        annH += '</div>';
        document.getElementById('home-announcements').innerHTML = annH;
      } else {
        document.getElementById('home-announcements').innerHTML = '<p class="text-muted text-center" style="padding:2rem">暂无更多信息</p>';
      }

      // ── 最新成绩：A~E组第一名 ──
      const resData = results.value?.data || [];
      let resH = '';
      if (resData.length) {
        const groups = ['A','B','C','D','E'];
        const groupChamps = {};
        resData.forEach(r => {
          const g = r.user_sport_group || 'A';
          if (r.rank === 1 && !groupChamps[g]) groupChamps[g] = r;
        });
        const champs = groups.map(g => groupChamps[g] || null).filter(Boolean);
        if (champs.length) {
          resH = '<div class="home-result-champs">';
          champs.forEach(r => {
            resH += `<a href="#/results" class="home-result-card">
              <div class="home-result-group">${r.user_sport_group || 'A'}组</div>
              <div class="home-result-medal">🥇</div>
              <div class="home-result-name">${r.name || '-'}</div>
              <div class="home-result-event">${r.event_name || '-'}</div>
              <div class="home-result-perf">${r.performance || '-'}</div>
            </a>`;
          });
          resH += '</div>';
        } else {
          resH = '<p class="text-muted text-center" style="padding:2rem">暂无更多信息</p>';
        }
        document.getElementById('home-results').innerHTML = resH;
      } else {
        document.getElementById('home-results').innerHTML = '<p class="text-muted text-center" style="padding:2rem">暂无更多信息</p>';
      }
    } catch (e) {
      console.error('renderHome error:', e);
      this.showToast('首页加载异常，请刷新重试', 'error');
    }
  },

  _updateSchoolLogo(src) {
    const media = document.getElementById('nav-logo-media');
    const image = document.getElementById('nav-logo-image');
    const fallback = document.getElementById('nav-logo-fallback');
    if (!media || !image || !fallback) return;
    const finalSrc = String(src || '/images/school-emblem-default.svg').trim() || '/images/school-emblem-default.svg';
    media.classList.add('is-loading');
    fallback.classList.add('hidden');
    image.classList.add('hidden');
    image.onload = () => {
      media.classList.remove('is-loading');
      image.classList.remove('hidden');
      fallback.classList.add('hidden');
    };
    image.onerror = () => {
      media.classList.remove('is-loading');
      image.classList.add('hidden');
      fallback.classList.remove('hidden');
    };
    if (image.getAttribute('src') !== finalSrc) image.setAttribute('src', finalSrc);
    else if (image.complete && image.naturalWidth > 0) image.onload();
  },

  _escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  },

  startCountdown(targetDate) {
    // 确保使用10月22日早上8点
    var d = targetDate && targetDate !== '—' ? targetDate : '2026-10-22';
    if (!d.includes('T')) d += 'T08:00:00';
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    var self = this;
    var countdownTarget = d;
    var update = function() {
      var diff = new Date(countdownTarget) - new Date();
      var daysEl = document.getElementById('cd-days');
      var hoursEl = document.getElementById('cd-hours');
      var minsEl = document.getElementById('cd-mins');
      var secsEl = document.getElementById('cd-secs');
      if (!daysEl || !hoursEl || !minsEl || !secsEl) {
        self.countdownTimer && clearInterval(self.countdownTimer);
        return;
      }
      if (diff <= 0) {
        daysEl.textContent = '0'; hoursEl.textContent = '0';
        minsEl.textContent = '0'; secsEl.textContent = '0';
        clearInterval(self.countdownTimer);
        return;
      }
      daysEl.textContent = Math.floor(diff / 86400000);
      hoursEl.textContent = Math.floor((diff % 86400000) / 3600000);
      minsEl.textContent = Math.floor((diff % 3600000) / 60000);
      secsEl.textContent = Math.floor((diff % 60000) / 1000);
    };
    update();
    this.countdownTimer = setInterval(update, 1000);
  },

  // ====== 赛事 ======
  async renderEvents() {
    const filter = document.getElementById('events-filter');
    const list = document.getElementById('events-list');
    filter.innerHTML = `<select id="ev-cat" class="form-select"><option value="">全部类型</option><option value="track">径赛</option><option value="field">田赛</option><option value="relay">接力</option><option value="team">集体</option></select><select id="ev-gender" class="form-select"><option value="">全部组别</option><option value="male">男子</option><option value="female">女子</option><option value="mixed">混合</option></select>`;
    const load = async () => {
      const cat = document.getElementById('ev-cat')?.value || '';
      const gen = document.getElementById('ev-gender')?.value || '';
      let url = '/public/events?';
      if (cat) url += `category=${cat}&`;
      if (gen) url += `gender_group=${gen}&`;
      try {
        this.showLoading();
        const res = await API.get(url);
        const data = res.data || [];
        const genderL = g => g==='male'?'男子组':g==='female'?'女子组':'混合组';
        const typeL = t => t==='team'?'集体':'个人';
        const catL = c => ({track:'径赛',field:'田赛',relay:'接力',team:'集体'})[c]||c;
        list.innerHTML = data.length ? data.map(e => `
          <div class="card event-card">
            <div class="card-header">
              <h3>${e.name}</h3>
              <span class="badge badge-info">${typeL(e.event_type)}</span>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
                <p class="text-sm"><i class="fas fa-venus-mars" style="color:var(--red);width:20px"></i> ${genderL(e.gender_group)}</p>
                <p class="text-sm"><i class="fas fa-tag" style="color:var(--red);width:20px"></i> ${catL(e.category)}</p>
                <p class="text-sm"><i class="fas fa-location-dot" style="color:var(--red);width:20px"></i> ${e.venue||'待定'}</p>
                <p class="text-sm"><i class="fas fa-users" style="color:var(--red);width:20px"></i> 上限 ${e.max_participants||'不限'}</p>
              </div>
              ${e.rules?`<div class="mt-2 p-2" style="background:var(--bg);border-radius:4px;font-size:0.8rem;color:var(--text2)">${e.rules}</div>`:''}
            </div>
            <div class="card-footer">
              <span></span>
              <a href="#/events/${e.id}" class="btn btn-outline btn-sm">查看详情</a>
            </div>
          </div>`).join('') : '<div class="empty-state" style="grid-column:1/-1"><p class="text-muted">暂无符合条件的赛事</p></div>';
      } catch (e) { }
      finally { this.hideLoading(); }
    };
    load();
    document.getElementById('ev-cat')?.addEventListener('change', load);
    document.getElementById('ev-gender')?.addEventListener('change', load);
  },

  _showEventDetail(id) {
    window.location.hash = `#/events/${id}`;
  },

  async renderEventDetailPage(id) {
    const root = document.getElementById('event-detail-root');
    if (!root) return;
    root.innerHTML = '<div class="text-center p-8"><div class="spinner"></div><p class="text-muted mt-2">载入中…</p></div>';

    try {
      const res = await API.public.getEvent(id);
      const e = res.data;
      if (!res.success || !e) {
        root.innerHTML = `<div class="empty-state"><p>项目不存在</p><a href="#/events" class="btn btn-outline mt-2">返回列表</a></div>`;
        return;
      }

      const genderL = g => (g === 'male' ? '男子组' : g === 'female' ? '女子组' : '混合组');
      const catL = c => ({ track: '徑赛', field: '田赛', relay: '接力', team: '集体' }[c] || c);
      const typeL = t => (t === 'team' ? '集体项目' : '个人项目');
      const isStudent = this.user && this.user.role === 'student';
      const name = this._escHtml(e.name || '');
      const desc = this._escHtml(e.description || e.rules || '暂无详細說明');
      const rules = this._escHtml(e.rules || '');

      let scheduleHtml = '';
      if (e.schedules?.length) {
        scheduleHtml = `<div class="card mt-3"><div class="card-header"><h3>赛程安排</h3></div><div class="card-body"><div class="table-container"><table class="table"><thead><tr><th>轮次</th><th>时间</th><th>场地</th></tr></thead><tbody>${e.schedules.map(s => `<tr><td>${this._escHtml(s.round_name)}</td><td>${this.formatDate(s.start_time)}</td><td>${this._escHtml(s.venue || e.venue || '待定')}</td></tr>`).join('')}</tbody></table></div></div></div>`;
      }

      let actionHtml = '';
      if (isStudent) {
        actionHtml = `<button type="button" class="btn btn-primary" id="event-detail-register">提交报名</button>`;
      } else if (!this.user) {
        actionHtml = `<a href="#/login" class="btn btn-primary">登录後报名</a>`;
      } else if (this.user.role === 'admin') {
        actionHtml = `<span class="text-muted text-sm">管理员账号请使用学生账号报名</span>`;
      }

      root.innerHTML = `
        <nav class="breadcrumb"><a href="#/events">赛事项目</a> <span>/</span> <span>${name}</span></nav>
        <div class="detail-page-header">
          <div>
            <h1>${name}</h1>
            <div class="detail-tags">
              <span class="badge badge-info">${typeL(e.event_type)}</span>
              <span class="badge badge-success">${catL(e.category)}</span>
              <span class="badge badge-general">${genderL(e.gender_group)}</span>
            </div>
          </div>
          <div class="detail-actions">${actionHtml}</div>
        </div>
        <div class="detail-stats-row">
          <div class="detail-stat"><span class="label">比赛场地</span><span class="value">${this._escHtml(e.venue || '待定')}</span></div>
          <div class="detail-stat"><span class="label">人数上限</span><span class="value">${e.max_participants || '不限'}</span></div>
          <div class="detail-stat"><span class="label">已报名</span><span class="value">${e.registration_count ?? 0} 人</span></div>
          <div class="detail-stat"><span class="label">已通过</span><span class="value">${e.approved_count ?? 0} 人</span></div>
        </div>
        <div class="card mt-3">
          <div class="card-header"><h3>项目详情</h3></div>
          <div class="card-body detail-prose">${desc.replace(/\n/g, '<br>')}</div>
        </div>
        ${rules ? `<div class="card mt-3"><div class="card-header"><h3>比赛规则</h3></div><div class="card-body detail-prose">${rules.replace(/\n/g, '<br>')}</div></div>` : ''}
        ${scheduleHtml}
        <p class="mt-3"><a href="#/events" class="btn btn-outline btn-sm"><i class="fas fa-arrow-left"></i> 返回项目列表</a></p>
      `;

      document.getElementById('event-detail-register')?.addEventListener('click', () => {
        if (typeof Student !== 'undefined') Student._doRegister(parseInt(id, 10), e.name);
      });
    } catch (err) {
      root.innerHTML = `<div class="empty-state"><p>载入失败：${this._escHtml(err.message)}</p><a href="#/events" class="btn btn-outline mt-2">返回</a></div>`;
    }
  },

  _escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  },

  // ====== 成绩 ======
  async renderResults() {
    var table = document.getElementById('results-table');
    if (!table) return;
    table.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      this.showLoading();
      var res = await API.get('/public/results');
      var data = res.data || [];
      this.hideLoading();
      if (!data.length) { table.innerHTML = '<div class="results-empty"><i class="fas fa-inbox"></i>暂无成绩数据</div>'; return; }

      // 统计各组人数
      var grpCount = {};
      data.forEach(function(r){ var sg=(r.user_sport_group||'A'); grpCount[sg]=(grpCount[sg]||0)+1; });
      var activeGroups = ['A','B','C','D','E'].filter(function(sg){ return !!grpCount[sg]; });
      var eventCount = new Set(data.map(function(r){ return r.event_name || ''; }).filter(Boolean)).size;

      var html = '<div class="results-shell">';
      html += '<section class="results-hero card">';
      html += '<div class="results-hero__top">';
      html += '<div class="results-hero__intro"><div class="section-title">成绩公示<small>按组别逐层查看完整成绩与排名</small></div>';
      html += '<p>先选择运动组别，再进入男女组与具体项目查看完整排名，页面信息会按层级逐步展开，浏览更清晰。</p>';
      html += '<div class="results-hero__tips"><span class="badge badge-pin">先看组别</span><span class="badge badge-info">再看男女组</span><span class="badge badge-primary">最后看项目排名</span></div></div>';
      html += '</div>';
      html += '<div class="results-summary">';
      html += '<div class="results-summary-card"><strong>'+data.length+'</strong><span>已公示成绩</span></div>';
      html += '<div class="results-summary-card"><strong>'+activeGroups.length+'</strong><span>开放组别</span></div>';
      html += '<div class="results-summary-card"><strong>'+eventCount+'</strong><span>覆盖项目</span></div>';
      html += '<div class="results-summary-card"><strong>'+data.filter(function(r){ return (r.award||'').trim(); }).length+'</strong><span>获奖记录</span></div>';
      html += '</div></section>';
      html += '<section class="results-section">';
      html += '<div class="results-section__head"><h3>选择运动组别</h3><p>所有内容均匀分布展示，点击卡片进入下一层级。</p></div>';
      html += '<div class="results-nav-grid">';
      activeGroups.forEach(function(sg) {
        var cnt = grpCount[sg] || 0;
        html += '<a href="#/results/group/'+sg+'" class="results-nav-card">';
        html += '<div class="results-nav-card__icon"><i class="fas fa-layer-group"></i></div>';
        html += '<div class="results-nav-card__title"><strong>'+sg+'</strong>组</div>';
        html += '<div class="results-nav-card__desc">查看 '+sg+' 组全部成绩、男女分组和项目排名。</div>';
        html += '<div class="results-nav-card__meta"><span>'+cnt+' 条成绩</span><span>进入查看 <i class="fas fa-angle-right"></i></span></div></a>';
      });
      html += '</div></section></div>';
      table.innerHTML = html;
    } catch(e) { table.innerHTML = '<div class="results-empty"><i class="fas fa-circle-exclamation"></i>加载失败，请稍后重试</div>'; }
  },

  // 组详情 → 选择男女
  async _renderGroupDetail(sg) {
    var table = document.getElementById('results-table');
    if (!table) return;
    table.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      var res = await API.get('/public/results');
      var data = (res.data||[]).filter(function(r){return (r.user_sport_group||'A')===sg});
      if (!data.length) { table.innerHTML = '<div class="results-empty"><i class="fas fa-inbox"></i>该组暂无成绩</div>'; return; }
      var maleCount=data.filter(function(r){return (r.user_gender||'male')==='male'}).length;
      var femaleCount=data.length - maleCount;
      var awardCount = data.filter(function(r){ return (r.award||'').trim(); }).length;

      var html = '<div class="results-shell">';
      html += '<section class="results-hero card">';
      html += '<div class="results-breadcrumb"><a href="#/results">成绩公示</a><span>/</span><span>'+sg+'组</span></div>';
      html += '<div class="results-hero__intro"><div class="section-title">'+sg+'组<small>选择男子组或女子组继续查看</small></div>';
      html += '<p>当前分组内的成绩记录已按性别拆分展示，方便快速进入对应项目的完整排名表。</p></div>';
      html += '<div class="results-summary">';
      html += '<div class="results-summary-card"><strong>'+data.length+'</strong><span>本组成绩</span></div>';
      html += '<div class="results-summary-card"><strong>'+maleCount+'</strong><span>男子组成绩</span></div>';
      html += '<div class="results-summary-card"><strong>'+femaleCount+'</strong><span>女子组成绩</span></div>';
      html += '<div class="results-summary-card"><strong>'+awardCount+'</strong><span>获奖记录</span></div>';
      html += '</div></section>';
      html += '<section class="results-section"><div class="results-section__head"><h3>选择性别组别</h3><p>点击进入对应项目列表。</p></div><div class="results-nav-grid">';
      if(maleCount) html += '<a href="#/results/group/'+sg+'/male" class="results-nav-card results-nav-card--male"><div class="results-nav-card__icon"><i class="fas fa-male"></i></div><div class="results-nav-card__title">男子组</div><div class="results-nav-card__desc">查看 '+sg+' 组男子项目排名与成绩详情。</div><div class="results-nav-card__meta"><span>'+maleCount+' 条成绩</span><span>进入查看 <i class="fas fa-angle-right"></i></span></div></a>';
      if(femaleCount) html += '<a href="#/results/group/'+sg+'/female" class="results-nav-card results-nav-card--female"><div class="results-nav-card__icon"><i class="fas fa-female"></i></div><div class="results-nav-card__title">女子组</div><div class="results-nav-card__desc">查看 '+sg+' 组女子项目排名与成绩详情。</div><div class="results-nav-card__meta"><span>'+femaleCount+' 条成绩</span><span>进入查看 <i class="fas fa-angle-right"></i></span></div></a>';
      html += '</div></section></div>';
      table.innerHTML = html;
    } catch(e) { table.innerHTML = '<div class="results-empty"><i class="fas fa-circle-exclamation"></i>加载失败，请稍后重试</div>'; }
  },

  // 性别详情 → 选择项目
  async _renderGenderDetail(sg, g) {
    var table = document.getElementById('results-table');
    if (!table) return;
    table.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      var res = await API.get('/public/results');
      var data = (res.data||[]).filter(function(r){return (r.user_sport_group||'A')===sg && (r.user_gender||'male')===g});
      if (!data.length) { table.innerHTML = '<div class="results-empty"><i class="fas fa-inbox"></i>暂无成绩</div>'; return; }

      var evtGrp = {};
      data.forEach(function(r){var en=r.event_name||'其他';evtGrp[en]=(evtGrp[en]||0)+1});
      var gLabel = g==='male'?'男子组':'女子组';
      var eventNames = Object.keys(evtGrp).sort();

      var html = '<div class="results-shell">';
      html += '<section class="results-hero card">';
      html += '<div class="results-breadcrumb"><a href="#/results">成绩公示</a><span>/</span><a href="#/results/group/'+sg+'">'+sg+'组</a><span>/</span><span>'+gLabel+'</span></div>';
      html += '<div class="results-hero__intro"><div class="section-title">'+sg+'组 '+gLabel+'<small>按项目查看完整名次</small></div>';
      html += '<p>从项目卡片进入后可查看该项目的完整成绩排名表与奖项分布。</p></div>';
      html += '<div class="results-summary">';
      html += '<div class="results-summary-card"><strong>'+data.length+'</strong><span>当前成绩</span></div>';
      html += '<div class="results-summary-card"><strong>'+eventNames.length+'</strong><span>项目数量</span></div>';
      html += '<div class="results-summary-card"><strong>'+data.filter(function(r){ return Number(r.rank||0) && Number(r.rank||0) <= 3; }).length+'</strong><span>前三名次数</span></div>';
      html += '<div class="results-summary-card"><strong>'+data.filter(function(r){ return (r.award||'').trim(); }).length+'</strong><span>获奖记录</span></div>';
      html += '</div></section>';
      html += '<section class="results-section"><div class="results-section__head"><h3>选择项目</h3><p>按项目进入查看详细排名。</p></div><div class="results-nav-grid">';
      eventNames.forEach(function(en){
        var cnt = evtGrp[en];
        var safe = encodeURIComponent(en);
        html += '<a href="#/results/group/'+sg+'/'+g+'/'+safe+'" class="results-nav-card results-nav-card--event"><div class="results-nav-card__icon"><i class="fas fa-trophy"></i></div><div class="results-nav-card__title">'+App._escHtml(en)+'</div><div class="results-nav-card__desc">查看该项目的完整成绩、公示名次与奖项情况。</div><div class="results-nav-card__meta"><span>'+cnt+' 人参赛</span><span>进入查看 <i class="fas fa-angle-right"></i></span></div></a>';
      });
      html += '</div></section></div>';
      table.innerHTML = html;
    } catch(e) { table.innerHTML = '<div class="results-empty"><i class="fas fa-circle-exclamation"></i>加载失败，请稍后重试</div>'; }
  },

  // 项目完整排名表
  async _renderEventRanking(sg, g, en) {
    var table = document.getElementById('results-table');
    if (!table) return;
    table.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      var res = await API.get('/public/results');
      var data = (res.data||[]).filter(function(r){return (r.user_sport_group||'A')===sg && (r.user_gender||'male')===g && r.event_name===en});
      if (!data.length) { table.innerHTML = '<div class="results-empty"><i class="fas fa-inbox"></i>暂无排名</div>'; return; }

      var medals = {1:'🥇',2:'🥈',3:'🥉'};
      var results = data.sort(function(a,b){return (a.rank||99)-(b.rank||99)});
      var gLabel = g==='male'?'男子组':'女子组';
      var awardCount = results.filter(function(r){ return (r.award||'').trim(); }).length;

      var html = '<div class="results-shell">';
      html += '<section class="results-hero card">';
      html += '<div class="results-breadcrumb"><a href="#/results">成绩公示</a><span>/</span><a href="#/results/group/'+sg+'">'+sg+'组</a><span>/</span><a href="#/results/group/'+sg+'/'+g+'">'+gLabel+'</a><span>/</span><span>'+this._escHtml(en)+'</span></div>';
      html += '<div class="results-ranking-head"><div><div class="section-title">'+this._escHtml(en)+'<small>'+sg+'组 · '+gLabel+' 完整排名</small></div><p>按名次顺序展示该项目全部已公示成绩，奖项和前三名会在表格中高亮显示。</p></div></div>';
      html += '<div class="results-summary">';
      html += '<div class="results-summary-card"><strong>'+results.length+'</strong><span>参赛人数</span></div>';
      html += '<div class="results-summary-card"><strong>'+awardCount+'</strong><span>获奖人数</span></div>';
      html += '<div class="results-summary-card"><strong>'+results.filter(function(r){ return Number(r.rank||0) === 1; }).length+'</strong><span>冠军人数</span></div>';
      html += '<div class="results-summary-card"><strong>'+results.filter(function(r){ return Number(r.rank||0) <= 3; }).length+'</strong><span>领奖台人数</span></div>';
      html += '</div></section>';
      html += '<section class="card results-table-wrap"><div class="card-header"><h3>项目排名表</h3><span class="text-sm text-muted">按名次从高到低排列</span></div><div class="table-container"><table class="table"><thead><tr><th>排名</th><th>姓名</th><th>班级</th><th>成绩</th><th>奖项</th></tr></thead><tbody>';
      results.forEach(function(r){html += '<tr class="'+(r.rank<=3?'award-row':'')+'"><td>'+(medals[r.rank]||r.rank||'-')+'</td><td>'+(r.name||'-')+'</td><td>'+(r.class_name||'-')+'</td><td>'+(r.performance||'-')+'</td><td><span class="badge badge-success">'+(r.award||'-')+'</span></td></tr>'});
      html += '</tbody></table></div></section></div>';
      table.innerHTML = html;
    } catch(e) { table.innerHTML = '<div class="results-empty"><i class="fas fa-circle-exclamation"></i>加载失败，请稍后重试</div>'; }
  },

  async exportResults() {
    try {
      this.showLoading();
      const res = await API.get('/public/results');
      const data = res.data || [];
      const wsData = [['排名','项目','姓名','班级','成绩','奖项']];
      data.forEach(r => wsData.push([r.rank||'', r.event_name||'', r.name||'', r.class_name||'', r.performance||'', r.award||'']));
      if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '成绩表');
        XLSX.writeFile(wb, '运动会成绩表.xlsx');
        this.showToast('导出成功', 'success');
      } else { this.showToast('导出库未加载，请检查网络', 'error'); }
    } catch (e) { this.showToast('导出失败: '+e.message, 'error'); }
    finally { this.hideLoading(); }
  },

  // ====== 公告 ======
  async renderAnnouncements() {
    const filter = document.getElementById('announcements-filter');
    const list = document.getElementById('announcements-list');
    const detailRoot = document.getElementById('announcement-detail-root');
    if (detailRoot) detailRoot.innerHTML = '';
    filter.innerHTML = `<select id="ann-cat" class="form-select"><option value="">全部分类</option><option value="event">赛事通知</option><option value="registration">报名截止</option><option value="result">成绩公示</option><option value="urgent">紧急通知</option><option value="general">一般公告</option></select>`;
    const load = async () => {
      const cat = document.getElementById('ann-cat')?.value || '';
      let url = '/public/announcements?';
      if (cat) url += `category=${cat}&`;
      try {
        this.showLoading();
        const res = await API.get(url);
        const data = res.data || [];
        const catL = {event:'赛事通知',registration:'报名截止',result:'成绩公示',urgent:'紧急通知',general:'一般'};
        list.innerHTML = data.length ? data.map(a => `
          <div class="announcement-card card ${a.is_pinned?'pinned':''}">
            <div class="card-header"><h3>${a.is_pinned?'📌 ':''}${a.title}</h3><span class="badge badge-${a.category||'general'}">${catL[a.category]||a.category}</span></div>
            <div class="card-body"><p class="announcement-preview">${a.content || ''}</p></div>
            <div class="card-footer"><span class="text-sm text-muted">${this.formatDate(a.publish_time)} · ${a.view_count||0}阅读</span><a href="#/announcements/${a.id}" class="btn btn-outline btn-sm">查看详情</a></div>
          </div>`).join('') : '<p class="text-muted p-8 text-center">暂无公告</p>';
      } catch (e) { }
      finally { this.hideLoading(); }
    };
    load();
    document.getElementById('ann-cat')?.addEventListener('change', load);
  },

  async showAnnouncementDetail(id) {
    const root = document.getElementById('announcement-detail-root');
    if (!root) return;
    try {
      this.showLoading();
      var res = await API.get('/public/announcements/' + id);
      var a = res.data;
      this.hideLoading();
      if (!a) { root.innerHTML = '<p class="text-muted text-center" style="padding:3rem">公告不存在</p>'; return; }
      var catL = {event:'赛事通知',registration:'报名截止',result:'成绩公示',urgent:'紧急通知',general:'一般'};
      root.innerHTML =
        '<a href="#/announcements" class="btn-text" style="margin-bottom:1rem;display:inline-block"><i class="fas fa-arrow-left"></i> 返回公告列表</a>' +
        '<div class="card">' +
          '<div class="card-header">' +
            '<h2>' + (a.is_pinned ? '📌 ' : '') + (a.title || '') + '</h2>' +
            '<div style="margin-top:.5rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">' +
              '<span class="badge badge-' + (a.category || 'general') + '">' + (catL[a.category] || a.category || '一般') + '</span>' +
              '<span class="text-sm text-muted"><i class="far fa-clock"></i> ' + this.formatDate(a.publish_time) + '</span>' +
              '<span class="text-sm text-muted"><i class="far fa-eye"></i> ' + (a.view_count || 0) + ' 阅读</span>' +
              (a.publisher_name ? '<span class="text-sm text-muted"><i class="far fa-user"></i> ' + a.publisher_name + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="card-body">' +
            '<div class="detail-content">' + (a.content || '暂无内容').replace(/\n/g, '<br>') + '</div>' +
          '</div>' +
        '</div>';
      window.scrollTo(0, 0);
    } catch (e) {
      this.hideLoading();
      root.innerHTML = '<p class="text-muted text-center" style="padding:3rem">加载失败</p>';
    }
  },

  // ====== 工具 ======
  formatDate(d) {
    if (!d) return '-';
    try { const t=new Date(d);return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`; }
    catch(e) { return d; }
  },
  getAwardLabel(a) {
    const m={'一等':'一等奖','二等':'二等奖','三等':'三等奖','优秀':'优秀奖','团体':'团体奖'};
    return m[a] || a || '-';
  },

  async _getMyRegIds() {
    try { const r = await API.student.getMyRegistrations(); return new Set((r.data||[]).map(x=>x.event_id)); }
    catch(e) { return new Set(); }
  },

  async _quickRegister(eventId, eventName) {
    if (!this.user || this.user.role !== 'student') return this.showToast('请先以学生身份登录', 'warning');
    var ok = await this.confirmDialog('确认报名【' + eventName + '】？');
    if (!ok) return;
    try {
      this.showLoading();
      var res = await API.student.submitRegistration(eventId);
      this.hideLoading();
      if (res.success) { this.showToast('报名成功！等待审核', 'success'); this.renderHome(); }
      else this.showToast(res.error || '报名失败', 'error');
    } catch(e) { this.hideLoading(); this.showToast(e.message || '报名失败', 'error'); }
  },

  // ====== 背景音乐 ======
  musicPlaying: false,

  toggleMusic() {
    var audio = document.getElementById('bg-music');
    var btn = document.getElementById('music-control');
    if (!audio || !btn) return;
    if (this.musicPlaying) {
      audio.pause();
      btn.classList.add('muted');
      btn.classList.remove('playing');
      this.musicPlaying = false;
    } else {
      audio.play().then(function() {
        btn.classList.remove('muted');
        btn.classList.add('playing');
      }).catch(function(){});
      this.musicPlaying = true;
    }
  },

  _initMusic() {
    var self = this;
    var btn = document.getElementById('music-control');
    if (!btn) return;

    // 使用 Web Audio API 解码播放 m4a
    var ctx = null;
    var source = null;
    var gainNode = null;

    function ensureCtx() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (!gainNode) { gainNode = ctx.createGain(); gainNode.gain.value = 0.25; gainNode.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function loadAndPlay() {
      ensureCtx();
      // 从服务器加载 m4a 文件并用 AudioContext 解码
      fetch('/audio/bg-music.m4a').then(function(response) {
        if (!response.ok) throw new Error('File not found');
        return response.arrayBuffer();
      }).then(function(buffer) {
        return ctx.decodeAudioData(buffer);
      }).then(function(audioBuffer) {
        if (source) { try { source.stop(); } catch(e) {} }
        source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;
        source.connect(gainNode);
        source.start();
        self.musicPlaying = true;
        if (btn) { btn.classList.remove('muted'); btn.classList.add('playing'); }
      }).catch(function(e) {
        console.log('Audio load failed:', e.message);
        if (btn) btn.classList.add('muted');
      });
    }

    // 用户首次点击后加载播放
    var started = false;
    var startOnClick = function() {
      if (started) return;
      started = true;
      loadAndPlay();
      document.removeEventListener('click', startOnClick);
    };
    document.addEventListener('click', startOnClick);
    
    // 存储引用用于 toggle
    this._audioCtx = ctx;
    this._audioGain = gainNode;
    this._audioSource = source;
    this._audioReload = loadAndPlay;
  },

  toggleMusic() {
    var btn = document.getElementById('music-control');
    // 尝试使用 ctx gain
    if (this._audioGain) {
      if (this.musicPlaying) {
        this._audioGain.gain.value = 0;
        this.musicPlaying = false;
        if (btn) { btn.classList.add('muted'); btn.classList.remove('playing'); }
      } else {
        if (this._audioCtx) this._audioCtx.resume();
        this._audioGain.gain.value = 0.25;
        this.musicPlaying = true;
        if (btn) { btn.classList.remove('muted'); btn.classList.add('playing'); }
      }
      return;
    }
    // Fallback: HTML audio element
    var audio = document.getElementById('bg-music');
    if (!audio || !btn) return;
    if (this.musicPlaying) { audio.pause(); btn.classList.add('muted'); btn.classList.remove('playing'); this.musicPlaying = false; }
    else { audio.play().then(function(){ btn.classList.remove('muted'); btn.classList.add('playing'); }).catch(function(){}); this.musicPlaying = true; }
  },

  async exportResultsCSV() {
    try {
      this.showLoading();
      const res = await API.get('/public/results');
      const data = res.data || [];
      const csv = ['排名,项目,姓名,班级,成绩,奖项'];
      data.forEach(r => csv.push(`${r.rank||''},${r.event_name||''},${r.name||''},${r.class_name||''},${r.performance||''},${r.award||''}`));
      const blob = new Blob(['\uFEFF' + csv.join('\n')], {type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='运动会成绩表.csv'; a.click();
      URL.revokeObjectURL(url);
      this.showToast('导出成功', 'success');
    } catch(e) { this.showToast('导出失败: '+e.message,'error'); }
    finally { this.hideLoading(); }
  },
  async printResults() {
    try {
      this.showLoading();
      const res = await API.get('/public/results');
      const data = res.data || [];
      this.hideLoading();
      const w = window.open('','_blank','width=800,height=600');
      const medals = {1:'🥇',2:'🥈',3:'🥉'};
      w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>运动会成绩单</title><style>body{font-family:'Microsoft YaHei',sans-serif;padding:2rem}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:.5rem;text-align:left}th{background:#f0f0f0}h1{text-align:center}.medal{font-size:1.2rem}</style></head><body><h1>运动会成绩单</h1><p style="text-align:center;color:#666">${new Date().toLocaleDateString()}</p><table><thead><tr><th>排名</th><th>项目</th><th>姓名</th><th>班级</th><th>成绩</th><th>奖项</th></tr></thead><tbody>${data.map(r=>`<tr><td>${medals[r.rank]||r.rank||'-'}</td><td>${r.event_name||'-'}</td><td>${r.name||'-'}</td><td>${r.class_name||'-'}</td><td>${r.performance||'-'}</td><td>${r.award||'-'}</td></tr>`).join('')}</tbody></table></body></html>`);
      w.document.close();
      setTimeout(()=>w.print(),500);
    } catch(e) { this.showToast('操作失败: '+e.message,'error'); }
  },
};

window.App = App;

// 背景点击关闭 + ESC关闭
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) App.hideModal();
});
document.getElementById('search-overlay')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('search-overlay')) App.hideSearch();
});
document.addEventListener('click', (e) => {
  const target = e.target instanceof Element ? e.target : null;
  if (!target) return;

  const closeTrigger = target.closest('.modal__close, .modal-close, .search-close, [data-close-modal], [data-close-search]');
  if (closeTrigger) {
    e.preventDefault();
    if (closeTrigger.matches('.search-close, [data-close-search]') || closeTrigger.closest('#search-overlay')) {
      App.hideSearch();
    } else {
      App.hideModal(true);
    }
    return;
  }

  const actionButton = target.closest('#modal-overlay button, #search-overlay button');
  if (!actionButton) return;
  const text = String(actionButton.textContent || '').replace(/\s+/g, '').trim();
  if (text === '取消' || text === '关闭') {
    e.preventDefault();
    if (actionButton.closest('#search-overlay')) App.hideSearch();
    else App.hideModal(true);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { App.hideModal(); App.hideSearch(); }
});

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
