// 学生模块
const Student = {
  currentTab: 'profile',
  profileData: null,

  render() {
    const page = document.getElementById('page-student');
    if (!page) return;
    page.innerHTML = `
      <div class="student-layout">
        <aside class="student-sidebar">
          <div class="student-sidebar-header">
            <div class="student-avatar" id="student-avatar" title="点击更换头像">
              <div class="avatar-upload-hint">更换</div>
            </div>
            <h3 id="student-name">加载中...</h3>
            <p id="student-info">-</p>
          </div>
          <ul class="student-menu">
            <li class="student-menu-item active" data-tab="profile"><i class="fas fa-id-card"></i>个人资料</li>
            <li class="student-menu-item" data-tab="register"><i class="fas fa-pen-to-square"></i>在線報名</li>
            <li class="student-menu-item" data-tab="my-registrations"><i class="fas fa-list-check"></i>我的報名</li>
            <li class="student-menu-item" data-tab="my-schedules"><i class="fas fa-calendar"></i>我的赛程</li>
            <li class="student-menu-item" data-tab="my-results"><i class="fas fa-trophy"></i>我的成绩</li>
            <li class="student-menu-item" data-tab="class-results"><i class="fas fa-users"></i>班级成绩</li>
            <li class="student-menu-item" data-tab="announcements"><i class="fas fa-bullhorn"></i>公告通知</li>
          </ul>
        </aside>
        <div class="student-content" id="student-content"></div>
      </div>
    `;

    page.querySelectorAll('.student-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        page.querySelectorAll('.student-menu-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.currentTab = item.dataset.tab;
        this.renderTab();
      });
    });

    this.loadProfileInfo();
    this.renderTab();
  },

  renderTab() {
    const tab = this.currentTab;
    switch (tab) {
      case 'profile': this._renderProfile(); break;
      case 'register': this._renderRegister(); break;
      case 'my-registrations': this._renderMyRegistrations(); break;
      case 'my-schedules': this._renderMySchedules(); break;
      case 'my-results': this._renderMyResults(); break;
      case 'class-results': this._renderClassResults(); break;
      case 'announcements': this._renderMyAnnouncements(); break;
    }
  },

  async loadProfileInfo() {
    try {
      const res = await API.student.getMyProfile();
      if (res.success && res.data) {
        this.profileData = res.data;
        document.getElementById('student-name').textContent = res.data.name || '-';
        document.getElementById('student-info').textContent = `${res.data.grade || ''} ${res.data.class_name || ''}`.trim() || '-';
        this._updateAvatar(res.data.avatar);
      }
    } catch (e) {}
  },

  _updateAvatar(avatarData) {
    const el = document.getElementById('student-avatar');
    if (!el) return;
    if (avatarData) {
      el.innerHTML = `<img src="${avatarData}" alt="avatar"><div class="avatar-upload-hint">更换</div>`;
    } else {
      el.innerHTML = '<i class="fas fa-user-graduate" style="font-size:2rem;color:var(--ink)"></i><div class="avatar-upload-hint">更换</div>';
    }
    el.onclick = () => this._showAvatarUpload();
  },

  _showAvatarUpload() {
    const current = this.profileData?.avatar || '';
    App.showModal(`
      <div class="modal__header"><h3 class="modal__title">更换头像</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>
      <div class="modal__body" style="text-align:center">
        <div class="avatar-preview" id="avatar-preview">${current ? `<img src="${current}">` : '<i class="fas fa-user-graduate" style="font-size:3rem"></i>'}</div>
        <p class="text-sm text-muted mb-2">点击下方按钮选择图片，或将图片粘贴到此处</p>
        <input type="file" id="avatar-file" accept="image/*" style="display:none" onchange="Student._handleAvatarFile(this)">
        <button class="btn btn-i btn-sm" onclick="document.getElementById('avatar-file').click()">选择图片</button>
        <span class="text-sm text-muted mx-2">或</span>
        <button class="btn btn-outline btn-sm" onclick="Student._handleAvatarPaste()">粘贴图片</button>
      </div>
      <div class="modal__footer">
        ${current ? '<button class="btn btn--danger btn-sm" onclick="Student._removeAvatar()">移除头像</button>' : ''}
        <button class="btn btn-secondary btn-sm" onclick="App.hideModal()">关闭</button>
      </div>
    `);
  },

  _handleAvatarFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 500000) return App.showToast('图片不能超过500KB', 'warning');
    const reader = new FileReader();
    reader.onload = (e) => this._saveAvatar(e.target.result);
    reader.readAsDataURL(file);
  },

  async _handleAvatarPaste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.some(t => t.startsWith('image/'))) {
          const blob = await item.getType(item.types.find(t => t.startsWith('image/')));
          if (blob.size > 500000) return App.showToast('图片不能超过500KB', 'warning');
          const reader = new FileReader();
          reader.onload = (e) => this._saveAvatar(e.target.result);
          reader.readAsDataURL(blob);
          return;
        }
      }
      App.showToast('剪贴板中没有图片', 'warning');
    } catch (e) {
      App.showToast('粘贴失败，请使用选择图片方式', 'warning');
    }
  },

  async _saveAvatar(dataUrl) {
    try {
      App.showLoading();
      const res = await API.student.updateAvatar(dataUrl);
      App.hideLoading();
      if (res.success) {
        App.showToast('头像已更新', 'success');
        this.profileData.avatar = dataUrl;
        this._updateAvatar(dataUrl);
        App.hideModal();
      } else App.showToast(res.error || '更新失败', 'error');
    } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
  },

  async _removeAvatar() {
    try {
      App.showLoading();
      await API.student.updateAvatar('');
      App.hideLoading();
      App.showToast('头像已移除', 'success');
      if (this.profileData) this.profileData.avatar = '';
      this._updateAvatar('');
      App.hideModal();
    } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
  },

  // ===== 1. 个人资料 =====
  _renderProfile() {
    const c = document.getElementById('student-content');
    c.innerHTML = `
      <div class="student-section">
        <h2 class="student-section-title">个人资料</h2>
        <div class="card">
          <div class="card-body">
            <div class="student-profile-info" id="profile-info">加载中...</div>
          </div>
        </div>
        <h2 class="student-section-title mt-3">修改密码</h2>
        <div class="card">
          <div class="card-body">
            <form id="change-pwd-form" style="max-width:400px">
              <div class="form-group"><label>旧密码</label><input type="password" name="old" class="form-input" required placeholder="输入旧密码"></div>
              <div class="form-group"><label>新密码</label><input type="password" name="newp" class="form-input" required minlength="6" placeholder="至少6位"></div>
              <div class="form-group"><label>确认新密码</label><input type="password" name="confirm" class="form-input" required placeholder="再输一次"></div>
              <button type="submit" class="btn btn-primary">修改密码</button>
            </form>
          </div>
        </div>
      </div>
    `;

    if (this.profileData) {
      const u = this.profileData;
      document.getElementById('profile-info').innerHTML = `
        <div class="student-profile-item"><span class="student-profile-label">学号</span><span class="student-profile-value">${u.student_id || '-'}</span></div>
        <div class="student-profile-item"><span class="student-profile-label">姓名</span><span class="student-profile-value">${u.name || '-'}</span></div>
        <div class="student-profile-item"><span class="student-profile-label">邮箱</span><span class="student-profile-value">${u.email || '-'}</span></div>
        <div class="student-profile-item"><span class="student-profile-label">班级</span><span class="student-profile-value">${u.class_name || '-'}</span></div>
        <div class="student-profile-item"><span class="student-profile-label">年级</span><span class="student-profile-value">${u.grade || '-'}</span></div>
      `;
    }

    document.getElementById('change-pwd-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const old = f.old.value.trim();
      const newp = f.newp.value.trim();
      const confirm = f.confirm.value.trim();
      if (!old || !newp) return App.showToast('请填写所有字段', 'warning');
      if (newp.length < 6) return App.showToast('密码至少6位', 'warning');
      if (newp !== confirm) return App.showToast('两次密码不一致', 'warning');
      try {
        App.showLoading();
        const r = await API.student.updatePassword({ oldPassword: old, newPassword: newp });
        App.hideLoading();
        if (r.success) { App.showToast('密码修改成功', 'success'); f.reset(); }
        else App.showToast(r.error || '修改失败', 'error');
      } catch (e) { App.hideLoading(); App.showToast(e.message || '修改失败', 'error'); }
    });
  },

  // ===== 2. 在線報名 =====
  async _renderRegister() {
    const c = document.getElementById('student-content');
    c.innerHTML = '<div class="text-center p-8"><div class="spinner"></div><p class="text-muted mt-2">載入項目中…</p></div>';

    try {
      const evRes = await API.get('/student/events');
      const events = evRes.data || [];
      const meta = evRes.meta || {};
      const regOpen = meta.registration_open !== false;
      const maxN = meta.max_events_per_student || 3;
      const myN = meta.my_registration_count || 0;
      const regIds = new Set(
        (await API.student.getMyRegistrations().then(r => r.data || []).catch(() => [])).map(x => x.event_id)
      );

      const genderLabel = g => (g === 'male' ? '男子組' : g === 'female' ? '女子組' : '混合組');
      const catLabel = c => ({ track: '徑賽', field: '田賽', relay: '接力', team: '集體' }[c] || c);
      const typeLabel = t => (t === 'team' ? '集體' : '個人');
      const esc = s => this._escape(s);

      let banner = '';
      if (!regOpen) {
        banner = '<div class="reg-banner reg-banner--closed"><span><strong>報名已關閉</strong> — 管理員已暫停線上報名，請留意公告通知。</span></div>';
      } else {
        banner = `<div class="reg-banner reg-banner--open"><span>報名開放中 · 您已報 <strong>${myN}</strong> / <strong>${maxN}</strong> 項</span>${myN >= maxN ? '<span class="text-sm">已達上限</span>' : ''}</div>`;
      }

      if (events.length === 0) {
        c.innerHTML = `<div class="student-section"><h2 class="student-section-title">在線報名</h2>${banner}<div class="empty-state"><div class="empty-state__icon"><i class="fas fa-inbox"></i></div><p class="empty-state__desc">暫無開放報名的項目</p></div></div>`;
        return;
      }

      let html = `<div class="student-section"><h2 class="student-section-title">在線報名</h2>${banner}<div class="card-grid" id="register-event-grid">`;
      events.forEach(e => {
        const isReg = regIds.has(e.id);
        const full = e.max_participants > 0 && (e.registered_count || 0) >= e.max_participants;
        const atLimit = myN >= maxN;
        const remaining = e.max_participants > 0 ? Math.max(0, e.max_participants - (e.registered_count || 0)) : '不限';
        const btnDisabled = !regOpen || isReg || full || atLimit;
        let btnText = '提交報名';
        if (!regOpen) btnText = '報名關閉';
        else if (isReg) btnText = '已報名';
        else if (full) btnText = '名額已滿';
        else if (atLimit) btnText = '已達上限';
        const btnClass = btnDisabled ? 'btn-secondary' : 'btn-primary';

        html += `
          <article class="card event-card" data-event-id="${e.id}">
            <div class="card-header">
              <h3>${esc(e.name)}</h3>
              <span class="badge badge-info">${typeLabel(e.event_type)}</span>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem 1rem;font-size:0.8125rem;color:var(--text-secondary)">
                <span><i class="fas fa-venus-mars" style="width:16px;color:var(--text-muted)"></i> ${genderLabel(e.gender_group)}</span>
                <span><i class="fas fa-tag" style="width:16px;color:var(--text-muted)"></i> ${catLabel(e.category)}</span>
                <span><i class="fas fa-location-dot" style="width:16px;color:var(--text-muted)"></i> ${esc(e.venue || '待定')}</span>
                <span><i class="fas fa-users" style="width:16px;color:var(--text-muted)"></i> ${e.registered_count || 0} / ${e.max_participants || '不限'}</span>
              </div>
              ${e.rules ? `<p class="text-sm mt-2" style="padding:0.75rem;background:var(--surface-2);border-radius:var(--radius);color:var(--text-secondary);line-height:1.6"><strong>規則：</strong>${esc(e.rules)}</p>` : ''}
            </div>
            <div class="card-footer">
              <span class="text-xs text-muted">剩餘名額：<strong style="color:var(--text)">${remaining}</strong></span>
              <button type="button" class="btn btn-sm ${btnClass} btn-register-event" data-event-id="${e.id}" data-event-name="${this._escAttr(e.name)}" ${btnDisabled ? 'disabled' : ''}>${btnText}</button>
            </div>
          </article>`;
      });
      html += '</div></div>';
      c.innerHTML = html;

      c.querySelector('#register-event-grid')?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.btn-register-event');
        if (!btn || btn.disabled) return;
        const id = parseInt(btn.dataset.eventId, 10);
        const name = btn.dataset.eventName || '';
        this._doRegister(id, name);
      });
    } catch (e) {
      c.innerHTML = `<div class="empty-state"><div class="empty-state__icon"><i class="fas fa-exclamation-circle"></i></div><p class="empty-state__desc">載入失敗：${this._escape(e.message)}</p><button type="button" class="btn btn-outline mt-2" id="reg-retry-btn">重新載入</button></div>`;
      document.getElementById('reg-retry-btn')?.addEventListener('click', () => this._renderRegister());
    }
  },

  async _doRegister(eventId, eventName) {
    const ok = await App.confirmDialog(`確認報名「${eventName}」？提交後將進入審核流程。`);
    if (!ok) return;
    App.showLoading();
    try {
      const res = await API.student.submitRegistration(eventId);
      if (res.success) {
        App.showToast(res.message || '報名成功，等待審核', 'success');
        this.currentTab = 'my-registrations';
        document.querySelectorAll('.student-menu-item').forEach(i => {
          i.classList.toggle('active', i.dataset.tab === 'my-registrations');
        });
        this.renderTab();
      } else {
        App.showToast(res.error || '報名失敗', 'error');
        if (this.currentTab === 'register') this._renderRegister();
      }
    } catch (e) {
      App.showToast(e.message || '報名失敗', 'error');
    } finally {
      App.hideLoading();
    }
  },

  // ===== 3. 我的报名 =====
  async _renderMyRegistrations() {
    const c = document.getElementById('student-content');
    c.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      const res = await API.student.getMyRegistrations();
      const regs = res.data || [];
      const statusLabel = s => ({pending:'待审核',approved:'已通过',rejected:'已驳回'})[s]||s;
      const statusBadge = s => ({pending:'badge-pending',approved:'badge-approved',rejected:'badge-rejected'})[s]||'';
      const genderLabel = g => g==='male'?'男子组':g==='female'?'女子组':'混合组';

      if (regs.length === 0) {
        c.innerHTML = '<div class="empty-state"><div class="empty-state__icon"><i class="fas fa-clipboard-list"></i></div><p class="empty-state__desc">暂无报名记录</p><a href="#/student" class="btn btn-primary mt-2" onclick="Student.currentTab=\'register\';Student.renderTab()">去报名</a></div>';
        return;
      }

      let html = '<div class="student-section"><h2 class="student-section-title">我的报名</h2><div class="table-container"><table class="table"><thead><tr><th>项目</th><th>类型</th><th>组别</th><th>时间</th><th>状态</th><th>备注</th><th>操作</th></tr></thead><tbody>';
      regs.forEach(r => {
        html += `<tr>
          <td><strong>${r.event_name||'-'}</strong></td>
          <td>${r.event_type==='team'?'集体':'个人'}</td>
          <td>${genderLabel(r.gender_group)}</td>
          <td>${App.formatDate(r.created_at)}</td>
          <td><span class="badge ${statusBadge(r.status)}">${statusLabel(r.status)}</span></td>
          <td class="text-sm text-muted">${r.reject_reason||''}</td>
          <td>${r.status==='pending'?`<button class="btn btn-danger btn-xs" onclick="Student._cancelReg(${r.id})">取消</button>`:''}</td>
        </tr>`;
      });
      html += '</tbody></table></div></div>';
      c.innerHTML = html;
    } catch (e) {
      c.innerHTML = `<div class="empty-state"><p class="empty-state__desc">加载失败：${e.message}</p></div>`;
    }
  },

  async _cancelReg(id) {
    const ok = await App.confirmDialog('确认取消该报名？');
    if (!ok) return;
    try {
      App.showLoading();
      await API.student.cancelRegistration(id);
      App.hideLoading();
      App.showToast('已取消报名', 'success');
      this._renderMyRegistrations();
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message || '取消失败', 'error');
    }
  },

  // ===== 4. 我的赛程 =====
  async _renderMySchedules() {
    const c = document.getElementById('student-content');
    c.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      const res = await API.student.getMySchedules();
      const data = res.data || [];
      if (data.length === 0) {
        c.innerHTML = '<div class="empty-state"><div class="empty-state__icon"><i class="fas fa-calendar"></i></div><p class="empty-state__desc">暂无参赛赛程，请先报名并等待审核通过</p></div>';
        return;
      }
      let html = '<div class="student-section"><h2 class="student-section-title">我的赛程</h2><div class="table-container"><table class="table"><thead><tr><th>项目</th><th>轮次</th><th>时间</th><th>场地</th></tr></thead><tbody>';
      data.forEach(s => {
        html += `<tr><td><strong>${s.event_name||'-'}</strong></td><td>${s.round_name||'-'}</td><td>${App.formatDate(s.start_time)}</td><td>${s.venue||'待定'}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
      c.innerHTML = html;
    } catch (e) {
      c.innerHTML = `<div class="empty-state"><p class="empty-state__desc">加载失败：${e.message}</p></div>`;
    }
  },

  // ===== 5. 我的成绩 =====
  async _renderMyResults() {
    const c = document.getElementById('student-content');
    c.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      const res = await API.student.getMyResults();
      const data = res.data || [];
      if (data.length === 0) {
        c.innerHTML = '<div class="empty-state"><div class="empty-state__icon"><i class="fas fa-trophy"></i></div><p class="empty-state__desc">暂无成绩，比赛结束后将在此公示</p></div>';
        return;
      }
      const medals = {1:'🥇',2:'🥈',3:'🥉'};
      let html = '<div class="student-section"><h2 class="student-section-title">我的成绩</h2><div class="table-container"><table class="table"><thead><tr><th>排名</th><th>项目</th><th>成绩</th><th>奖项</th></tr></thead><tbody>';
      data.forEach(r => {
        html += `<tr class="${r.rank<=3?'award-row':''}"><td>${medals[r.rank]||r.rank||'-'}</td><td><strong>${r.event_name||'-'}</strong></td><td>${r.performance||'-'}</td><td><span class="badge badge-success">${App.getAwardLabel(r.award)}</span></td></tr>`;
      });
      html += '</tbody></table></div></div>';
      c.innerHTML = html;
    } catch (e) {
      c.innerHTML = `<div class="empty-state"><p class="empty-state__desc">加载失败：${e.message}</p></div>`;
    }
  },

  // ===== 6. 班级成绩 =====
  async _renderClassResults() {
    const c = document.getElementById('student-content');
    c.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      const res = await API.student.getMyResults(); // reuse endpoint
      const data = (res.data || []);
      if (data.length === 0) {
        c.innerHTML = '<div class="empty-state"><div class="empty-state__icon"><i class="fas fa-users"></i></div><p class="empty-state__desc">暂无班级成绩数据</p></div>';
        return;
      }
      // 按班级聚合
      const classMap = {};
      data.forEach(r => {
        const cn = r.class_name || '未知';
        if (!classMap[cn]) classMap[cn] = {total:0,awards:0,students:new Set()};
        classMap[cn].total++;
        if (r.award) classMap[cn].awards++;
        if (r.name) classMap[cn].students.add(r.name);
      });
      const sorted = Object.entries(classMap).sort((a,b) => b[1].awards - a[1].awards);
      const medals = ['🥇','🥈','🥉'];
      let html = '<div class="student-section"><h2 class="student-section-title">班级成绩排名</h2><div class="table-container"><table class="table"><thead><tr><th>排名</th><th>班级</th><th>参赛人次</th><th>获奖数</th><th>参赛人数</th></tr></thead><tbody>';
      sorted.forEach(([cn,info],i) => {
        html += `<tr><td>${i<3?medals[i]:i+1}</td><td><strong>${cn}</strong></td><td>${info.total}</td><td>${info.awards}</td><td>${info.students.size}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
      c.innerHTML = html;
    } catch (e) {
      c.innerHTML = `<div class="empty-state"><p class="empty-state__desc">加载失败：${e.message}</p></div>`;
    }
  },

  // ===== 7. 公告通知 =====
  async _renderMyAnnouncements() {
    const c = document.getElementById('student-content');
    c.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      const res = await API.get('/public/announcements');
      const data = res.data || [];
      const catLabels = {event:'赛事通知',registration:'报名截止',result:'成绩公示',urgent:'紧急通知',general:'一般公告'};
      if (data.length === 0) {
        c.innerHTML = '<div class="empty-state"><div class="empty-state__icon"><i class="fas fa-bullhorn"></i></div><p class="empty-state__desc">暂无公告</p></div>';
        return;
      }
      let html = '<div class="student-section"><h2 class="student-section-title">公告通知</h2>';
      data.forEach(a => {
        html += `
          <div class="announcement-card card ${a.is_pinned?'pinned':''}">
            <div class="card-header">
              <h3>${a.is_pinned?'📌 ':''}${a.title}</h3>
              <span class="badge badge-${a.category}">${catLabels[a.category]||a.category}</span>
            </div>
            <div class="card-body"><p class="announcement-preview">${(a.content||'').substring(0,150)}...</p></div>
            <div class="card-footer">
              <span class="text-sm text-muted">${App.formatDate(a.publish_time)} · ${a.view_count||0}次阅读</span>
              <button class="btn btn-outline btn-sm" onclick="App.showAnnouncementDetail(${a.id})">查看详情</button>
            </div>
          </div>`;
      });
      html += '</div>';
      c.innerHTML = html;
    } catch (e) {
      c.innerHTML = `<div class="empty-state"><p class="empty-state__desc">加载失败：${e.message}</p></div>`;
    }
  },

  _escape(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  _escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
};
