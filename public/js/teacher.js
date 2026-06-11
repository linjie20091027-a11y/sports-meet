const Teacher = {
  profile: null,
  currentTab: 'overview',
  selectedEventId: null,
  latestResultsEntry: null,
  resultsEntryFilters: {
    class_name: '',
    round_name: '',
    keyword: ''
  },
  homeroomRegistrationFilters: {
    status: '',
    event_id: '',
    student_keyword: '',
    match_mode: 'fuzzy'
  },
  homeroomOverviewFilters: {
    event_id: '',
    student_keyword: '',
    match_mode: 'fuzzy'
  },
  _homeroomRegistrationFilterTimer: null,
  _homeroomOverviewFilterTimer: null,
  _resultsEntryFilterTimer: null,

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
      const res = await API.teacher.getHomeroomOverview(this.homeroomOverviewFilters);
      if (!res.success) throw new Error(res.error || '班级总览加载失败');
      const data = res.data || {};
      const summary = data.summary || {};
      const students = data.students || [];
      const pending = data.pending_registrations || [];
      const resultRows = Array.isArray(data.result_rows) ? data.result_rows : [];
      const resultFilters = data.result_filters || this.homeroomOverviewFilters;
      const resultEvents = Array.isArray(data.result_events) ? data.result_events : [];
      const resultStats = Array.isArray(data.result_event_stats) ? data.result_event_stats : [];
      const resultSummary = data.result_summary || {};
      this.homeroomOverviewFilters = {
        event_id: resultFilters.event_id ? String(resultFilters.event_id) : '',
        student_keyword: resultFilters.student_keyword || '',
        match_mode: resultFilters.match_mode === 'exact' ? 'exact' : 'fuzzy'
      };
      const averageScoreText = resultSummary.average_score !== null && resultSummary.average_score !== undefined
        ? Number(resultSummary.average_score).toFixed(2)
        : '-';
      content.innerHTML = `
        <div class="teacher-shell">
          <div class="teacher-hero card">
            <div class="card__header">
              <div>
                <h3 class="card__title">班级总览</h3>
                <p class="teacher-hero__meta">${App._escHtml(data.profile?.managed_class_name || '')}</p>
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

          <div class="card mt-2">
            <div class="card__header">
              <div>
                <h3 class="card__title">班级项目成绩</h3>
                <p class="teacher-hero__meta">支持按项目、学生姓名或学号进行精确/模糊筛选，并导出当前结果</p>
              </div>
              <div class="teacher-table-actions">
                <button type="button" class="btn btn-outline btn-sm" id="teacher-refresh-overview-results">刷新成绩</button>
                <button type="button" class="btn btn-primary btn-sm" id="teacher-export-overview-results">导出 Excel</button>
              </div>
            </div>
            <div class="card__body">
              <div class="teacher-filter-grid">
                <div class="form__group">
                  <label class="form__label">项目筛选</label>
                  <select class="form__select" id="teacher-overview-event-filter">
                    <option value="">全部项目</option>
                    ${resultEvents.map((item) => `
                      <option value="${item.id}" ${String(item.id) === String(this.homeroomOverviewFilters.event_id || '') ? 'selected' : ''}>${App._escHtml(item.name || '-')}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form__group">
                  <label class="form__label">学生检索</label>
                  <input class="form__input" id="teacher-overview-keyword-filter" placeholder="输入学生姓名或学号" value="${App._escAttr(this.homeroomOverviewFilters.student_keyword || '')}">
                </div>
                <div class="form__group">
                  <label class="form__label">查询模式</label>
                  <select class="form__select" id="teacher-overview-match-filter">
                    <option value="fuzzy" ${this.homeroomOverviewFilters.match_mode !== 'exact' ? 'selected' : ''}>模糊匹配</option>
                    <option value="exact" ${this.homeroomOverviewFilters.match_mode === 'exact' ? 'selected' : ''}>精确匹配</option>
                  </select>
                </div>
                <div class="form__group">
                  <label class="form__label">结果概览</label>
                  <div class="teacher-inline-meta">
                    <span>成绩 ${resultSummary.total_results || 0} 条</span>
                    <span>项目 ${resultSummary.event_count || 0} 个</span>
                    <span>均分 ${App._escHtml(averageScoreText)}</span>
                  </div>
                </div>
              </div>

              <div class="teacher-summary-grid">
                <div class="teacher-summary-card"><strong>${resultSummary.total_results || 0}</strong><span>成绩条数</span></div>
                <div class="teacher-summary-card"><strong>${resultSummary.student_count || 0}</strong><span>涉及学生</span></div>
                <div class="teacher-summary-card"><strong>${averageScoreText}</strong><span>平均分</span></div>
                <div class="teacher-summary-card"><strong>${resultSummary.ranking_count || 0}</strong><span>有排名成绩</span></div>
              </div>

              <div class="card mt-2 teacher-subcard">
                <div class="card__header">
                  <h4 class="card__title">项目统计</h4>
                  <span class="text-sm text-muted">${resultStats.length} 项</span>
                </div>
                <div class="card__body">
                  ${resultStats.length ? `
                    <div class="table-container">
                      <table class="table table--striped">
                        <thead><tr><th>项目</th><th>类别</th><th>成绩人数</th><th>有排名人数</th><th>平均分</th><th>最高分</th></tr></thead>
                        <tbody>
                          ${resultStats.map((item) => `
                            <tr>
                              <td>${App._escHtml(item.event_name || '-')}</td>
                              <td>${App._escHtml(item.category || '-')}</td>
                              <td>${item.result_count || 0}</td>
                              <td>${item.ranking_count || 0}</td>
                              <td>${item.average_score !== null && item.average_score !== undefined ? App._escHtml(Number(item.average_score).toFixed(2)) : '-'}</td>
                              <td>${item.best_score !== null && item.best_score !== undefined ? App._escHtml(Number(item.best_score).toFixed(2)) : '-'}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  ` : '<div class="empty-state"><p class="empty-state__desc">当前筛选条件下暂无项目成绩统计</p></div>'}
                </div>
              </div>

              <div class="card mt-2 teacher-subcard">
                <div class="card__header">
                  <h4 class="card__title">成绩明细</h4>
                  <span class="text-sm text-muted">${resultRows.length} 条</span>
                </div>
                <div class="card__body">
                  ${resultRows.length ? `
                    <div class="table-container">
                      <table class="table table--striped">
                        <thead><tr><th>学生</th><th>学号</th><th>项目</th><th>轮次</th><th>成绩</th><th>分数</th><th>项目均分</th><th>班内排名</th><th>项目排名</th><th>奖项</th></tr></thead>
                        <tbody>
                          ${resultRows.map((item) => `
                            <tr>
                              <td>${App._escHtml(item.user_name || '-')}</td>
                              <td>${App._escHtml(item.student_id || '-')}</td>
                              <td>${App._escHtml(item.event_name || '-')}</td>
                              <td>${App._escHtml(item.round_name || '-')}</td>
                              <td>${App._escHtml(item.performance || '-')}</td>
                              <td>${item.score !== null && item.score !== undefined ? App._escHtml(Number(item.score).toFixed(2)) : '-'}</td>
                              <td>${item.event_avg_score !== null && item.event_avg_score !== undefined ? App._escHtml(Number(item.event_avg_score).toFixed(2)) : '-'}</td>
                              <td>${item.class_rank || '-'}</td>
                              <td>${item.rank || '-'}</td>
                              <td>${App._escHtml(item.award || '-')}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  ` : '<div class="empty-state"><p class="empty-state__desc">当前筛选条件下暂无成绩数据</p></div>'}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.getElementById('teacher-refresh-overview')?.addEventListener('click', () => this._renderHomeroomOverview());
      document.getElementById('teacher-refresh-overview-results')?.addEventListener('click', () => this._renderHomeroomOverview());
      this._bindHomeroomOverviewFilters();
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
      const res = await API.teacher.getHomeroomRegistrations(this.homeroomRegistrationFilters);
      if (!res.success) throw new Error(res.error || '报名列表加载失败');
      const payload = res.data || {};
      const rows = Array.isArray(payload.list) ? payload.list : [];
      const filterState = payload.filters || this.homeroomRegistrationFilters;
      const events = Array.isArray(payload.events) ? payload.events : [];
      this.homeroomRegistrationFilters = {
        status: filterState.status || '',
        event_id: filterState.event_id ? String(filterState.event_id) : '',
        student_keyword: filterState.student_keyword || '',
        match_mode: filterState.match_mode === 'exact' ? 'exact' : 'fuzzy'
      };
      const selectedIds = rows
        .filter((item) => item.status === 'pending' || item.status === 'cancelling')
        .map((item) => Number(item.id))
        .filter(Boolean);
      const pendingCount = rows.filter((item) => item.status === 'pending').length;
      const cancellingCount = rows.filter((item) => item.status === 'cancelling').length;
      content.innerHTML = `
        <div class="teacher-shell">
          <div class="card">
            <div class="card__header">
              <div>
                <h3 class="card__title">班级报名审核</h3>
                <p class="teacher-hero__meta">仅展示当前班主任负责班级的报名记录与取消申请</p>
              </div>
              <div class="teacher-toolbar">
                <button type="button" class="btn btn-outline btn-sm" id="teacher-clear-registration-filters">重置筛选</button>
                <button type="button" class="btn btn-outline btn-sm" id="teacher-refresh-registrations">刷新</button>
              </div>
            </div>
            <div class="card__body">
              <div class="teacher-filter-grid">
                <div class="form__group">
                  <label class="form__label">审核状态</label>
                  <select class="form__select" id="teacher-registration-status-filter">
                    <option value="">全部状态</option>
                    <option value="pending"${this.homeroomRegistrationFilters.status === 'pending' ? ' selected' : ''}>待审核</option>
                    <option value="cancelling"${this.homeroomRegistrationFilters.status === 'cancelling' ? ' selected' : ''}>取消申请中</option>
                    <option value="approved"${this.homeroomRegistrationFilters.status === 'approved' ? ' selected' : ''}>已通过</option>
                    <option value="rejected"${this.homeroomRegistrationFilters.status === 'rejected' ? ' selected' : ''}>已驳回</option>
                  </select>
                </div>
                <div class="form__group">
                  <label class="form__label">项目筛选</label>
                  <select class="form__select" id="teacher-registration-event-filter">
                    <option value="">全部项目</option>
                    ${events.map((event) => `<option value="${event.id}"${String(event.id) === this.homeroomRegistrationFilters.event_id ? ' selected' : ''}>${App._escHtml(event.name || '-')}</option>`).join('')}
                  </select>
                </div>
                <div class="form__group">
                  <label class="form__label">学生检索</label>
                  <input class="form__input" id="teacher-registration-keyword-filter" value="${App._escAttr(this.homeroomRegistrationFilters.student_keyword)}" placeholder="输入学号、姓名或项目名">
                </div>
                <div class="form__group">
                  <label class="form__label">查询模式</label>
                  <select class="form__select" id="teacher-registration-match-filter">
                    <option value="fuzzy"${this.homeroomRegistrationFilters.match_mode === 'fuzzy' ? ' selected' : ''}>模糊匹配</option>
                    <option value="exact"${this.homeroomRegistrationFilters.match_mode === 'exact' ? ' selected' : ''}>精确查询</option>
                  </select>
                </div>
              </div>
              <div class="teacher-batch-toolbar">
                <div class="teacher-batch-toolbar__meta">
                  <strong>当前结果 ${rows.length} 条</strong>
                  <span>待报名审核 ${pendingCount} 条，取消申请 ${cancellingCount} 条</span>
                </div>
                <div class="teacher-table-actions">
                  <button type="button" class="btn btn-outline btn-sm" id="teacher-select-all-registrations"${selectedIds.length ? '' : ' disabled'}>全选当前可处理项</button>
                  <button type="button" class="btn btn-primary btn-sm" id="teacher-batch-approve-registrations"${selectedIds.length ? '' : ' disabled'}>批量通过报名</button>
                  <button type="button" class="btn btn-outline btn-sm" id="teacher-batch-reject-registrations"${selectedIds.length ? '' : ' disabled'}>批量驳回报名</button>
                  <button type="button" class="btn btn-primary btn-sm" id="teacher-batch-approve-cancel"${cancellingCount ? '' : ' disabled'}>批量批准取消</button>
                  <button type="button" class="btn btn-outline btn-sm" id="teacher-batch-reject-cancel"${cancellingCount ? '' : ' disabled'}>批量驳回取消</button>
                </div>
              </div>
              ${rows.length ? `
                <div class="table-container">
                  <table class="table table--striped">
                    <thead><tr><th><input type="checkbox" id="teacher-registration-check-all"></th><th>学生</th><th>项目</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
                    <tbody>
                      ${rows.map((item) => {
                        const isCancel = item.status === 'cancelling';
                        const canReview = item.status === 'pending' || item.status === 'cancelling';
                        return `
                          <tr>
                            <td><input type="checkbox" class="teacher-registration-checkbox" data-registration-id="${item.id}" data-registration-status="${App._escAttr(item.status)}"${canReview ? '' : ' disabled'}></td>
                            <td>${App._escHtml(item.user_name || '-')}<br><small class="text-muted">${App._escHtml(item.grade || '-')} ${App._escHtml(item.class_name || '-')}</small></td>
                            <td>${App._escHtml(item.event_name || '-')}<br><small class="text-muted">${App._escHtml(item.student_id || '-')}</small></td>
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
      document.getElementById('teacher-clear-registration-filters')?.addEventListener('click', async () => {
        this.homeroomRegistrationFilters = { status: '', event_id: '', student_keyword: '', match_mode: 'fuzzy' };
        await this._renderHomeroomRegistrations();
      });
      this._bindHomeroomRegistrationFilters();
      this._bindHomeroomRegistrationBatchActions();
      this._bindReviewButtons(true);
    } catch (e) {
      content.innerHTML = `<div class="empty-state"><p class="empty-state__desc">${App._escHtml(e.message || '报名列表加载失败')}</p></div>`;
    }
  },

  _bindHomeroomRegistrationFilters() {
    const syncAndReload = async (partial = {}, useDebounce = false) => {
      this.homeroomRegistrationFilters = {
        ...this.homeroomRegistrationFilters,
        ...partial
      };
      if (!useDebounce) {
        await this._renderHomeroomRegistrations();
        return;
      }
      clearTimeout(this._homeroomRegistrationFilterTimer);
      this._homeroomRegistrationFilterTimer = setTimeout(() => {
        this._renderHomeroomRegistrations();
      }, 220);
    };
    document.getElementById('teacher-registration-status-filter')?.addEventListener('change', (e) => {
      syncAndReload({ status: e.target.value || '' });
    });
    document.getElementById('teacher-registration-event-filter')?.addEventListener('change', (e) => {
      syncAndReload({ event_id: e.target.value || '' });
    });
    document.getElementById('teacher-registration-match-filter')?.addEventListener('change', (e) => {
      syncAndReload({ match_mode: e.target.value === 'exact' ? 'exact' : 'fuzzy' });
    });
    document.getElementById('teacher-registration-keyword-filter')?.addEventListener('input', (e) => {
      syncAndReload({ student_keyword: e.target.value.trim() }, true);
    });
  },

  _bindHomeroomOverviewFilters() {
    const syncAndReload = async (partial = {}, useDebounce = false) => {
      this.homeroomOverviewFilters = {
        ...this.homeroomOverviewFilters,
        ...partial
      };
      if (!useDebounce) {
        await this._renderHomeroomOverview();
        return;
      }
      clearTimeout(this._homeroomOverviewFilterTimer);
      this._homeroomOverviewFilterTimer = setTimeout(() => {
        this._renderHomeroomOverview();
      }, 220);
    };
    document.getElementById('teacher-overview-event-filter')?.addEventListener('change', (e) => {
      syncAndReload({ event_id: e.target.value || '' });
    });
    document.getElementById('teacher-overview-match-filter')?.addEventListener('change', (e) => {
      syncAndReload({ match_mode: e.target.value === 'exact' ? 'exact' : 'fuzzy' });
    });
    document.getElementById('teacher-overview-keyword-filter')?.addEventListener('input', (e) => {
      syncAndReload({ student_keyword: e.target.value.trim() }, true);
    });
    document.getElementById('teacher-export-overview-results')?.addEventListener('click', async () => {
      try {
        App.showLoading();
        await API.teacher.exportHomeroomOverview(this.homeroomOverviewFilters);
        App.hideLoading();
        App.showToast('班级成绩报表已开始下载', 'success');
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message || '导出失败', 'error');
      }
    });
  },

  _bindHomeroomRegistrationBatchActions() {
    document.getElementById('teacher-registration-check-all')?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      document.querySelectorAll('.teacher-registration-checkbox:not(:disabled)').forEach((checkbox) => {
        checkbox.checked = checked;
      });
    });
    document.getElementById('teacher-select-all-registrations')?.addEventListener('click', () => {
      document.querySelectorAll('.teacher-registration-checkbox:not(:disabled)').forEach((checkbox) => {
        checkbox.checked = true;
      });
      const checkAll = document.getElementById('teacher-registration-check-all');
      if (checkAll) checkAll.checked = true;
    });
    document.getElementById('teacher-batch-approve-registrations')?.addEventListener('click', async () => {
      await this._submitBatchRegistrationReview('approve', 'registration');
    });
    document.getElementById('teacher-batch-reject-registrations')?.addEventListener('click', async () => {
      await this._submitBatchRegistrationReview('reject', 'registration');
    });
    document.getElementById('teacher-batch-approve-cancel')?.addEventListener('click', async () => {
      await this._submitBatchRegistrationReview('approve', 'cancel');
    });
    document.getElementById('teacher-batch-reject-cancel')?.addEventListener('click', async () => {
      await this._submitBatchRegistrationReview('reject', 'cancel');
    });
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

  async _submitBatchRegistrationReview(action, reviewType) {
    const targetStatus = reviewType === 'cancel' ? 'cancelling' : 'pending';
    const ids = Array.from(document.querySelectorAll(`.teacher-registration-checkbox[data-registration-status="${targetStatus}"]:checked`))
      .map((checkbox) => Number(checkbox.dataset.registrationId || 0))
      .filter(Boolean);
    if (!ids.length) {
      App.showToast(reviewType === 'cancel' ? '请先选择取消申请记录' : '请先选择待审核报名记录', 'warning');
      return;
    }
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt(reviewType === 'cancel' ? '请输入批量驳回取消申请的原因（可选）' : '请输入批量驳回报名的原因（可选）', '') || '';
    }
    const confirmed = await App.confirmDialog(
      reviewType === 'cancel'
        ? (action === 'approve' ? `确认批量批准 ${ids.length} 条取消申请吗？` : `确认批量驳回 ${ids.length} 条取消申请吗？`)
        : (action === 'approve' ? `确认批量通过 ${ids.length} 条报名吗？` : `确认批量驳回 ${ids.length} 条报名吗？`)
    );
    if (!confirmed) return;
    try {
      App.showLoading();
      const res = await API.teacher.batchReviewRegistrations({
        ids,
        action,
        review_type: reviewType,
        reason
      });
      App.hideLoading();
      if (!res.success) throw new Error(res.error || '批量审核失败');
      App.showToast(res.message || '批量审核成功', 'success');
      await this._renderHomeroomRegistrations();
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message || '批量审核失败', 'error');
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
                      <div class="teacher-table-actions">
                        <button type="button" class="btn btn-outline btn-sm" data-assignment-enter="${event.id}">进入录入</button>
                      </div>
                    </article>
                  `).join('')}
                </div>
              ` : '<div class="empty-state"><p class="empty-state__desc">当前教师尚未分配录入项目</p></div>'}
            </div>
          </div>
        </div>
      `;
      document.querySelectorAll('[data-assignment-enter]').forEach((button) => {
        button.addEventListener('click', async () => {
          this.selectedEventId = Number(button.dataset.assignmentEnter || 0);
          this._resetResultsEntryFilters();
          this.currentTab = 'results';
          this._renderSidebar();
          await this._renderCurrentTab();
        });
      });
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
      const preferredEvent = this._pickPreferredResultsEvent(events);
      const currentEvent = events.find((item) => Number(item.id) === Number(this.selectedEventId || 0));
      const activeEventId = Number(currentEvent?.id || preferredEvent?.id || 0);
      this.selectedEventId = activeEventId || null;
      let entryData = null;
      if (activeEventId) {
        const entryRes = await API.teacher.getResultsEntry({ event_id: activeEventId });
        if (!entryRes.success) throw new Error(entryRes.error || '成绩录入数据加载失败');
        entryData = entryRes.data || {};
      }
      this.latestResultsEntry = entryData;
      const view = this._buildResultsEntryView(events, entryData);
      const activeEvent = events.find((item) => Number(item.id) === activeEventId) || null;

      content.innerHTML = `
        <div class="teacher-shell">
          <div class="card">
            <div class="card__header">
              <div>
                <h3 class="card__title">成绩录入</h3>
                <p class="teacher-hero__meta">按“选择项目 -> 选择班级/轮次 -> 录入并提交”三步完成当前项目成绩录入</p>
              </div>
              <div class="teacher-toolbar">
                <select id="teacher-event-selector" class="form__select">
                  ${events.map((event) => `<option value="${event.id}"${Number(event.id) === activeEventId ? ' selected' : ''}>${this._buildResultsEventLabel(event)}</option>`).join('')}
                </select>
                <button type="button" class="btn btn-outline btn-sm" id="teacher-refresh-results-btn"${activeEventId ? '' : ' disabled'}>刷新</button>
              </div>
            </div>
            <div class="card__body">
              ${activeEventId && entryData ? this._renderResultsEntryWorkspace(activeEvent, view, events) : '<div class="empty-state"><p class="empty-state__desc">当前没有可录入的项目，请先在后台分配教师项目</p></div>'}
            </div>
          </div>
        </div>
      `;

      document.getElementById('teacher-event-selector')?.addEventListener('change', async (e) => {
        this.selectedEventId = Number(e.target.value || 0);
        this._resetResultsEntryFilters();
        await this._renderResultsEntry();
      });
      document.getElementById('teacher-refresh-results-btn')?.addEventListener('click', async () => {
        await this._renderResultsEntry();
      });
      document.getElementById('teacher-refresh-results-empty-btn')?.addEventListener('click', async () => {
        await this._renderResultsEntry();
      });
      document.getElementById('teacher-switch-assignment-btn')?.addEventListener('click', async () => {
        this.currentTab = 'assignments';
        this._renderSidebar();
        await this._renderCurrentTab();
      });
      document.querySelectorAll('[data-results-event-id]').forEach((button) => {
        button.addEventListener('click', async () => {
          this.selectedEventId = Number(button.dataset.resultsEventId || 0);
          this._resetResultsEntryFilters();
          await this._renderResultsEntry();
        });
      });
      document.getElementById('teacher-save-draft-btn')?.addEventListener('click', async () => {
        await this._submitResultsBatch({ requireConfirm: false });
      });
      document.getElementById('teacher-submit-results-btn')?.addEventListener('click', async () => {
        await this._submitResultsBatch({ requireConfirm: true });
      });
      document.getElementById('teacher-clear-results-filters-btn')?.addEventListener('click', async () => {
        this._resetResultsEntryFilters();
        await this._renderResultsEntry();
      });
      this._bindResultsEntryFilters();
    } catch (e) {
      content.innerHTML = `<div class="empty-state"><p class="empty-state__desc">${App._escHtml(e.message || '成绩录入页面加载失败')}</p></div>`;
    }
  },

  _pickPreferredResultsEvent(events) {
    if (!Array.isArray(events) || !events.length) return null;
    return [...events].sort((a, b) => {
      const participantDiff = Number(b.participant_count || 0) - Number(a.participant_count || 0);
      if (participantDiff !== 0) return participantDiff;
      const scheduleDiff = Number(b.schedule_count || 0) - Number(a.schedule_count || 0);
      if (scheduleDiff !== 0) return scheduleDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    })[0];
  },

  _resetResultsEntryFilters() {
    this.resultsEntryFilters = {
      class_name: '',
      round_name: '',
      keyword: ''
    };
  },

  _buildResultsEventLabel(event) {
    const genderMap = { male: '男子', female: '女子', mixed: '混合' };
    const scheduleCount = Number(event?.schedule_count || 0);
    const participantCount = Number(event?.participant_count || 0);
    return `${App._escHtml(event?.name || '-')} (${genderMap[event?.gender_group] || '混合'}组 / ${scheduleCount}场 / ${participantCount}人)`;
  },

  _buildResultsEntryView(events, entryData) {
    const participants = Array.isArray(entryData?.participants) ? entryData.participants : [];
    const classOptions = Array.isArray(entryData?.classes) ? entryData.classes : [];
    const roundOptions = Array.isArray(entryData?.rounds) ? entryData.rounds : [];
    const className = classOptions.includes(this.resultsEntryFilters.class_name) ? this.resultsEntryFilters.class_name : '';
    const roundName = roundOptions.includes(this.resultsEntryFilters.round_name) ? this.resultsEntryFilters.round_name : '';
    const keyword = String(this.resultsEntryFilters.keyword || '').trim();
    this.resultsEntryFilters = {
      class_name: className,
      round_name: roundName,
      keyword
    };
    const normalizedKeyword = keyword.toLowerCase();
    const filteredParticipants = participants.filter((item) => {
      const rowClass = [item.grade, item.class_name].filter(Boolean).join(' ');
      const matchesClass = !className || rowClass === className;
      const matchesRound = !roundName || String(item.round_name || '') === roundName;
      const haystack = [
        item.student_name,
        item.student_id,
        item.grade,
        item.class_name,
        item.round_name
      ].join(' ').toLowerCase();
      const matchesKeyword = !normalizedKeyword || haystack.includes(normalizedKeyword);
      return matchesClass && matchesRound && matchesKeyword;
    });
    const readiness = entryData?.readiness || { can_edit: participants.length > 0, blockers: [] };
    const summary = entryData?.summary || {};
    const resultMeta = entryData?.result_meta || {
      unit: '',
      unit_label: '',
      input_hint: '',
      ranking_label: ''
    };
    const activeEvent = events.find((item) => Number(item.id) === Number(entryData?.event_id || this.selectedEventId || 0)) || null;
    return {
      activeEvent,
      participants,
      filteredParticipants,
      classOptions,
      roundOptions,
      readiness,
      resultMeta,
      summary: {
        schedule_count: Number(summary.schedule_count || activeEvent?.schedule_count || 0),
        approved_participant_count: Number(summary.approved_participant_count || activeEvent?.participant_count || 0),
        result_count: Number(summary.result_count || 0),
        published_result_count: Number(summary.published_result_count || 0),
        class_count: Number(summary.class_count || classOptions.length || 0)
      }
    };
  },

  _renderResultsEntryWorkspace(activeEvent, view, events) {
    const blockers = Array.isArray(view.readiness?.blockers) ? view.readiness.blockers : [];
    const canEdit = !!view.readiness?.can_edit;
    const resultCountText = view.summary.result_count || 0;
    const publishCountText = view.summary.published_result_count || 0;
    return `
      <div class="teacher-results-panel">
        <div class="teacher-results-steps">
          <div class="teacher-results-step is-active"><strong>1</strong><span>选择项目</span></div>
          <div class="teacher-results-step ${view.classOptions.length || view.roundOptions.length ? 'is-active' : ''}"><strong>2</strong><span>筛选班级</span></div>
          <div class="teacher-results-step ${canEdit ? 'is-active' : ''}"><strong>3</strong><span>录入提交</span></div>
        </div>
        <div class="teacher-summary-grid">
          <div class="teacher-summary-card"><strong>${view.summary.schedule_count}</strong><span>已编排赛程</span></div>
          <div class="teacher-summary-card"><strong>${view.summary.approved_participant_count}</strong><span>可录入学生</span></div>
          <div class="teacher-summary-card"><strong>${resultCountText}</strong><span>已录成绩</span></div>
          <div class="teacher-summary-card"><strong>${publishCountText}</strong><span>已公示成绩</span></div>
        </div>
        <div class="teacher-results-headline">
          <div>
            <h4>${App._escHtml(activeEvent?.name || '当前项目')}</h4>
            <p>${App._escHtml(this._formatResultsEventMeta(activeEvent))}</p>
          </div>
          <div class="teacher-inline-meta">
            <span class="teacher-readiness-badge ${canEdit ? 'is-ready' : 'is-blocked'}">${canEdit ? '可直接录入' : '待准备'}</span>
            <span>${App._escHtml(view.resultMeta?.unit_label || '成绩单位待定')}</span>
            <span>${App._escHtml(view.resultMeta?.ranking_label || '保存后自动排序')}</span>
            <span>班级 ${view.summary.class_count || 0} 个</span>
            <span>当前筛选 ${view.filteredParticipants.length} 条</span>
            <span>总数据 ${view.participants.length} 条</span>
          </div>
        </div>
        ${canEdit ? this._renderResultsTable(view) : this._renderResultsEntryEmpty(activeEvent, blockers, events)}
      </div>
    `;
  },

  _formatResultsEventMeta(event) {
    if (!event) return '暂无项目说明';
    const genderMap = { male: '男子组', female: '女子组', mixed: '混合组' };
    const typeMap = { team: '集体项目', individual: '个人项目' };
    return [
      event.category || '项目',
      genderMap[event.gender_group] || '混合组',
      typeMap[event.event_type] || '个人项目',
      event.venue || '场地待定'
    ].filter(Boolean).join(' · ');
  },

  _renderResultsEntryEmpty(activeEvent, blockers, events) {
    const tips = blockers.length
      ? blockers.map((item) => `<li>${App._escHtml(item)}</li>`).join('')
      : '<li>当前项目尚未满足成绩录入条件</li>';
    return `
      <div class="teacher-results-empty">
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fas fa-clipboard-list"></i></div>
          <p class="empty-state__desc">${App._escHtml(activeEvent?.name || '当前项目')} 暂时无法进入成绩录入表格，请先完成下列准备项：</p>
        </div>
        <div class="teacher-results-empty__body">
          <div class="teacher-results-checklist">
            <h4>待完成项</h4>
            <ul>${tips}</ul>
            <div class="teacher-blocker-pills">
              ${blockers.map((item) => `<span>${App._escHtml(item)}</span>`).join('')}
            </div>
            <div class="teacher-table-actions">
              <button type="button" class="btn btn-outline btn-sm" id="teacher-switch-assignment-btn">查看项目分配</button>
              <button type="button" class="btn btn-primary btn-sm" id="teacher-refresh-results-empty-btn">重新检查</button>
            </div>
          </div>
          <div class="teacher-card-grid">
            ${events.map((event) => `
              <button type="button" class="teacher-event-card teacher-event-card--action ${Number(event.id) === Number(this.selectedEventId || 0) ? 'is-active' : ''}" data-results-event-id="${event.id}">
                <h4>${App._escHtml(event.name || '-')}</h4>
                <p>${App._escHtml(this._formatResultsEventMeta(event))}</p>
                <div class="teacher-event-card__meta">
                  <span>${Number(event.schedule_count || 0)} 场赛程</span>
                  <span>${Number(event.participant_count || 0)} 名学生</span>
                </div>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  _renderResultsTable(view) {
    const participants = view.filteredParticipants || [];
    const hasSourceRows = (view.participants || []).length > 0;
    const disabled = !participants.length;
    const unit = String(view.resultMeta?.unit || '').trim();
    const performanceTitle = unit ? `成绩（${unit}）` : '成绩';
    return `
      <div class="teacher-filter-grid teacher-filter-grid--results">
        <div class="form__group">
          <label class="form__label">班级选择</label>
          <select id="teacher-results-class-filter" class="form__select">
            <option value="">全部班级</option>
            ${view.classOptions.map((item) => `<option value="${App._escAttr(item)}"${item === this.resultsEntryFilters.class_name ? ' selected' : ''}>${App._escHtml(item)}</option>`).join('')}
          </select>
        </div>
        <div class="form__group">
          <label class="form__label">轮次筛选</label>
          <select id="teacher-results-round-filter" class="form__select">
            <option value="">全部轮次</option>
            ${view.roundOptions.map((item) => `<option value="${App._escAttr(item)}"${item === this.resultsEntryFilters.round_name ? ' selected' : ''}>${App._escHtml(item)}</option>`).join('')}
          </select>
        </div>
        <div class="form__group">
          <label class="form__label">学生检索</label>
          <input id="teacher-results-keyword-filter" class="form__input" placeholder="输入姓名、学号或班级" value="${App._escAttr(this.resultsEntryFilters.keyword || '')}">
        </div>
        <div class="form__group">
          <label class="form__label">当前状态</label>
          <div class="teacher-inline-meta">
            <span>本次保存 ${participants.length} 条</span>
            <span>已录入 ${view.summary.result_count}</span>
            <span>已公示 ${view.summary.published_result_count}</span>
          </div>
        </div>
      </div>
      <div class="teacher-results-actions">
        <p>${hasSourceRows ? `直接输入成绩后保存即可，系统会自动补充单位提示并按${App._escHtml(view.resultMeta?.ranking_direction === 'desc' ? '高到低' : '低到高')}完成排序。` : '当前项目暂无可录入学生。'}</p>
        <div class="teacher-table-actions">
          <button type="button" class="btn btn-outline btn-sm" id="teacher-clear-results-filters-btn">清空筛选</button>
          <button type="button" class="btn btn-outline btn-sm" id="teacher-save-draft-btn"${disabled ? ' disabled' : ''}>暂存成绩</button>
          <button type="button" class="btn btn-primary btn-sm" id="teacher-submit-results-btn"${disabled ? ' disabled' : ''}>提交确认</button>
        </div>
      </div>
      ${participants.length ? `
      <div class="table-container">
        <table class="table table--striped teacher-results-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>轮次</th>
              <th>学生</th>
              <th>学号</th>
              <th>班级</th>
              <th>${App._escHtml(performanceTitle)}</th>
              <th>名次</th>
              <th>奖项</th>
              <th>备注</th>
              <th>公示</th>
            </tr>
          </thead>
          <tbody>
            ${participants.map((item, index) => `
              <tr data-row-index="${index}" data-schedule-id="${item.schedule_id}" data-user-id="${item.user_id}">
                <td>${index + 1}</td>
                <td>${App._escHtml(item.round_name || '-')}</td>
                <td>${App._escHtml(item.student_name || '-')}</td>
                <td>${App._escHtml(item.student_id || '-')}</td>
                <td>${App._escHtml(item.grade || '-')} ${App._escHtml(item.class_name || '-')}</td>
                <td>
                  <div class="teacher-performance-input">
                    <input type="text" class="form__input form__input--compact" data-field="performance" value="${App._escAttr(item.performance || '')}" placeholder="${App._escAttr(unit ? `输入${unit}` : '成绩')}">
                    ${unit ? `<span>${App._escHtml(unit)}</span>` : ''}
                  </div>
                </td>
                <td><span class="teacher-rank-chip">${Number(item.rank || 0) || '待排序'}</span></td>
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
      ` : `
        <div class="empty-state">
          <p class="empty-state__desc">${hasSourceRows ? '当前筛选条件下没有匹配的学生，请调整班级、轮次或关键词。' : '当前项目暂无已审核参赛学生。'}</p>
        </div>
      `}
    `;
  },

  _bindResultsEntryFilters() {
    document.getElementById('teacher-results-class-filter')?.addEventListener('change', async (e) => {
      this.resultsEntryFilters.class_name = e.target.value || '';
      await this._renderResultsEntry();
    });
    document.getElementById('teacher-results-round-filter')?.addEventListener('change', async (e) => {
      this.resultsEntryFilters.round_name = e.target.value || '';
      await this._renderResultsEntry();
    });
    document.getElementById('teacher-results-keyword-filter')?.addEventListener('input', async (e) => {
      this.resultsEntryFilters.keyword = e.target.value.trim();
      clearTimeout(this._resultsEntryFilterTimer);
      this._resultsEntryFilterTimer = setTimeout(() => {
        this._renderResultsEntry();
      }, 180);
    });
    document.querySelectorAll('.teacher-results-table [data-field="performance"]').forEach((input) => {
      input.addEventListener('input', (e) => {
        const sanitized = String(e.target.value || '').toUpperCase().replace(/[^0-9A-Z:.]/g, '').slice(0, 20);
        if (sanitized !== e.target.value) e.target.value = sanitized;
      });
    });
  },

  async _submitResultsBatch(options = {}) {
    const rows = Array.from(document.querySelectorAll('.teacher-results-table tbody tr'));
    if (!rows.length) {
      App.showToast('当前没有可保存的成绩记录', 'warning');
      return;
    }
    if (options.requireConfirm) {
      const confirmed = await App.confirmDialog(`确认提交当前筛选结果中的 ${rows.length} 条成绩吗？`);
      if (!confirmed) return;
    }
    const items = rows.map((row) => ({
      schedule_id: Number(row.dataset.scheduleId || 0),
      user_id: Number(row.dataset.userId || 0),
      performance: row.querySelector('[data-field="performance"]')?.value || '',
      award: row.querySelector('[data-field="award"]')?.value || '',
      note: row.querySelector('[data-field="note"]')?.value || '',
      is_published: row.querySelector('[data-field="is_published"]')?.checked ? 1 : 0
    }));
    try {
      App.showLoading();
      const res = await API.teacher.batchSaveResults({ items });
      App.hideLoading();
      if (!res.success) throw new Error(res.error || '成绩保存失败');
      App.showToast(res.message || (options.requireConfirm ? '成绩提交成功' : '成绩已暂存'), 'success');
      await this._renderResultsEntry();
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message || '成绩保存失败', 'error');
    }
  }
};

window.Teacher = Teacher;
