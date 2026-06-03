const Teacher = {
  profile: null,
  currentTab: 'overview',
  selectedEventId: null,
  latestResultsEntry: null,

  async render() {
    const page = document.getElementById('page-teacher');
    if (!page) return;
    page.innerHTML = `
      <div class="teacher-layout">
        <aside class="teacher-sidebar">
          <div class="teacher-sidebar__header">
            <h3>教师端</h3>
            <p id="teacher-sidebar-meta">加载中...</p>
          </div>
          <div class="teacher-sidebar__menu" id="teacher-sidebar-menu"></div>
        </aside>
        <section class="teacher-content" id="teacher-content">
          <div class="text-center p-8"><div class="spinner"></div></div>
        </section>
      </div>
    `;

    try {
      const res = await API.teacher.getProfile();
      if (!res.success || !res.data) throw new Error(res.error || '教师资料加载失败');
      this.profile = {
        ...res.data,
        assigned_event_ids: this._parseAssignedEventIds(res.data.assigned_event_ids)
      };
      this.currentTab = this.profile.staff_type === 'event_teacher' ? 'results' : 'overview';
      this._renderSidebar();
      await this._renderCurrentTab();
    } catch (e) {
      document.getElementById('teacher-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fas fa-user-shield"></i></div>
          <p class="empty-state__desc">${App._escHtml(e.message || '教师资料加载失败')}</p>
        </div>
      `;
    }
  },

  _parseAssignedEventIds(value) {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter(Boolean) : [];
    } catch (_) {
      return String(value || '')
        .split(',')
        .map((item) => Number(item.trim()))
        .filter(Boolean);
    }
  },

  _renderSidebar() {
    const meta = document.getElementById('teacher-sidebar-meta');
    const menu = document.getElementById('teacher-sidebar-menu');
    if (!meta || !menu || !this.profile) return;

    const label = this.profile.staff_type === 'homeroom_teacher' ? '班主任' : '任课教师';
    meta.textContent = `${this.profile.name || this.profile.username} · ${label}`;

    const items = this.profile.staff_type === 'homeroom_teacher'
      ? [
          { key: 'overview', label: '班级总览', icon: 'fa-chart-pie' },
          { key: 'registrations', label: '报名审核', icon: 'fa-clipboard-check' }
        ]
      : [
          { key: 'assignments', label: '项目分配', icon: 'fa-list-check' },
          { key: 'results', label: '成绩录入', icon: 'fa-pen-to-square' }
        ];

    menu.innerHTML = items.map((item) => `
      <button type="button" class="teacher-menu-item ${this.currentTab === item.key ? 'active' : ''}" data-tab="${item.key}">
        <i class="fas ${item.icon}"></i>
        <span>${item.label}</span>
      </button>
    `).join('');

    menu.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', async () => {
        this.currentTab = button.dataset.tab;
        this._renderSidebar();
        await this._renderCurrentTab();
      });
    });
  },

  async _renderCurrentTab() {
    if (this.profile?.staff_type === 'homeroom_teacher') {
      if (this.currentTab === 'registrations') return this._renderHomeroomRegistrations();
      return this._renderHomeroomOverview();
    }
    if (this.currentTab === 'assignments') return this._renderAssignments();
    return this._renderResultsEntry();
  },

  async _renderHomeroomOverview() {
    const content = document.getElementById('teacher-content');
    if (!content) return;
    content.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      const res = await API.teacher.getHomeroomOverview();
      if (!res.success) throw new Error(res.error || '班级总览加载失败');
      const data = res.data || {};
      const summary = data.summary || {};
      const students = data.students || [];
      const pending = data.pending_registrations || [];
      content.innerHTML = `
        <div class="teacher-shell">
          <div class="teacher-hero card">
            <div class="card__header">
              <div>
                <h3 class="card__title">班级总览</h3>
                <p class="teacher-hero__meta">${App._escHtml(data.profile?.managed_grade || '')} ${App._escHtml(data.profile?.managed_class_name || '')}</p>
              </div>
              <button type="button" class="btn btn-outline btn-sm" id="teacher-refresh-overview">刷新</button>
            </div>
            <div class="card__body">
              <div class="teacher-summary-grid">
                <div class="teacher-summary-card"><strong>${summary.student_count || 0}</strong><span>班级学生</span></div>
                <div class="teacher-summary-card"><strong>${summary.pending_registration_count || 0}</strong><span>待审报名</span></div>
                <div class="teacher-summary-card"><strong>${summary.approved_registration_count || 0}</strong><span>已通过报名</span></div>
                <div class="teacher-summary-card"><strong>${summary.result_count || 0}</strong><span>成绩记录</span></div>
              </div>
            </div>
          </div>

          <div class="card mt-2">
            <div class="card__header">
              <h3 class="card__title">待班主任审核</h3>
              <span class="text-sm text-muted">${pending.length} 条</span>
            </div>
            <div class="card__body">
              ${pending.length ? `
                <div class="table-container">
                  <table class="table table--striped">
                    <thead><tr><th>学生</th><th>年级班级</th><th>项目</th><th>提交时间</th><th>操作</th></tr></thead>
                    <tbody>
                      ${pending.map((item) => `
                        <tr>
                          <td>${App._escHtml(item.user_name || '-')}<br><small class="text-muted">${App._escHtml(item.student_id || '-')}</small></td>
                          <td>${App._escHtml(item.grade || '-')}<br><small class="text-muted">${App._escHtml(item.class_name || '-')}</small></td>
                          <td>${App._escHtml(item.event_name || '-')}</td>
                          <td>${App.formatDate(item.created_at)}</td>
                          <td>
                            <div class="teacher-table-actions">
                              <button type="button" class="btn btn-primary btn-sm" data-review-id="${item.id}" data-review-action="approve">通过</button>
                              <button type="button" class="btn btn-outline btn-sm" data-review-id="${item.id}" data-review-action="reject">驳回</button>
                            </div>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<div class="empty-state"><p class="empty-state__desc">当前没有待审核报名</p></div>'}
            </div>
          </div>

          <div class="card mt-2">
            <div class="card__header">
              <h3 class="card__title">班级学业数据</h3>
              <span class="text-sm text-muted">${students.length} 人</span>
            </div>
            <div class="card__body">
              ${students.length ? `
                <div class="table-container">
                  <table class="table table--striped">
                    <thead><tr><th>学生</th><th>学号</th><th>班级</th><th>报名数</th><th>待审数</th><th>已通过</th><th>成绩数</th></tr></thead>
                    <tbody>
                      ${students.map((item) => `
                        <tr>
                          <td>${App._escHtml(item.name || '-')}</td>
                          <td>${App._escHtml(item.student_id || '-')}</td>
                          <td>${App._escHtml(item.grade || '-')} ${App._escHtml(item.class_name || '-')}</td>
                          <td>${item.registration_count || 0}</td>
                          <td>${item.pending_registration_count || 0}</td>
                          <td>${item.approved_registration_count || 0}</td>
                          <td>${item.result_count || 0}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<div class="empty-state"><p class="empty-state__desc">当前班级暂无学生数据</p></div>'}
            </div>
          </div>
        </div>
      `;
      document.getElementById('teacher-refresh-overview')?.addEventListener('click', () => this._renderHomeroomOverview());
      this._bindReviewButtons(false);
    } catch (e) {
      content.innerHTML = `<div class="empty-state"><p class="empty-state__desc">${App._escHtml(e.message || '班级总览加载失败')}</p></div>`;
    }
  },

  async _renderHomeroomRegistrations() {
    const content = document.getElementById('teacher-content');
    if (!content) return;
    content.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      const res = await API.teacher.getHomeroomRegistrations();
      if (!res.success) throw new Error(res.error || '报名列表加载失败');
      const rows = res.data || [];
      content.innerHTML = `
        <div class="teacher-shell">
          <div class="card">
            <div class="card__header">
              <div>
                <h3 class="card__title">班级报名审核</h3>
                <p class="teacher-hero__meta">仅展示当前班主任负责班级的报名记录与取消申请</p>
              </div>
              <button type="button" class="btn btn-outline btn-sm" id="teacher-refresh-registrations">刷新</button>
            </div>
            <div class="card__body">
              ${rows.length ? `
                <div class="table-container">
                  <table class="table table--striped">
                    <thead><tr><th>学生</th><th>项目</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
                    <tbody>
                      ${rows.map((item) => {
                        const isCancel = item.status === 'cancelling';
                        return `
                          <tr>
                            <td>${App._escHtml(item.user_name || '-')}<br><small class="text-muted">${App._escHtml(item.grade || '-')} ${App._escHtml(item.class_name || '-')}</small></td>
                            <td>${App._escHtml(item.event_name || '-')}</td>
                            <td><span class="badge ${isCancel ? 'badge-warning' : item.status === 'approved' ? 'badge-approved' : item.status === 'rejected' ? 'badge-rejected' : 'badge-pending'}">${App._escHtml(this._statusLabel(item.status))}</span></td>
                            <td>${App.formatDate(item.reviewed_at || item.created_at)}</td>
                            <td>
                              ${this._renderRegistrationActions(item)}
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<div class="empty-state"><p class="empty-state__desc">当前没有需要处理的报名记录</p></div>'}
            </div>
          </div>
        </div>
      `;
      document.getElementById('teacher-refresh-registrations')?.addEventListener('click', () => this._renderHomeroomRegistrations());
      this._bindReviewButtons(true);
    } catch (e) {
      content.innerHTML = `<div class="empty-state"><p class="empty-state__desc">${App._escHtml(e.message || '报名列表加载失败')}</p></div>`;
    }
  },

  _renderRegistrationActions(item) {
    if (item.status !== 'pending' && item.status !== 'cancelling') {
      return `<span class="text-sm text-muted">${App._escHtml(item.reject_reason || '已处理')}</span>`;
    }
    const reviewType = item.status === 'cancelling' ? 'cancel' : 'registration';
    return `
      <div class="teacher-table-actions">
        <button type="button" class="btn btn-primary btn-sm" data-review-id="${item.id}" data-review-action="approve" data-review-type="${reviewType}">通过</button>
        <button type="button" class="btn btn-outline btn-sm" data-review-id="${item.id}" data-review-action="reject" data-review-type="${reviewType}">驳回</button>
      </div>
    `;
  },

  _statusLabel(status) {
    return {
      pending: '待审核',
      approved: '已通过',
      rejected: '已驳回',
      cancelling: '取消申请中'
    }[status] || status || '-';
  },

  _bindReviewButtons(includeCancel) {
    document.querySelectorAll('[data-review-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = Number(button.dataset.reviewId || 0);
        const action = button.dataset.reviewAction || 'approve';
        const isCancel = includeCancel && button.dataset.reviewType === 'cancel';
        await this._submitRegistrationReview(id, action, isCancel);
      });
    });
  },

  async _submitRegistrationReview(id, action, isCancel) {
    if (!id) return;
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt(isCancel ? '请输入驳回取消申请的原因（可选）' : '请输入驳回报名的原因（可选）', '') || '';
    }
    const confirmed = await App.confirmDialog(action === 'approve' ? '确认通过这条申请吗？' : '确认驳回这条申请吗？');
    if (!confirmed) return;
    try {
      App.showLoading();
      const res = isCancel
        ? await API.teacher.reviewCancelRegistration(id, { action, reason })
        : await API.teacher.reviewRegistration(id, { action, reason });
      App.hideLoading();
      if (!res.success) throw new Error(res.error || '提交审核失败');
      App.showToast(res.message || '处理成功', 'success');
      await this._renderCurrentTab();
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message || '提交审核失败', 'error');
    }
  },

  async _renderAssignments() {
    const content = document.getElementById('teacher-content');
    if (!content) return;
    content.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      const res = await API.teacher.getAssignments();
      if (!res.success) throw new Error(res.error || '项目分配加载失败');
      const events = res.data?.events || [];
      content.innerHTML = `
        <div class="teacher-shell">
          <div class="card">
            <div class="card__header">
              <div>
                <h3 class="card__title">任课教师项目分配</h3>
                <p class="teacher-hero__meta">系统已自动关联当前教师可录入的项目范围</p>
              </div>
            </div>
            <div class="card__body">
              ${events.length ? `
                <div class="teacher-card-grid">
                  ${events.map((event) => `
                    <article class="teacher-event-card">
                      <h4>${App._escHtml(event.name || '-')}</h4>
                      <p>${App._escHtml(event.category || '-')} · ${App._escHtml(event.gender_group || '-')}</p>
                      <div class="teacher-event-card__meta">
                        <span>${event.schedule_count || 0} 场赛程</span>
                        <span>${event.participant_count || 0} 名选手</span>
                      </div>
                    </article>
                  `).join('')}
                </div>
              ` : '<div class="empty-state"><p class="empty-state__desc">当前教师尚未分配录入项目</p></div>'}
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      content.innerHTML = `<div class="empty-state"><p class="empty-state__desc">${App._escHtml(e.message || '项目分配加载失败')}</p></div>`;
    }
  },

  async _renderResultsEntry() {
    const content = document.getElementById('teacher-content');
    if (!content) return;
    content.innerHTML = '<div class="text-center p-8"><div class="spinner"></div></div>';
    try {
      const assignmentRes = await API.teacher.getAssignments();
      if (!assignmentRes.success) throw new Error(assignmentRes.error || '项目分配加载失败');
      const events = assignmentRes.data?.events || [];
      const activeEventId = Number(this.selectedEventId || events[0]?.id || 0);
      this.selectedEventId = activeEventId || null;
      let entryData = null;
      if (activeEventId) {
        const entryRes = await API.teacher.getResultsEntry({ event_id: activeEventId });
        if (!entryRes.success) throw new Error(entryRes.error || '成绩录入数据加载失败');
        entryData = entryRes.data || {};
      }
      this.latestResultsEntry = entryData;

      content.innerHTML = `
        <div class="teacher-shell">
          <div class="card">
            <div class="card__header">
              <div>
                <h3 class="card__title">成绩录入</h3>
                <p class="teacher-hero__meta">任课教师可直接在系统内批量保存成绩并控制公示状态</p>
              </div>
              <div class="teacher-toolbar">
                <select id="teacher-event-selector" class="form__select">
                  ${events.map((event) => `<option value="${event.id}"${Number(event.id) === activeEventId ? ' selected' : ''}>${App._escHtml(event.name || '-')} (${App._escHtml(event.gender_group || '-')}组)</option>`).join('')}
                </select>
                <button type="button" class="btn btn-primary btn-sm" id="teacher-save-results-btn"${activeEventId ? '' : ' disabled'}>保存成绩</button>
              </div>
            </div>
            <div class="card__body">
              ${activeEventId && entryData ? this._renderResultsTable(entryData) : '<div class="empty-state"><p class="empty-state__desc">当前没有可录入的项目，请先在后台分配教师项目</p></div>'}
            </div>
          </div>
        </div>
      `;

      document.getElementById('teacher-event-selector')?.addEventListener('change', async (e) => {
        this.selectedEventId = Number(e.target.value || 0);
        await this._renderResultsEntry();
      });
      document.getElementById('teacher-save-results-btn')?.addEventListener('click', async () => {
        await this._submitResultsBatch();
      });
    } catch (e) {
      content.innerHTML = `<div class="empty-state"><p class="empty-state__desc">${App._escHtml(e.message || '成绩录入页面加载失败')}</p></div>`;
    }
  },

  _renderResultsTable(entryData) {
    const participants = entryData?.participants || [];
    if (!participants.length) {
      return '<div class="empty-state"><p class="empty-state__desc">当前项目暂无已审核参赛学生</p></div>';
    }
    return `
      <div class="teacher-results-meta">
        <span>赛程数量：${(entryData.schedules || []).length}</span>
        <span>参赛人数：${participants.length}</span>
      </div>
      <div class="table-container">
        <table class="table table--striped teacher-results-table">
          <thead>
            <tr>
              <th>轮次</th>
              <th>学生</th>
              <th>学号</th>
              <th>班级</th>
              <th>成绩</th>
              <th>名次</th>
              <th>奖项</th>
              <th>备注</th>
              <th>公示</th>
            </tr>
          </thead>
          <tbody>
            ${participants.map((item, index) => `
              <tr data-row-index="${index}" data-schedule-id="${item.schedule_id}" data-user-id="${item.user_id}">
                <td>${App._escHtml(item.round_name || '-')}</td>
                <td>${App._escHtml(item.student_name || '-')}</td>
                <td>${App._escHtml(item.student_id || '-')}</td>
                <td>${App._escHtml(item.grade || '-')} ${App._escHtml(item.class_name || '-')}</td>
                <td><input type="text" class="form__input form__input--compact" data-field="performance" value="${App._escAttr(item.performance || '')}" placeholder="成绩"></td>
                <td><input type="number" class="form__input form__input--compact" data-field="rank" value="${Number(item.rank || 0) || ''}" min="0" placeholder="名次"></td>
                <td>
                  <select class="form__select form__select--compact" data-field="award">
                    <option value="">无</option>
                    <option value="第一名"${item.award === '第一名' ? ' selected' : ''}>第一名</option>
                    <option value="第二名"${item.award === '第二名' ? ' selected' : ''}>第二名</option>
                    <option value="第三名"${item.award === '第三名' ? ' selected' : ''}>第三名</option>
                    <option value="优秀"${item.award === '优秀' ? ' selected' : ''}>优秀</option>
                    <option value="团体"${item.award === '团体' ? ' selected' : ''}>团体</option>
                  </select>
                </td>
                <td><input type="text" class="form__input form__input--compact" data-field="note" value="${App._escAttr(item.note || '')}" placeholder="备注"></td>
                <td><label class="teacher-checkbox"><input type="checkbox" data-field="is_published"${Number(item.is_published) ? ' checked' : ''}><span>公示</span></label></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async _submitResultsBatch() {
    const rows = Array.from(document.querySelectorAll('.teacher-results-table tbody tr'));
    if (!rows.length) return;
    const items = rows.map((row) => ({
      schedule_id: Number(row.dataset.scheduleId || 0),
      user_id: Number(row.dataset.userId || 0),
      performance: row.querySelector('[data-field="performance"]')?.value || '',
      rank: Number(row.querySelector('[data-field="rank"]')?.value || 0),
      award: row.querySelector('[data-field="award"]')?.value || '',
      note: row.querySelector('[data-field="note"]')?.value || '',
      is_published: row.querySelector('[data-field="is_published"]')?.checked ? 1 : 0
    }));
    try {
      App.showLoading();
      const res = await API.teacher.batchSaveResults({ items });
      App.hideLoading();
      if (!res.success) throw new Error(res.error || '成绩保存失败');
      App.showToast(res.message || '成绩已保存', 'success');
      await this._renderResultsEntry();
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message || '成绩保存失败', 'error');
    }
  }
};

window.Teacher = Teacher;
