const App = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  countdownTimer: null,

  async init() {
    this.bindNavigation();
    this.bindSearch();
    this.updateNav();
    this.handleRoute();
    this._initMusic();
    window.addEventListener('hashchange', () => this.handleRoute());
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
      this.renderAnnouncements();
      this.renderAnnouncementDetail(hash.split('/')[2]);
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
      if (dateEl) dateEl.textContent = '比赛时间：' + (m.start_date || '—') + ' 至 ' + (m.end_date || '—');
      if (m.start_date) this.startCountdown(m.start_date);

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
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    var self = this;
    var update = function() {
      var diff = new Date(targetDate) - new Date();
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
    table.innerHTML = '<div class="section-title" style="margin-top:80px">成绩公示</div><div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      this.showLoading();
      var res = await API.get('/public/results');
      var data = res.data || [];
      this.hideLoading();
      if (!data.length) { table.innerHTML = '<div class="section-title" style="margin-top:80px">成绩公示</div><p class="text-muted p-8 text-center">暂无成绩数据</p>'; return; }

      var groups = {};
      data.forEach(function(r) {
        var key = r.event_name || '其他';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });

      var medals = {1:'🥇',2:'🥈',3:'🥉'};
      var idx = 0;
      var html = '<div class="section-title" style="margin-top:80px">成绩公示<small>点击项目查看详细排名</small></div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
      
      Object.keys(groups).sort().forEach(function(eventName) {
        var results = groups[eventName];
        var sid = 'rg' + (idx++);
        var top3 = results.filter(function(r){return r.rank<=3});
        html += '<div class="card" style="cursor:pointer" onclick="App._toggleResults(\''+sid+'\')">';
        html += '<div class="card-header"><h3>'+eventName+'</h3><span class="badge badge-success">'+results.length+'人</span></div>';
        html += '<div class="card-body">';
        html += '<div id="'+sid+'" style="display:none;margin-top:8px">';
        html += '<div class="table-container"><table class="table"><thead><tr><th>排名</th><th>姓名</th><th>班级</th><th>成绩</th><th>奖项</th></tr></thead><tbody>';
        results.sort(function(a,b){return (a.rank||99)-(b.rank||99)});
        results.forEach(function(r) {
          html += '<tr class="'+(r.rank<=3?'award-row':'')+'"><td>'+(medals[r.rank]||r.rank||'-')+'</td><td>'+(r.name||'-')+'</td><td>'+(r.class_name||'-')+'</td><td>'+(r.performance||'-')+'</td><td><span class="badge badge-success">'+(r.award||'-')+'</span></td></tr>';
        });
        html += '</tbody></table></div></div>';
        html += '<div style="margin-top:4px;font-size:12px;color:var(--text3)">';
        if (top3.length) {
          top3.forEach(function(r,i){ html += medals[i+1]+' '+r.name+' '; });
        }
        html += ' | 点击查看全部</div>';
        html += '</div></div>';
      });
      html += '</div>';
      html += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-outline btn-sm" onclick="App.exportResults()">导出Excel</button><button class="btn btn-outline btn-sm" onclick="App.exportResultsCSV()">导出CSV</button></div>';
      table.innerHTML = html;
    } catch(e) { this.hideLoading(); table.innerHTML = '<p class="text-muted p-8 text-center">加载失败：'+e.message+'</p>'; }
  },

  _toggleResults(id) {
    var el = document.getElementById(id);
    if (el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
  },

  _toggleResults(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
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
      const res = await API.get(`/public/announcements/${id}`);
      const a = res.data;
      if (!a) return this.showToast('公告不存在', 'error');
      this.hideLoading();
      const catL = {event:'赛事通知',registration:'报名截止',result:'成绩公示',urgent:'紧急通知',general:'一般'};
      this.showModal(
        `<div class="modal-header"><h3>${String(a.title)}</h3><button class="modal-close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>` +
        `<div class="modal-body">` +
          `<div class="detail-meta"><span class="badge badge-${a.category||'general'}">${catL[a.category]||a.category}</span><span class="text-sm text-muted">${this.formatDate(a.publish_time)} · ${a.view_count||0}阅读</span></div>` +
          `<div class="detail-content">${(a.content||'').replace(/\n/g,'<br>')}</div>` +
        `</div>` +
        `<div class="modal-footer"><button class="btn btn-secondary btn-sm" onclick="App.hideModal()">关闭</button></div>`
      );
    } catch (e) {
      this.hideLoading();
      this.showToast('加载公告失败: ' + (e.message||''), 'error');
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
    var audio = document.getElementById('bg-music');
    var btn = document.getElementById('music-control');
    if (!audio) return;
    audio.volume = 0.3;
    
    // 尝试自动播放
    var p = audio.play();
    if (p) {
      p.then(function() {
        self.musicPlaying = true;
        if (btn) { btn.classList.remove('muted'); btn.classList.add('playing'); }
      }).catch(function() {
        // 浏览器阻止自动播放，点击任意位置后开始
        self.musicPlaying = false;
        if (btn) { btn.classList.add('muted'); btn.classList.remove('playing'); }
        var start = function() {
          audio.play().then(function() {
            self.musicPlaying = true;
            if (btn) { btn.classList.remove('muted'); btn.classList.add('playing'); }
          }).catch(function(){});
          document.removeEventListener('click', start);
        };
        document.addEventListener('click', start);
      });
    }
  },

  _createMusic() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.audioCtx = ctx;
      var master = ctx.createGain();
      master.gain.value = 0.25;
      master.connect(ctx.destination);
      this.gainNode = master;

      // 体育激情风格：C小调，130BPM
      var bpm = 130;
      var beat = 60 / bpm;

      // 低音线 (C - Ab - F - G)
      var bassNotes = [130.81, 103.83, 87.31, 98.00];
      
      // 和弦 (Cm - Ab - Fm - G)
      var chords = [
        [130.81, 155.56, 196.00],  // Cm
        [103.83, 130.81, 155.56],  // Ab
        [87.31, 104.00, 130.81],   // Fm
        [98.00, 123.47, 146.83]    // G
      ];
      
      // 旋律片段
      var melodyPatterns = [
        [261.63, 329.63, 392.00, 329.63, 311.13, 261.63],
        [311.13, 261.63, 207.65, 233.08, 261.63],
        [261.63, 311.13, 349.23, 392.00, 523.25, 466.16],
        [392.00, 349.23, 311.13, 329.63, 261.63]
      ];

      var chordIdx = 0;
      var barLength = beat * 4;

      function playBar() {
        var now = ctx.currentTime;
        var chord = chords[chordIdx];
        var melody = melodyPatterns[chordIdx];
        var bassFreq = bassNotes[chordIdx];

        // 铺底和弦
        chord.forEach(function(freq) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.04, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + barLength);
          osc.connect(gain);
          gain.connect(master);
          osc.start(now);
          osc.stop(now + barLength);
        });

        // 低音
        var bass = ctx.createOscillator();
        var bGain = ctx.createGain();
        bass.type = 'triangle';
        bass.frequency.value = bassFreq;
        bGain.gain.setValueAtTime(0, now);
        bGain.gain.linearRampToValueAtTime(0.06, now + 0.02);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + barLength);
        bass.connect(bGain);
        bGain.connect(master);
        bass.start(now);
        bass.stop(now + barLength);

        // 旋律
        var noteLen = barLength / melody.length;
        melody.forEach(function(freq, i) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, now + i * noteLen);
          gain.gain.linearRampToValueAtTime(0.05, now + i * noteLen + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 0.9) * noteLen);
          osc.connect(gain);
          gain.connect(master);
          osc.start(now + i * noteLen);
          osc.stop(now + (i + 1) * noteLen);
        });

        // 打击乐 (kick + hi-hat)
        // Kick
        var kickOsc = ctx.createOscillator();
        var kickGain = ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(150, now);
        kickOsc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
        kickGain.gain.setValueAtTime(0.15, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        kickOsc.connect(kickGain);
        kickGain.connect(master);
        kickOsc.start(now);
        kickOsc.stop(now + 0.3);
        
        // Hi-hat on 8th notes
        for (var h = 0; h < 8; h++) {
          var noise = ctx.createBufferSource();
          var bufSize = ctx.sampleRate * 0.02;
          var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
          var data = buf.getChannelData(0);
          for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
          noise.buffer = buf;
          var nGain = ctx.createGain();
          var filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 6000 + (h % 2 === 0 ? 2000 : 0);
          nGain.gain.setValueAtTime(h % 2 === 0 ? 0.04 : 0.02, now + h * beat / 2);
          nGain.gain.exponentialRampToValueAtTime(0.001, now + h * beat / 2 + 0.04);
          noise.connect(filter);
          filter.connect(nGain);
          nGain.connect(master);
          noise.start(now + h * beat / 2);
          noise.stop(now + h * beat / 2 + 0.05);
        }

        chordIdx = (chordIdx + 1) % chords.length;
      }

      playBar();
      this._musicInterval = setInterval(playBar, barLength * 1000);
      this.musicPlaying = true;
      var btn = document.getElementById('music-control');
      if (btn) { btn.classList.remove('muted'); btn.classList.add('playing'); }
    } catch(e) {}
  },

  _initMusic() {
    var self = this;
    var startOnClick = function() {
      if (!self.audioCtx || self.audioCtx.state === 'suspended') {
        if (self.audioCtx) self.audioCtx.resume();
        else self._createMusic();
      }
      if (self.gainNode && !self.musicPlaying) {
        self.gainNode.gain.value = 0.25;
        self.musicPlaying = true;
        var btn = document.getElementById('music-control');
        if (btn) { btn.classList.remove('muted'); btn.classList.add('playing'); }
      }
    };
    // 用户首次点击页面时启动
    document.addEventListener('click', startOnClick, { once: true });
    // 也尝试直接创建
    setTimeout(function() { self._createMusic(); }, 1000);
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
