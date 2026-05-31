const App = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  countdownTimer: null,

  async init() {
    this.bindNavigation();
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
    }
  },

  async refreshUser() {
    this.syncSessionFromStorage();
    const token = localStorage.getItem('token');
    if (!token) {
      this.user = null;
      API.token = '';
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
      }
    } catch (_) {
      /* 網路異常時保留本地登入狀態 */
    }
    this.updateNav();
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
      document.getElementById('page-announcements').classList.remove('hidden');
      document.querySelector('[href="#/announcements"]')?.classList.add('active');
      this.renderAnnouncements();
      var annId = hash.split('/')[2];
      if (annId && /^\d+$/.test(annId)) this.showAnnouncementDetail(annId);
    } else if (hash === '/admin') {
      if (!this.user || this.user.role !== 'admin') { window.location.hash = '#/login'; return; }
      document.getElementById('page-admin').classList.remove('hidden');
      document.querySelector('[href="#/admin"]')?.classList.add('active');
      Admin.render();
    } else if (hash === '/student' || hash.startsWith('/student/')) {
      if (!this.user) { window.location.hash = '#/login'; return; }
      if (this.user.role === 'admin') {
        this.showToast('管理員帳號無法報名，請使用學生帳號登入', 'warning');
        window.location.hash = '#/';
        return;
      }
      const tab = hash.split('/')[2];
      if (tab === 'register') Student.currentTab = 'register';
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
    // 点击其他地方关闭
    document.addEventListener('click', () => {
      document.querySelector('.user-dropdown')?.classList.remove('show');
    });
  },

  updateNav() {
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    const authBtns = document.getElementById('auth-btns');
    const userMenu = document.getElementById('user-menu');
    const notifyBell = document.getElementById('notify-bell');
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
      if (notifyBell) { notifyBell.classList.remove('hidden'); this._fetchUnreadCount(); }
    } else {
      authBtns.classList.remove('hidden');
      userMenu.classList.add('hidden');
      if (notifyBell) notifyBell.classList.add('hidden');
    }
  },

  async _fetchUnreadCount() {
    try {
      const res = await API.get('/student/notifications?limit=1');
      const unread = res.data?.unread || 0;
      const badge = document.getElementById('notify-badge');
      const bell = document.getElementById('notify-bell');
      if (badge) { badge.textContent = unread > 99 ? '99+' : unread; badge.dataset.count = unread; }
      if (bell) bell.classList.toggle('has-unread', unread > 0);
    } catch(e) { /* 静默失败 */ }
  },

  async _showNotifications() {
    try {
      this.showLoading();
      const res = await API.get('/student/notifications?limit=30');
      this.hideLoading();
      const data = res.data?.list || [];
      const typeIcon = { success: 'fa-check-circle', warning: 'fa-exclamation-triangle', danger: 'fa-times-circle', info: 'fa-info-circle' };
      const typeColor = { success: 'var(--green)', warning: 'var(--orange)', danger: 'var(--red)', info: 'var(--primary)' };
      let html = `<div class="modal-header"><h3>通知消息</h3><button class="modal-close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div><div class="modal-body" style="padding:0">`;
      if (data.length === 0) {
        html += '<div style="padding:3rem;text-align:center"><i class="fas fa-bell-slash" style="font-size:3rem;color:var(--border);margin-bottom:1rem;display:block"></i><p class="text-muted">暂无通知</p></div>';
      } else {
        html += data.map(n => `
          <div class="notify-item ${n.is_read?'':'unread'}" data-id="${n.id}" data-url="${(n.target_url||'').replace(/"/g,'&quot;')}">
            <i class="fas ${typeIcon[n.type]||'fa-bell'}" style="color:${typeColor[n.type]||'var(--brand)'}"></i>
            <div style="flex:1">
              <strong>${this._escHtml(n.title)}</strong>
              <div style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5">${this._escHtml(n.content||'')}</div>
              <span class="time">${this.formatDate(n.created_at)}</span>
            </div>
          </div>
        `).join('');
      }
      html += `</div><div class="modal-footer">${data.length>0?`<button class="btn btn-outline btn-sm" onclick="App._markAllRead()">全部標記已讀</button>`:''}<button class="btn btn-primary btn-sm" onclick="App.hideModal()">關閉</button></div>`;
      this.showModal(html);
      document.querySelectorAll('.notify-item[data-id]').forEach(el => {
        el.addEventListener('click', async () => {
          const id = el.dataset.id;
          const url = el.dataset.url;
          try { await API.student.markNotificationRead(id); } catch (_) {}
          this.hideModal();
          this._fetchUnreadCount();
          if (url) window.location.hash = url.startsWith('#') ? url : '#' + url;
        });
      });
    } catch(e) {
      this.hideLoading();
      this.showToast(e.message, 'error');
    }
  },

  async _markAllRead() {
    try {
      await API.put('/student/notifications/read-all');
      this.hideModal();
      this._fetchUnreadCount();
      this.showToast('已全部标记为已读', 'success');
    } catch(e) { this.showToast(e.message, 'error'); }
  },

  async logout() {
    API.clearToken();
    this.user = null;
    this.updateNav();
    window.location.hash = '#/';
    this.showToast('已退出登录', 'info');
  },

  // ====== 搜索 ======
  bindSearch() {
    const input = document.getElementById('nav-search-input');
    const btn = document.getElementById('nav-search-btn');
    const doSearch = async () => {
      const q = input?.value?.trim();
      if (!q) return;
      try {
        this.showLoading();
        const res = await API.get(`/public/search?q=${encodeURIComponent(q)}`);
        this._showSearchResults(res.data || {});
      } catch (e) { this.showToast(e.message, 'error'); }
      finally { this.hideLoading(); }
    };
    btn?.addEventListener('click', doSearch);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  },

  _showSearchResults(data) {
    const el = document.getElementById('search-results');
    let html = '<div class="search-header"><h3>搜索结果</h3><button class="search-close" onclick="App.hideSearch()">&times;</button></div>';
    if (data.events?.length) { html += '<h4>赛事项目</h4><ul>'; data.events.forEach(e => html += `<li><a href="#/events/${e.id}">${e.name}</a></li>`); html += '</ul>'; }
    if (data.students?.length) { html += '<h4>学生</h4><ul>'; data.students.forEach(s => html += `<li>${s.name} - ${s.class_name||''}</li>`); html += '</ul>'; }
    if (data.announcements?.length) { html += '<h4>公告</h4><ul>'; data.announcements.forEach(a => html += `<li><a href="#/announcements/${a.id}">${a.title}</a></li>`); html += '</ul>'; }
    if (!data.events?.length && !data.students?.length && !data.announcements?.length) html += '<p class="text-muted">未找到相关结果</p>';
    el.innerHTML = html;
    document.getElementById('search-overlay')?.classList.remove('hidden');
  },
  hideSearch() { document.getElementById('search-overlay')?.classList.add('hidden'); },

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
  hideModal() {
    if (typeof this._modalBeforeClose === 'function') {
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
            <button class="btn btn-secondary" id="confirm-cancel">取消</button>
            <button class="btn btn-primary" id="confirm-ok">确认</button>
          </div>
        </div>
      `);
      document.getElementById('confirm-cancel').onclick = () => { this.hideModal(); resolve(false); };
      document.getElementById('confirm-ok').onclick = () => { this.hideModal(); resolve(true); };
    });
  },

  // ====== 首页 ======
  async renderHome() {
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    try {
      let [meet, stats, ann, results, events] = await Promise.allSettled([
        API.get('/public/meet-info'),
        API.get('/public/stats/overview'),
        API.get('/public/announcements?limit=5'),
        API.get('/public/results?limit=5'),
        API.get('/public/events')
      ]);

      const m = meet.value?.data || {};
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

      // ── 赛事项目总览：横向卡片行，5个 ──
      const homeEv = document.getElementById('home-events');
      const genderL = g => g === 'male' ? '男子' : g === 'female' ? '女子' : '混合';
      const typeL = t => t === 'team' ? '集体' : '个人';
      const eventList = (events.value?.data || []);
      if (eventList.length) {
        let evH = '<div class="events-horiz-row">';
        eventList.slice(0, 5).forEach(e => {
          evH += `<a href="#/events/${e.id}" class="event-horiz-card">
            <div class="event-horiz-icon"><i class="fas fa-running"></i></div>
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

      // ── 最新公告 ──
      const catL = { event: '赛事通知', registration: '报名截止', result: '成绩公示', urgent: '紧急通知', general: '一般' };
      const annData = ann.value?.data || [];
      let annH = '';
      if (annData.length) {
        annData.forEach(a => annH += `<div class="announcement-item"><span class="badge badge-${a.category || 'general'}">${catL[a.category] || a.category}</span>${a.is_pinned ? '<span class="badge badge-pin">置顶</span>' : ''}<a href="#/announcements/${a.id}" class="announcement-title">${a.title}</a><span class="announcement-time">${this.formatDate(a.publish_time)}</span></div>`);
        document.getElementById('home-announcements').innerHTML = annH;
      } else {
        document.getElementById('home-announcements').innerHTML = '<p class="text-muted text-center" style="padding:2rem">暂无更多信息</p>';
      }

      // ── 最新成绩 ──
      const resData = results.value?.data || [];
      let resH = '';
      if (resData.length) {
        const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
        resData.forEach(r => resH += `<div class="result-item"><span class="rank-medal">${medals[r.rank] || r.rank}</span><span>${r.name || '-'} (${r.class_name || '-'})</span><span>${r.event_name || '-'}</span><span>${r.performance || '-'}</span></div>`);
        document.getElementById('home-results').innerHTML = resH;
      } else {
        document.getElementById('home-results').innerHTML = '<p class="text-muted text-center" style="padding:2rem">暂无更多信息</p>';
      }
    } catch (e) {
      this.showToast('載入首頁失敗', 'error');
    }
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
              <a href="#/events/${e.id}" class="btn btn-outline btn-sm">查看詳情</a>
            </div>
          </div>`).join('') : '<div class="empty-state" style="grid-column:1/-1"><p class="text-muted">暂无符合条件的赛事</p></div>';
      } catch (e) { this.showToast(e.message, 'error'); }
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
    root.innerHTML = '<div class="text-center p-8"><div class="spinner"></div><p class="text-muted mt-2">載入中…</p></div>';

    try {
      const res = await API.public.getEvent(id);
      const e = res.data;
      if (!res.success || !e) {
        root.innerHTML = `<div class="empty-state"><p>項目不存在</p><a href="#/events" class="btn btn-outline mt-2">返回列表</a></div>`;
        return;
      }

      const genderL = g => (g === 'male' ? '男子組' : g === 'female' ? '女子組' : '混合組');
      const catL = c => ({ track: '徑賽', field: '田賽', relay: '接力', team: '集體' }[c] || c);
      const typeL = t => (t === 'team' ? '集體項目' : '個人項目');
      const isStudent = this.user && this.user.role === 'student';
      const name = this._escHtml(e.name || '');
      const desc = this._escHtml(e.description || e.rules || '暫無詳細說明');
      const rules = this._escHtml(e.rules || '');

      let scheduleHtml = '';
      if (e.schedules?.length) {
        scheduleHtml = `<div class="card mt-3"><div class="card-header"><h3>賽程安排</h3></div><div class="card-body"><div class="table-container"><table class="table"><thead><tr><th>輪次</th><th>時間</th><th>場地</th></tr></thead><tbody>${e.schedules.map(s => `<tr><td>${this._escHtml(s.round_name)}</td><td>${this.formatDate(s.start_time)}</td><td>${this._escHtml(s.venue || e.venue || '待定')}</td></tr>`).join('')}</tbody></table></div></div></div>`;
      }

      let actionHtml = '';
      if (isStudent) {
        actionHtml = `<button type="button" class="btn btn-primary" id="event-detail-register">提交報名</button>`;
      } else if (!this.user) {
        actionHtml = `<a href="#/login" class="btn btn-primary">登入後報名</a>`;
      } else if (this.user.role === 'admin') {
        actionHtml = `<span class="text-muted text-sm">管理員帳號請使用學生帳號報名</span>`;
      }

      root.innerHTML = `
        <nav class="breadcrumb"><a href="#/events">賽事項目</a> <span>/</span> <span>${name}</span></nav>
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
          <div class="detail-stat"><span class="label">比賽場地</span><span class="value">${this._escHtml(e.venue || '待定')}</span></div>
          <div class="detail-stat"><span class="label">人數上限</span><span class="value">${e.max_participants || '不限'}</span></div>
          <div class="detail-stat"><span class="label">已報名</span><span class="value">${e.registration_count ?? 0} 人</span></div>
          <div class="detail-stat"><span class="label">已通過</span><span class="value">${e.approved_count ?? 0} 人</span></div>
        </div>
        <div class="card mt-3">
          <div class="card-header"><h3>項目詳情</h3></div>
          <div class="card-body detail-prose">${desc.replace(/\n/g, '<br>')}</div>
        </div>
        ${rules ? `<div class="card mt-3"><div class="card-header"><h3>比賽規則</h3></div><div class="card-body detail-prose">${rules.replace(/\n/g, '<br>')}</div></div>` : ''}
        ${scheduleHtml}
        <p class="mt-3"><a href="#/events" class="btn btn-outline btn-sm"><i class="fas fa-arrow-left"></i> 返回項目列表</a></p>
      `;

      document.getElementById('event-detail-register')?.addEventListener('click', () => {
        if (typeof Student !== 'undefined') Student._doRegister(parseInt(id, 10), e.name);
      });
    } catch (err) {
      root.innerHTML = `<div class="empty-state"><p>載入失敗：${this._escHtml(err.message)}</p><a href="#/events" class="btn btn-outline mt-2">返回</a></div>`;
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
      if (!data.length) { table.innerHTML = '<p class="text-muted p-8 text-center">暂无成绩数据</p>'; return; }

      // 统计各组人数
      var grpCount = {};
      data.forEach(function(r){ var sg=(r.user_sport_group||'A'); grpCount[sg]=(grpCount[sg]||0)+1; });

      var html = '<div class="section-title">成绩公示<small>请选择组别</small></div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">';
      ['A','B','C','D','E'].forEach(function(sg) {
        var cnt = grpCount[sg] || 0;
        if (!cnt) return;
        html += '<a href="#/results/group/'+sg+'" class="card" style="text-decoration:none;text-align:center;padding:2rem 1rem;border-left:4px solid var(--red)">';
        html += '<div style="font-size:2.5rem;font-weight:900;color:var(--red)">'+sg+'</div><div class="text-sm mt-1">'+cnt+'条成绩</div></a>';
      });
      html += '</div>';
      table.innerHTML = html;
    } catch(e) { table.innerHTML = '<p class="text-muted p-8 text-center">加载失败</p>'; }
  },

  // 组详情 → 选择男女
  async _renderGroupDetail(sg) {
    var table = document.getElementById('results-table');
    if (!table) return;
    table.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      var res = await API.get('/public/results');
      var data = (res.data||[]).filter(function(r){return (r.user_sport_group||'A')===sg});
      if (!data.length) { table.innerHTML = '<p class="text-muted p-8 text-center">该组暂无成绩</p>'; return; }
      var maleCount=data.filter(function(r){return (r.user_gender||'male')==='male'}).length;
      var femaleCount=data.length - maleCount;

      var html = '<div class="section-title"><a href="#/results">← 返回</a> '+sg+'组</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
      if(maleCount) html += '<a href="#/results/group/'+sg+'/male" class="card" style="text-decoration:none;text-align:center;padding:2rem;border-left:4px solid #1e6091"><i class="fas fa-male" style="font-size:2.5rem;color:#1e6091"></i><div style="font-size:1.3rem;font-weight:700;margin-top:8px">男子组</div><div class="text-sm text-muted mt-1">'+maleCount+'条</div></a>';
      if(femaleCount) html += '<a href="#/results/group/'+sg+'/female" class="card" style="text-decoration:none;text-align:center;padding:2rem;border-left:4px solid #e91e63"><i class="fas fa-female" style="font-size:2.5rem;color:#e91e63"></i><div style="font-size:1.3rem;font-weight:700;margin-top:8px">女子组</div><div class="text-sm text-muted mt-1">'+femaleCount+'条</div></a>';
      html += '</div>';
      table.innerHTML = html;
    } catch(e) { table.innerHTML = '<p class="text-muted p-8 text-center">加载失败</p>'; }
  },

  // 性别详情 → 选择项目
  async _renderGenderDetail(sg, g) {
    var table = document.getElementById('results-table');
    if (!table) return;
    table.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      var res = await API.get('/public/results');
      var data = (res.data||[]).filter(function(r){return (r.user_sport_group||'A')===sg && (r.user_gender||'male')===g});
      if (!data.length) { table.innerHTML = '<p class="text-muted p-8 text-center">暂无成绩</p>'; return; }

      var evtGrp = {};
      data.forEach(function(r){var en=r.event_name||'其他';evtGrp[en]=(evtGrp[en]||0)+1});
      var gLabel = g==='male'?'男子组':'女子组';

      var html = '<div class="section-title"><a href="#/results/group/'+sg+'">← 返回</a> '+sg+'组 '+gLabel+'</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">';
      Object.keys(evtGrp).sort().forEach(function(en){
        var cnt = evtGrp[en];
        var safe = encodeURIComponent(en);
        html += '<a href="#/results/group/'+sg+'/'+g+'/'+safe+'" class="card" style="text-decoration:none;color:inherit;border-left:3px solid var(--gold)"><div class="card-body" style="text-align:center"><strong style="font-size:1rem">'+en+'</strong><br><span class="text-sm text-muted">'+cnt+'人参赛</span></div></a>';
      });
      html += '</div>';
      table.innerHTML = html;
    } catch(e) { table.innerHTML = '<p class="text-muted p-8 text-center">加载失败</p>'; }
  },

  // 项目完整排名表
  async _renderEventRanking(sg, g, en) {
    var table = document.getElementById('results-table');
    if (!table) return;
    table.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      var res = await API.get('/public/results');
      var data = (res.data||[]).filter(function(r){return (r.user_sport_group||'A')===sg && (r.user_gender||'male')===g && r.event_name===en});
      if (!data.length) { table.innerHTML = '<p class="text-muted p-8 text-center">暂无排名</p>'; return; }

      var medals = {1:'🥇',2:'🥈',3:'🥉'};
      var results = data.sort(function(a,b){return (a.rank||99)-(b.rank||99)});
      var gLabel = g==='male'?'男子组':'女子组';

      var html = '<div class="section-title"><a href="#/results/group/'+sg+'/'+g+'">← 返回</a> '+sg+'组 '+gLabel+' → '+en+'</div>';
      html += '<div class="table-container"><table class="table"><thead><tr><th>排名</th><th>姓名</th><th>班级</th><th>成绩</th><th>奖项</th></tr></thead><tbody>';
      results.forEach(function(r){html += '<tr class="'+(r.rank<=3?'award-row':'')+'"><td>'+(medals[r.rank]||r.rank||'-')+'</td><td>'+(r.name||'-')+'</td><td>'+(r.class_name||'-')+'</td><td>'+(r.performance||'-')+'</td><td><span class="badge badge-success">'+(r.award||'-')+'</span></td></tr>'});
      html += '</tbody></table></div>';
      table.innerHTML = html;
    } catch(e) { table.innerHTML = '<p class="text-muted p-8 text-center">加载失败</p>'; }
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
            <div class="card-body"><p class="announcement-preview">${(a.content||'').substring(0,120)}...</p></div>
            <div class="card-footer"><span class="text-sm text-muted">${this.formatDate(a.publish_time)} · ${a.view_count||0}阅读</span><button class="btn btn-outline btn-sm" onclick="App.showAnnouncementDetail(${a.id})">查看详情</button></div>
          </div>`).join('') : '<p class="text-muted p-8 text-center">暂无公告</p>';
      } catch (e) { this.showToast(e.message, 'error'); }
      finally { this.hideLoading(); }
    };
    load();
    document.getElementById('ann-cat')?.addEventListener('change', load);
  },

  async showAnnouncementDetail(id) {
    try {
      this.showLoading();
      var res = await API.get('/public/announcements/' + id);
      var a = res.data;
      this.hideLoading();
      if (!a) return this.showToast('公告不存在', 'error');
      var catL = {event:'赛事通知',registration:'报名截止',result:'成绩公示',urgent:'紧急通知',general:'一般'};
      this.showModal(
        '<div class="modal-header"><h3>'+a.title+'</h3><button class="modal-close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>' +
        '<div class="modal-body">' +
          '<div class="detail-meta"><span class="badge badge-'+(a.category||'general')+'">'+(catL[a.category]||a.category)+'</span><span class="text-sm text-muted">'+this.formatDate(a.publish_time)+' · '+(a.view_count||0)+'阅读</span></div>' +
          '<div class="detail-content">'+(a.content||'').replace(/\n/g,'<br>')+'</div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-secondary btn-sm" onclick="App.hideModal()">关闭</button></div>'
      );
    } catch (e) {
      this.hideLoading();
      this.showToast('加载失败', 'error');
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
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { App.hideModal(); App.hideSearch(); }
});

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
