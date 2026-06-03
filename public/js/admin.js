// ============================================================
// 学校运动会管理网站 - 管理员后台模块
// ============================================================

const Admin = {
  currentTab: 'dashboard',
  _chartInstances: [],

  // 渲染管理后台主页面
  render() {
    const page = document.getElementById('page-admin');
    page.innerHTML = `
      <div class="admin-layout" style="display:flex;min-height:calc(100vh - 64px);background:#f5f7fa;">
        <aside class="admin-sidebar" style="width:220px;background:#fff;border-right:1px solid #e5e7eb;flex-shrink:0;overflow-y:auto;">
          <div class="admin-sidebar-header" style="padding:20px;border-bottom:1px solid #e5e7eb;">
            <h3 style="font-size:1.125rem;font-weight:600;color:#1f2937;margin:0;">管理后台</h3>
          </div>
          <ul class="admin-menu" style="padding:8px 0;">
            <li class="admin-menu-item active" data-tab="dashboard" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#1f2937;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-tachometer-alt" style="width:18px;text-align:center;"></i> 控制台
            </li>
            <li class="admin-menu-item" data-tab="users" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-users" style="width:18px;text-align:center;"></i> 用户管理
            </li>
            <li class="admin-menu-item" data-tab="events" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-running" style="width:18px;text-align:center;"></i> 项目管理
            </li>
            <li class="admin-menu-item" data-tab="registrations" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-clipboard-list" style="width:18px;text-align:center;"></i> 报名管理
            </li>
            <li class="admin-menu-item" data-tab="schedules" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-calendar-alt" style="width:18px;text-align:center;"></i> 赛程编排
            </li>
            <li class="admin-menu-item" data-tab="results" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-medal" style="width:18px;text-align:center;"></i> 成绩管理
            </li>
            <li class="admin-menu-item" data-tab="stats" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-chart-bar" style="width:18px;text-align:center;"></i> 统计概览
            </li>
            <li class="admin-menu-item" data-tab="announcements" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-bullhorn" style="width:18px;text-align:center;"></i> 公告管理
            </li>
            <li class="admin-menu-item" data-tab="forum" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-comments" style="width:18px;text-align:center;"></i> 论坛管理
            </li>
            <li class="admin-menu-item" data-tab="highlights" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-images" style="width:18px;text-align:center;"></i> 照片管理
            </li>
            <li class="admin-menu-item" data-tab="settings" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-cog" style="width:18px;text-align:center;"></i> 系统设置
            </li>
            <li class="admin-menu-item" data-tab="grades" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-layer-group" style="width:18px;text-align:center;"></i> 年级班级
            </li>
            <li class="admin-menu-item" data-tab="logs" style="display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:0.875rem;color:#6b7280;transition:all 150ms;border-left:3px solid transparent;">
              <i class="fas fa-history" style="width:18px;text-align:center;"></i> 操作日志
            </li>
          </ul>
        </aside>
        <div class="admin-content" id="admin-content" style="flex:1;padding:24px;overflow-y:auto;"></div>
      </div>
    `;

    page.querySelectorAll('.admin-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        page.querySelectorAll('.admin-menu-item').forEach(i => {
          i.classList.remove('active');
          i.style.color = '#6b7280';
          i.style.background = 'transparent';
          i.style.borderLeftColor = 'transparent';
        });
        item.classList.add('active');
        item.style.color = '#1a73e8';
        item.style.background = '#e8f0fe';
        item.style.borderLeftColor = '#1a73e8';
        this.currentTab = item.dataset.tab;
        this.renderTab();
      });
    });

    // 默认激活第一个菜单项样式
    const firstItem = page.querySelector('.admin-menu-item.active');
    if (firstItem) {
      firstItem.style.color = '#1a73e8';
      firstItem.style.background = '#e8f0fe';
      firstItem.style.borderLeftColor = '#1a73e8';
    }

    this.currentTab = 'dashboard';
    this.renderTab();
  },

  // 销毁所有图表实例
  _destroyCharts() {
    this._chartInstances.forEach(c => { try { c.destroy(); } catch (e) {} });
    this._chartInstances = [];
  },

  // 切换标签页
  renderTab() {
    this._destroyCharts();
    const content = document.getElementById('admin-content');
    if (!content) return;
    content.innerHTML = '<div style="text-align:center;padding:60px;color:#9ca3af;">加载中...</div>';
    switch (this.currentTab) {
      case 'dashboard': this.renderDashboard(content); break;
      case 'users': this.renderUsers(content); break;
      case 'events': this.renderEvents(content); break;
      case 'registrations': this.renderRegistrations(content); break;
      case 'schedules': this.renderSchedules(content); break;
      case 'results': this.renderResults(content); break;
      case 'stats': this.renderStats(content); break;
      case 'announcements': this.renderAnnouncements(content); break;
      case 'forum': this.renderForumManagement(content); break;
      case 'highlights': this.renderHighlightsAdmin(content); break;
      case 'settings': this.renderSettings(content); break;
      case 'logs': this.renderLogs(content); break;
      case 'grades': this._renderGrades(content); break;
    }
  },

  // 导出 Excel 工具方法
  _exportExcel(data, filename) {
    if (!data || data.length === 0) {
      App.showToast('没有数据可导出', 'warning');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename + '.xlsx');
  },

  // 分页工具方法
  _paginate({ page, total, limit, callback }) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const p = Math.max(1, Math.min(page, totalPages));
    return { page: p, total, limit, totalPages, callback };
  },

  _renderPagination(info, containerId) {
    if (info.totalPages <= 1) return '';
    let html = '<div class="table-pagination"><div class="table-pagination__info">共 ' + info.total + ' 条记录，第 ' + info.page + '/' + info.totalPages + ' 页</div>';
    html += '<div class="table-pagination__buttons">';
    html += '<button class="table-pagination__btn" data-page="1"' + (info.page === 1 ? ' disabled' : '') + '><i class="fas fa-angle-double-left"></i></button>';
    html += '<button class="table-pagination__btn" data-page="' + (info.page - 1) + '"' + (info.page === 1 ? ' disabled' : '') + '><i class="fas fa-angle-left"></i></button>';
    const start = Math.max(1, info.page - 2);
    const end = Math.min(info.totalPages, info.page + 2);
    for (let i = start; i <= end; i++) {
      html += '<button class="table-pagination__btn' + (i === info.page ? ' table-pagination__btn--active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="table-pagination__btn" data-page="' + (info.page + 1) + '"' + (info.page === info.totalPages ? ' disabled' : '') + '><i class="fas fa-angle-right"></i></button>';
    html += '<button class="table-pagination__btn" data-page="' + info.totalPages + '"' + (info.page === info.totalPages ? ' disabled' : '') + '><i class="fas fa-angle-double-right"></i></button>';
    html += '</div></div>';
    setTimeout(() => {
      document.querySelectorAll('#' + containerId + ' .table-pagination__btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          const p = parseInt(btn.dataset.page);
          if (p > 0 && p <= info.totalPages) { info.callback(p); }
        });
      });
    }, 0);
    return html;
  },

  // 生成空状态 HTML
  _emptyState(icon, title, desc) {
    return '<div class="empty-state"><div class="empty-state__icon"><i class="' + (icon || 'fas fa-inbox') + '"></i></div><div class="empty-state__title">' + (title || '暂无数据') + '</div>' + (desc ? '<div class="empty-state__desc">' + desc + '</div>' : '') + '</div>';
  },

  _normalizeFilterValues(value) {
    if (Array.isArray(value)) return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
    if (!value) return [];
    return [...new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean))];
  },

  _escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  _buildGradeClassDictionary(raw) {
    const grades = (raw?.grades || []).slice().sort((a, b) => {
      if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0);
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN-u-co-pinyin');
    });
    const classes = (raw?.classes || []).slice().sort((a, b) => {
      const gradeDiff = (a.grade_sort_order || 0) - (b.grade_sort_order || 0);
      if (gradeDiff !== 0) return gradeDiff;
      const sortDiff = (a.sort_order || 0) - (b.sort_order || 0);
      if (sortDiff !== 0) return sortDiff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN-u-co-pinyin');
    });
    return { grades, classes };
  },

  _getLinkedClasses(dictionary, gradeNames) {
    const selectedGrades = this._normalizeFilterValues(gradeNames);
    if (!selectedGrades.length) return (dictionary?.classes || []).slice();
    return (dictionary?.classes || []).filter((item) => selectedGrades.includes(item.grade_name));
  },

  _setSelectMode(select, isMulti, placeholder) {
    if (!select) return;
    select.multiple = !!isMulti;
    select.size = isMulti ? Math.min(6, Math.max(3, select.options.length || 3)) : 1;
    if (!isMulti) {
      const hasPlaceholder = select.options.length && select.options[0].value === '';
      if (!hasPlaceholder) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = placeholder || '全部';
        select.insertBefore(option, select.firstChild);
      }
    } else if (select.options.length && select.options[0].value === '') {
      select.remove(0);
    }
  },

  _setSelectValues(select, values) {
    if (!select) return;
    const selectedValues = this._normalizeFilterValues(values);
    Array.from(select.options).forEach((option) => {
      option.selected = selectedValues.includes(option.value);
    });
    if (!select.multiple && !selectedValues.length) select.value = '';
  },

  _getSelectValues(select) {
    if (!select) return [];
    return Array.from(select.selectedOptions || [])
      .map((option) => String(option.value || '').trim())
      .filter(Boolean);
  },

  _renderGradeClassPicker(prefix, dictionary, state, options = {}) {
    const gradeSelect = document.getElementById(prefix + '-grade');
    const classSelect = document.getElementById(prefix + '-class');
    const gradeMulti = document.getElementById(prefix + '-grade-multi');
    const classMulti = document.getElementById(prefix + '-class-multi');
    if (!gradeSelect || !classSelect) return;

    const gradeValues = this._normalizeFilterValues(state.grade);
    const classValues = this._normalizeFilterValues(state.class_name);
    const gradeSingleLabel = options.gradeSingleLabel || '全部年级';
    const classSingleLabel = options.classSingleLabel || '全部班级';

    gradeSelect.innerHTML = '';
    if (!(gradeMulti && gradeMulti.checked)) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = gradeSingleLabel;
      gradeSelect.appendChild(option);
    }
    (dictionary.grades || []).forEach((item) => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.name;
      gradeSelect.appendChild(option);
    });
    this._setSelectMode(gradeSelect, !!(gradeMulti && gradeMulti.checked), gradeSingleLabel);
    this._setSelectValues(gradeSelect, gradeValues);

    const linkedClasses = this._getLinkedClasses(dictionary, gradeValues);
    const linkedSet = new Set(linkedClasses.map((item) => item.name));
    const nextClassValues = classValues.filter((item) => linkedSet.has(item));
    state.class_name = nextClassValues;

    classSelect.innerHTML = '';
    if (!(classMulti && classMulti.checked)) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = classSingleLabel;
      classSelect.appendChild(option);
    }
    linkedClasses.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.grade_name ? item.grade_name + ' / ' + item.name : item.name;
      classSelect.appendChild(option);
    });
    this._setSelectMode(classSelect, !!(classMulti && classMulti.checked), classSingleLabel);
    this._setSelectValues(classSelect, nextClassValues);

    const hint = document.getElementById(prefix + '-link-hint');
    if (hint) {
      hint.textContent = gradeValues.length ? '已按所选年级联动展示 ' + linkedClasses.length + ' 个班级' : '未选择年级时显示全部班级';
    }
  },

  _bindGradeClassPicker(prefix, dictionary, state, options = {}) {
    const applyGradeChange = () => {
      const gradeSelect = document.getElementById(prefix + '-grade');
      state.grade = this._getSelectValues(gradeSelect);
      this._renderGradeClassPicker(prefix, dictionary, state, options);
    };
    const applyClassChange = () => {
      const classSelect = document.getElementById(prefix + '-class');
      state.class_name = this._getSelectValues(classSelect);
    };

    document.getElementById(prefix + '-grade-multi')?.addEventListener('change', () => {
      state.grade = state.grade.slice(0, 1);
      this._renderGradeClassPicker(prefix, dictionary, state, options);
      applyGradeChange();
    });
    document.getElementById(prefix + '-class-multi')?.addEventListener('change', () => {
      state.class_name = state.class_name.slice(0, 1);
      this._renderGradeClassPicker(prefix, dictionary, state, options);
      applyClassChange();
    });
    document.getElementById(prefix + '-grade')?.addEventListener('change', applyGradeChange);
    document.getElementById(prefix + '-class')?.addEventListener('change', applyClassChange);

    this._renderGradeClassPicker(prefix, dictionary, state, options);
  },

  // ==================== 控制台 ====================
  async renderDashboard(container) {
    container.innerHTML = '<div class="text-center p-8"><div class="spinner"></div><p class="text-muted mt-2">加载中...</p></div>';
    try {
      // 并行获取所有数据
      const [dashRes, logsRes] = await Promise.allSettled([
        API.admin.getDashboard().catch(() => ({ data: {} })),
        API.get('/admin/logs?limit=5').catch(() => ({ data: { list: [] } }))
      ]);
      const d = (dashRes.value && dashRes.value.data) ? dashRes.value.data : {};
      const logs = (logsRes.value && logsRes.value.data) ? (logsRes.value.data.list || logsRes.value.data || []) : [];

      let html = '';
      
      // 统计卡片
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">';
      const cards = [
        { icon: 'fa-users', label: '学生总数', value: d.total_users || 0, color: '#2d6a4f' },
        { icon: 'fa-running', label: '比赛项目', value: d.total_events || 0, color: '#1e6091' },
        { icon: 'fa-clipboard-list', label: '待审核报名', value: d.pending_registrations || 0, color: '#e07a5f' },
        { icon: 'fa-trophy', label: '获奖人数', value: d.awarded_count || 0, color: '#b8860b' },
        { icon: 'fa-calendar-check', label: '今日赛程', value: d.today_schedules || 0, color: '#a51d2d' },
        { icon: 'fa-check-double', label: '已通过报名', value: d.approved_registrations || 0, color: '#52b788' },
        { icon: 'fa-bullhorn', label: '已发布赛程', value: d.published_schedules || 0, color: '#7c3aed' },
        { icon: 'fa-chart-bar', label: '已公示成绩', value: d.published_results || 0, color: '#0284c7' },
      ];
      cards.forEach(c => {
        html += `<div class="stat-card"><i class="fas ${c.icon}" style="color:${c.color}"></i><div class="stat-num">${c.value}</div><div class="stat-label">${c.label}</div></div>`;
      });
      html += '</div>';

      // 报名统计图表
      html += '<div class="card mb-3"><div class="card-header"><h3>报名统计</h3></div><div class="card-body"><canvas id="dash-chart" style="max-height:280px"></canvas></div></div>';

      // 最近日志
      html += '<div class="card"><div class="card-header"><h3>最近日志</h3></div><div class="card-body">';
      if (logs.length > 0) {
        html += '<div class="table-container"><table class="table"><thead><tr><th>时间</th><th>用户</th><th>操作</th><th>IP</th></tr></thead><tbody>';
        logs.forEach(l => html += '<tr><td>'+App.formatDate(l.created_at)+'</td><td>'+l.username+'</td><td>'+l.action+'</td><td>'+l.ip_address+'</td></tr>');
        html += '</tbody></table></div>';
      } else { html += '<p class="text-muted">暂无日志</p>'; }
      html += '</div></div>';

      container.innerHTML = html;

      this._renderDashboardRegChart();
    } catch(e) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state__desc">加载失败：' + e.message + '</p><button class="btn btn-outline mt-2" onclick="Admin.render()">重新加载</button></div>';
    }
  },

  async _renderDashboardRegChart() {
    const canvas = document.getElementById('dash-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    try {
      const res = await API.admin.getRegistrations({ limit: 99999 });
      const list = (res.data?.list || res.data || []);
      if (list.length === 0) {
        canvas.parentElement.innerHTML = '<p class="text-muted text-center" style="padding:2rem">暂无报名数据</p>';
        return;
      }
      const eventMap = {};
      list.forEach(r => {
        const key = r.event_name || '未知项目';
        eventMap[key] = (eventMap[key] || 0) + 1;
      });
      const labels = Object.keys(eventMap);
      const data = Object.values(eventMap);
      const colors = ['#a51d2d','#2d6a4f','#1e6091','#e07a5f','#b8860b','#7c3aed','#0284c7','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];
      const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderColor: '#fff', borderWidth: 2 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 10, usePointStyle: true } },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.raw} 人 (${((ctx.raw / data.reduce((a,b)=>a+b,0)) * 100).toFixed(1)}%)`
              }
            }
          }
        }
      });
      this._chartInstances.push(chart);
    } catch (e) {}
  },

  // ==================== 用户管理 ====================
  _usersPage: 1,
  _usersLimit: 20,

  async renderUsers(container) {
    this._usersPage = 1;
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">用户管理</h3>
          <div class="card__actions">
            <button class="btn btn--primary btn--sm" id="btn-add-user"><i class="fas fa-plus"></i> 添加用户</button>
            <button class="btn btn--outline btn--sm" id="btn-import-users"><i class="fas fa-upload"></i> 批量导入</button>
            <button class="btn btn--outline btn--sm" id="btn-export-users"><i class="fas fa-download"></i> 导出</button>
          </div>
        </div>
        <div class="card__body">
          <div class="search-filter-bar" id="users-filter-bar"></div>
          <div class="table-container" id="users-table-container"></div>
          <div id="users-pagination"></div>
        </div>
      </div>
    `;
    this._renderUsersFilter(container);
    this._loadUsers(container);
    this._bindUsersEvents(container);
  },

  _renderUsersFilter(container) {
    const bar = container.querySelector('#users-filter-bar');
    bar.innerHTML = `
      <input type="text" id="users-keyword" class="form__input" placeholder="搜索学号/姓名/邮箱..." style="max-width:240px;">
      <select id="users-grade" class="form__select"><option value="">全部年级</option></select>
      <select id="users-class" class="form__select"><option value="">全部班级</option></select>
      <select id="users-status" class="form__select">
        <option value="">全部状态</option>
        <option value="active">正常</option>
        <option value="disabled">已禁用</option>
      </select>
      <button class="btn btn--primary btn--sm" id="btn-users-search"><i class="fas fa-search"></i> 搜索</button>
    `;
    this._loadUsersGrades(container);
    this._loadUsersClasses(container);
  },

  async _loadUsersGrades(container) {
    try {
      const res = await API.public.getGrades();
      const grades = res.data && res.data.grades ? res.data.grades : (res.data || []);
      const sel = container.querySelector('#users-grade');
      grades.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.name || g.id;
        opt.textContent = g.name;
        sel.appendChild(opt);
      });
    } catch (e) {}
  },

  async _loadUsersClasses(container) {
    try {
      const res = await API.public.getGrades();
      const classes = res.data && res.data.classes ? res.data.classes : [];
      const sel = container.querySelector('#users-class');
      classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
    } catch (e) {}
  },

  _bindUsersEvents(container) {
    container.querySelector('#btn-add-user').addEventListener('click', () => this._showUserModal(null, container));
    container.querySelector('#btn-import-users').addEventListener('click', () => this._showUsersImport(container));
    container.querySelector('#btn-export-users').addEventListener('click', () => this._exportUsers(container));
    container.querySelector('#btn-users-search').addEventListener('click', () => {
      this._usersPage = 1;
      this._loadUsers(container);
    });
  },

  async _loadUsers(container) {
    try {
      App.showLoading();
      const keyword = container.querySelector('#users-keyword').value;
      const grade = container.querySelector('#users-grade').value;
      const className = container.querySelector('#users-class').value;
      const status = container.querySelector('#users-status').value;
      const params = { page: this._usersPage, limit: this._usersLimit };
      if (keyword) params.keyword = keyword;
      if (grade) params.grade = grade;
      if (className) params.class_name = className;
      if (status) params.status = status;

      const res = await API.admin.getUsers(params);
      const d = res.data || res;
      const list = d.list || [];
      const total = d.total || 0;
      App.hideLoading();

      let html = '';
      if (list.length > 0) {
        html = '<table class="table table--striped"><thead><tr><th>学号</th><th>姓名</th><th>身份</th><th>邮箱</th><th>负责范围</th><th>状态</th><th style="width:200px;">操作</th></tr></thead><tbody>';
        list.forEach(u => {
          const statusBadge = u.status === 'active' ? '<span class="badge badge--active">正常</span>' : '<span class="badge badge--inactive">已禁用</span>';
          const roleLabel = u.staff_type === 'homeroom_teacher'
            ? '班主任'
            : u.staff_type === 'event_teacher'
              ? '任课教师'
              : u.role === 'admin'
                ? '平台管理员'
                : '学生';
          const scopeLabel = u.staff_type === 'homeroom_teacher'
            ? ((u.managed_grade || '-') + ' / ' + (u.managed_class_name || '-'))
            : u.staff_type === 'event_teacher'
              ? ('已分配 ' + (((() => {
                  try {
                    const parsed = typeof u.assigned_event_ids === 'string' ? JSON.parse(u.assigned_event_ids) : u.assigned_event_ids;
                    return Array.isArray(parsed) ? parsed.filter(Boolean).length : 0;
                  } catch (_) {
                    return String(u.assigned_event_ids || '').split(',').map((item) => item.trim()).filter(Boolean).length;
                  }
                })()) || 0) + ' 项')
              : ((u.grade || '-') + ' / ' + (u.class_name || '-'));
          html += '<tr>';
          html += '<td>' + (u.student_id || '-') + '</td>';
          html += '<td>' + (u.name || '-') + '</td>';
          html += '<td>' + roleLabel + '</td>';
          html += '<td>' + (u.email || '-') + '</td>';
          html += '<td>' + scopeLabel + '</td>';
          html += '<td>' + statusBadge + '</td>';
          html += '<td><div class="table__actions">';
          html += '<button class="btn btn--ghost btn--xs btn-edit-user" data-id="' + u.id + '"><i class="fas fa-edit"></i></button>';
          html += '<button class="btn btn--ghost btn--xs btn-reset-pwd" data-id="' + u.id + '"><i class="fas fa-key"></i></button>';
          const toggleIcon = u.status === 'active' ? 'fa-ban' : 'fa-check';
          const toggleTitle = u.status === 'active' ? '禁用' : '启用';
          html += '<button class="btn btn--ghost btn--xs btn-toggle-user" data-id="' + u.id + '" data-status="' + u.status + '" title="' + toggleTitle + '"><i class="fas ' + toggleIcon + '"></i></button>';
          html += '<button class="btn btn--ghost btn--xs btn-delete-user" data-id="' + u.id + '" style="color:#ef4444;"><i class="fas fa-trash"></i></button>';
          html += '</div></td></tr>';
        });
        html += '</tbody></table>';
      } else {
        html = this._emptyState('fas fa-users', '暂无数据', '还没有用户数据');
      }

      const tableContainer = container.querySelector('#users-table-container');
      tableContainer.innerHTML = html;

      const pagInfo = this._paginate({ page: this._usersPage, total, limit: this._usersLimit, callback: (p) => { this._usersPage = p; this._loadUsers(container); } });
      container.querySelector('#users-pagination').innerHTML = this._renderPagination(pagInfo, 'users-pagination');

      // 绑定行操作按钮
      tableContainer.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          try {
            const res = await API.admin.getUser(id);
            this._showUserModal(res.data || res, container);
          } catch (e) { App.showToast(e.message, 'error'); }
        });
      });
      tableContainer.querySelectorAll('.btn-reset-pwd').forEach(btn => {
        btn.addEventListener('click', () => this._confirmResetPassword(btn.dataset.id, container));
      });
      tableContainer.querySelectorAll('.btn-toggle-user').forEach(btn => {
        btn.addEventListener('click', () => this._toggleUserStatus(btn.dataset.id, btn.dataset.status, container));
      });
      tableContainer.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', () => this._confirmDeleteUser(btn.dataset.id, container));
      });
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
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

  _toggleTeacherConfigFields() {
    const role = document.getElementById('user-role')?.value || 'student';
    const staffType = document.getElementById('user-staff-type')?.value || '';
    const staffWrap = document.getElementById('user-staff-type-wrap');
    const homeroomWrap = document.getElementById('user-homeroom-config');
    const eventWrap = document.getElementById('user-event-config');
    const studentHint = document.getElementById('user-student-fields-hint');
    const classLabel = document.querySelector('label[for="user-class"]');
    const gradeLabel = document.querySelector('label[for="user-grade"]');

    if (staffWrap) staffWrap.classList.toggle('hidden', role !== 'admin');
    if (homeroomWrap) homeroomWrap.classList.toggle('hidden', !(role === 'admin' && staffType === 'homeroom_teacher'));
    if (eventWrap) eventWrap.classList.toggle('hidden', !(role === 'admin' && staffType === 'event_teacher'));
    if (studentHint) studentHint.classList.toggle('hidden', role === 'student');
    if (classLabel) classLabel.textContent = role === 'student' ? '班级' : '班级（学生档案，可选）';
    if (gradeLabel) gradeLabel.textContent = role === 'student' ? '年级' : '年级（学生档案，可选）';
  },

  async _showUserModal(user, container) {
    const isEdit = !!user;
    const title = isEdit ? '编辑用户' : '添加用户';
    let eventList = [];
    try {
      const eventRes = await API.public.getEvents();
      eventList = Array.isArray(eventRes.data) ? eventRes.data : [];
    } catch (_) {
      eventList = [];
    }
    const currentRole = isEdit ? (user.role || 'student') : 'student';
    const currentStaffType = isEdit ? (user.staff_type || '') : '';
    const currentAssignedEventIds = isEdit ? this._parseAssignedEventIds(user.assigned_event_ids) : [];
    let html = '<div class="modal__header"><h3 class="modal__title">' + title + '</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body"><div class="form">';
    html += '<div class="form__group"><label class="form__label form__label--required">学号</label><input class="form__input" id="user-student-id" value="' + (isEdit ? (user.student_id || '') : '') + '"></div>';
    html += '<div class="form__group"><label class="form__label form__label--required">姓名</label><input class="form__input" id="user-name" value="' + (isEdit ? (user.name || '') : '') + '"></div>';
    html += '<div class="form__group"><label class="form__label form__label--required">邮箱</label><input class="form__input" id="user-email" value="' + (isEdit ? (user.email || '') : '') + '"></div>';
    if (!isEdit) {
      html += '<div class="form__group"><label class="form__label form__label--required">密码</label><input class="form__input" id="user-password" type="password" value="123456"></div>';
    }
    html += '<div class="form__group"><label class="form__label form__label--required">角色</label><select class="form__select" id="user-role"><option value="student"' + (currentRole === 'student' ? ' selected' : '') + '>学生</option><option value="admin"' + (currentRole === 'admin' ? ' selected' : '') + '>教职工 / 管理员</option></select></div>';
    html += '<div class="form__group" id="user-staff-type-wrap"><label class="form__label">教师身份</label><select class="form__select" id="user-staff-type"><option value=""' + (!currentStaffType ? ' selected' : '') + '>平台管理员</option><option value="homeroom_teacher"' + (currentStaffType === 'homeroom_teacher' ? ' selected' : '') + '>班主任</option><option value="event_teacher"' + (currentStaffType === 'event_teacher' ? ' selected' : '') + '>任课教师（成绩录入）</option></select></div>';
    html += '<div class="form__group"><label class="form__label" for="user-class">班级</label><input class="form__input" id="user-class" value="' + (isEdit ? (user.class_name || '') : '') + '"></div>';
    html += '<div class="form__group"><label class="form__label" for="user-grade">年级</label><input class="form__input" id="user-grade" value="' + (isEdit ? (user.grade || '') : '') + '"></div>';
    html += '<div class="form__hint hidden" id="user-student-fields-hint">教师账号可不填写学生档案中的年级、班级；班主任请在下方单独配置负责班级。</div>';
    html += '<div id="user-homeroom-config" class="teacher-config-panel hidden">';
    html += '<div class="form__group"><label class="form__label form__label--required">负责年级</label><input class="form__input" id="user-managed-grade" value="' + (isEdit ? (user.managed_grade || '') : '') + '" placeholder="如：高一"></div>';
    html += '<div class="form__group"><label class="form__label form__label--required">负责班级</label><input class="form__input" id="user-managed-class" value="' + (isEdit ? (user.managed_class_name || '') : '') + '" placeholder="如：高一(11)班"></div>';
    html += '</div>';
    html += '<div id="user-event-config" class="teacher-config-panel hidden">';
    html += '<div class="form__group"><label class="form__label form__label--required">分配录入项目</label><select class="form__select teacher-event-select" id="user-assigned-events" multiple size="6">';
    html += eventList.length
      ? eventList.map((event) => '<option value="' + event.id + '"' + (currentAssignedEventIds.includes(Number(event.id)) ? ' selected' : '') + '>' + App._escHtml(event.name || '-') + ' · ' + App._escHtml(event.gender_group || '-') + '</option>').join('')
      : '<option value="">暂无可选项目</option>';
    html += '</select><div class="form__hint">按住 Ctrl 或 Shift 可多选，系统将直接把这些项目分配给当前任课教师。</div></div>';
    html += '</div>';
    html += '<div class="form__group"><label class="form__label">用户名</label><input class="form__input" id="user-username" value="' + (isEdit ? (user.username || '') : '') + '"></div>';
    html += '</div></div>';
    html += '<div class="modal__footer">';
    html += '<button class="btn btn--outline" onclick="App.hideModal()">取消</button>';
    html += '<button class="btn btn--primary" id="btn-save-user" data-id="' + (isEdit ? user.id : '') + '">保存</button>';
    html += '</div>';
    App.showModal(html);
    this._toggleTeacherConfigFields();
    document.getElementById('user-role')?.addEventListener('change', () => this._toggleTeacherConfigFields());
    document.getElementById('user-staff-type')?.addEventListener('change', () => this._toggleTeacherConfigFields());

    document.getElementById('btn-save-user').addEventListener('click', async () => {
      const id = document.getElementById('btn-save-user').dataset.id;
      const studentId = document.getElementById('user-student-id').value.trim();
      const name = document.getElementById('user-name').value.trim();
      const email = document.getElementById('user-email').value.trim();
      const password = document.getElementById('user-password') ? document.getElementById('user-password').value.trim() : '';
      const className = document.getElementById('user-class').value.trim();
      const grade = document.getElementById('user-grade').value.trim();
      const username = document.getElementById('user-username').value.trim();
      const role = document.getElementById('user-role').value;
      const staffType = role === 'admin' ? document.getElementById('user-staff-type').value : '';
      const managedGrade = document.getElementById('user-managed-grade')?.value.trim() || '';
      const managedClassName = document.getElementById('user-managed-class')?.value.trim() || '';
      const assignedEventIds = Array.from(document.getElementById('user-assigned-events')?.selectedOptions || [])
        .map((option) => Number(option.value))
        .filter(Boolean);

      if (!studentId || !name || !email) {
        App.showToast('请填写所有必填字段', 'warning');
        return;
      }
      if (!isEdit && !password) {
        App.showToast('请输入密码', 'warning');
        return;
      }
      if (role === 'student' && (!className || !grade)) {
        App.showToast('学生账号必须填写年级和班级', 'warning');
        return;
      }
      if (role === 'admin' && staffType === 'homeroom_teacher' && (!managedGrade || !managedClassName)) {
        App.showToast('班主任必须配置负责的年级和班级', 'warning');
        return;
      }
      if (role === 'admin' && staffType === 'event_teacher' && !assignedEventIds.length) {
        App.showToast('任课教师至少需要分配一个录入项目', 'warning');
        return;
      }
      const payload = {
        student_id: studentId,
        name,
        email,
        username: username || studentId,
        class_name: className,
        grade,
        role,
        staff_type: staffType,
        managed_grade: managedGrade,
        managed_class_name: managedClassName,
        assigned_event_ids: assignedEventIds
      };
      try {
        App.showLoading();
        if (isEdit) {
          await API.admin.updateUser(id, payload);
          App.showToast('用户信息已更新', 'success');
        } else {
          await API.post('/admin/users', { ...payload, password });
          App.showToast('用户添加成功', 'success');
        }
        App.hideModal();
        App.hideLoading();
        this._loadUsers(container);
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      }
    });
  },

  _showUsersImport(container) {
    let html = '<div class="modal__header"><h3 class="modal__title">批量导入用户</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body">';
    html += '<button type="button" class="btn btn-outline btn-sm mb-2" onclick="Admin._downloadTemplate(\'users\')"><i class="fas fa-download"></i> 下载Excel模板</button>';
    html += '<div class="form"><div class="form__group"><label class="form__label">选择 Excel 文件</label><input type="file" id="users-import-file" class="form__input" accept=".xlsx,.xls,.csv"></div>';
    html += '<div class="form__hint">表格需包含列：学号、姓名、班级、年级。密码默认为 123456。</div></div>';
    html += '</div>';
    html += '<div class="modal__footer">';
    html += '<button class="btn btn--outline" onclick="App.hideModal()">取消</button>';
    html += '<button class="btn btn--primary" id="btn-do-import-users">开始导入</button>';
    html += '</div>';
    App.showModal(html);

    document.getElementById('btn-do-import-users').addEventListener('click', async () => {
      const fileInput = document.getElementById('users-import-file');
      if (!fileInput.files || !fileInput.files[0]) {
        App.showToast('请选择文件', 'warning');
        return;
      }
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      try {
        App.showLoading();
        const res = await API.upload('/admin/users/batch', formData);
        App.hideLoading();
        App.hideModal();
        App.showToast(res.message || '导入完成', 'success');
        this._loadUsers(container);
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      }
    });
  },

  async _exportUsers(container) {
    try {
      App.showLoading();
      const res = await API.get('/admin/users/export');
      const data = res.data || [];
      App.hideLoading();
      this._exportExcel(data, '用户名单');
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  _confirmResetPassword(id, container) {
    App.showModal(
      '<div class="confirm-dialog">' +
      '<div class="confirm-dialog__icon confirm-dialog__icon--warning"><i class="fas fa-key"></i></div>' +
      '<div class="confirm-dialog__title">确认重置密码？</div>' +
      '<div class="confirm-dialog__desc">密码将被重置为 <strong>123456</strong></div>' +
      '<div class="modal__footer" style="justify-content:center;">' +
      '<button class="btn btn--outline" onclick="App.hideModal()">取消</button>' +
      '<button class="btn btn--primary" id="btn-confirm-reset-pwd">确认重置</button>' +
      '</div></div>'
    );
    document.getElementById('btn-confirm-reset-pwd').addEventListener('click', async () => {
      try {
        App.showLoading();
        await API.admin.resetUserPassword(id);
        App.hideLoading();
        App.hideModal();
        App.showToast('密码已重置为 123456', 'success');
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      }
    });
  },

  async _toggleUserStatus(id, currentStatus, container) {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      App.showLoading();
      await API.put('/admin/users/' + id + '/status', { status: newStatus });
      App.hideLoading();
      App.showToast(newStatus === 'active' ? '账号已启用' : '账号已禁用', 'success');
      this._loadUsers(container);
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  _confirmDeleteUser(id, container) {
    App.showModal(
      '<div class="confirm-dialog">' +
      '<div class="confirm-dialog__icon confirm-dialog__icon--danger"><i class="fas fa-trash"></i></div>' +
      '<div class="confirm-dialog__title">确认删除用户？</div>' +
      '<div class="confirm-dialog__desc">删除后不可恢复，该用户的所有报名和成绩数据也会被删除。</div>' +
      '<div class="modal__footer" style="justify-content:center;">' +
      '<button class="btn btn--outline" onclick="App.hideModal()">取消</button>' +
      '<button class="btn btn--danger" id="btn-confirm-delete-user">确认删除</button>' +
      '</div></div>'
    );
    document.getElementById('btn-confirm-delete-user').addEventListener('click', async () => {
      try {
        App.showLoading();
        await API.admin.deleteUser(id);
        App.hideLoading();
        App.hideModal();
        App.showToast('用户已删除', 'success');
        this._loadUsers(container);
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      }
    });
  },

  // ==================== 项目管理 ====================
  async renderEvents(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">项目管理</h3>
          <div class="card__actions">
            <button class="btn btn--primary btn--sm" id="btn-add-event"><i class="fas fa-plus"></i> 添加项目</button>
          </div>
        </div>
        <div class="card__body">
          <div class="table-container" id="events-table-container"></div>
        </div>
      </div>
    `;
    this._loadEvents(container);
    container.querySelector('#btn-add-event').addEventListener('click', () => this._showEventModal(null, container));
  },

  async _loadEvents(container) {
    try {
      App.showLoading();
      const res = await API.get('/admin/events');
      const list = res.data || [];
      App.hideLoading();

      const catMap = { track: '径赛', field: '田赛', team: '团体', other: '其他' };
      const typeMap = { individual: '个人', relay: '接力' };
      const genderMap = { male: '男子', female: '女子', mixed: '混合' };

      let html = '';
      if (list.length > 0) {
        html = '<table class="table table--striped"><thead><tr><th>ID</th><th>名称</th><th>分类</th><th>类型</th><th>性别组别</th><th>人数上限</th><th>场地</th><th>状态</th><th>操作</th></tr></thead><tbody>';
        list.forEach(e => {
          const statusBadge = e.status === 'active' ? '<span class="badge badge--active">启用</span>' : '<span class="badge badge--inactive">停用</span>';
          html += '<tr>';
          html += '<td>' + e.id + '</td>';
          html += '<td>' + e.name + '</td>';
          html += '<td>' + (catMap[e.category] || e.category || '-') + '</td>';
          html += '<td>' + (typeMap[e.event_type] || e.event_type || '-') + '</td>';
          html += '<td>' + (genderMap[e.gender_group] || e.gender_group || '-') + '</td>';
          html += '<td>' + (e.max_participants || '不限') + '</td>';
          html += '<td>' + (e.venue || '-') + '</td>';
          html += '<td>' + statusBadge + '</td>';
          html += '<td><div class="table__actions">';
          html += '<button class="btn btn--ghost btn--xs btn-edit-event" data-id="' + e.id + '"><i class="fas fa-edit"></i></button>';
          html += '<button class="btn btn--ghost btn--xs btn-delete-event" data-id="' + e.id + '" data-name="' + e.name + '" style="color:#ef4444;"><i class="fas fa-trash"></i></button>';
          html += '</div></td></tr>';
        });
        html += '</tbody></table>';
      } else {
        html = this._emptyState('fas fa-running', '暂无项目');
      }

      container.querySelector('#events-table-container').innerHTML = html;

      container.querySelectorAll('.btn-edit-event').forEach(btn => {
        btn.addEventListener('click', () => {
          const event = list.find(e => e.id == btn.dataset.id);
          if (event) this._showEventModal(event, container);
        });
      });
      container.querySelectorAll('.btn-delete-event').forEach(btn => {
        btn.addEventListener('click', () => this._confirmDeleteEvent(btn.dataset.id, btn.dataset.name, container));
      });
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  _showEventModal(event, container) {
    const isEdit = !!event;
    const title = isEdit ? '编辑项目' : '添加项目';
    let html = '<div class="modal__header"><h3 class="modal__title">' + title + '</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body"><div class="form">';
    html += '<div class="form__group"><label class="form__label form__label--required">项目名称</label><input class="form__input" id="event-name" value="' + (isEdit ? (event.name || '') : '') + '"></div>';
    html += '<div class="form__group"><label class="form__label">分类</label><select class="form__select" id="event-category">';
    ['track:径赛', 'field:田赛', 'team:团体', 'other:其他'].forEach(o => {
      const [val, label] = o.split(':');
      const sel = isEdit && event.category === val ? ' selected' : '';
      html += '<option value="' + val + '"' + sel + '>' + label + '</option>';
    });
    html += '</select></div>';
    html += '<div class="form__group"><label class="form__label">类型</label><select class="form__select" id="event-type">';
    ['individual:个人', 'relay:接力'].forEach(o => {
      const [val, label] = o.split(':');
      const sel = isEdit && event.event_type === val ? ' selected' : '';
      html += '<option value="' + val + '"' + sel + '>' + label + '</option>';
    });
    html += '</select></div>';
    html += '<div class="form__group"><label class="form__label">性别组别</label><select class="form__select" id="event-gender">';
    ['male:男子', 'female:女子', 'mixed:混合'].forEach(o => {
      const [val, label] = o.split(':');
      const sel = isEdit && event.gender_group === val ? ' selected' : '';
      html += '<option value="' + val + '"' + sel + '>' + label + '</option>';
    });
    html += '</select></div>';
    html += '<div class="form__group"><label class="form__label">人数上限</label><input class="form__input" id="event-max" type="number" value="' + (isEdit ? (event.max_participants || '') : '') + '" placeholder="0 表示不限"></div>';
    html += '<div class="form__group"><label class="form__label">比赛规则</label><textarea class="form__textarea" id="event-rules" rows="3">' + (isEdit ? (event.rules || '') : '') + '</textarea></div>';
    html += '<div class="form__group"><label class="form__label">场地</label><input class="form__input" id="event-venue" value="' + (isEdit ? (event.venue || '') : '') + '"></div>';
    if (isEdit) {
      html += '<div class="form__group"><label class="form__label">状态</label><select class="form__select" id="event-status">';
      html += '<option value="active"' + (event.status === 'active' ? ' selected' : '') + '>启用</option>';
      html += '<option value="inactive"' + (event.status === 'inactive' ? ' selected' : '') + '>停用</option>';
      html += '</select></div>';
    }
    html += '</div></div>';
    html += '<div class="modal__footer">';
    html += '<button class="btn btn--outline" onclick="App.hideModal()">取消</button>';
    html += '<button class="btn btn--primary" id="btn-save-event" data-id="' + (isEdit ? event.id : '') + '">保存</button>';
    html += '</div>';
    App.showModal(html);

    document.getElementById('btn-save-event').addEventListener('click', async () => {
      const id = document.getElementById('btn-save-event').dataset.id;
      const data = {
        name: document.getElementById('event-name').value.trim(),
        category: document.getElementById('event-category').value,
        event_type: document.getElementById('event-type').value,
        gender_group: document.getElementById('event-gender').value,
        max_participants: parseInt(document.getElementById('event-max').value) || 0,
        rules: document.getElementById('event-rules').value.trim(),
        venue: document.getElementById('event-venue').value.trim()
      };
      if (isEdit) {
        data.status = document.getElementById('event-status').value;
      }
      if (!data.name) {
        App.showToast('项目名称必填', 'warning');
        return;
      }
      try {
        App.showLoading();
        if (isEdit) {
          await API.admin.updateEvent(id, data);
          App.showToast('项目已更新', 'success');
        } else {
          await API.admin.createEvent(data);
          App.showToast('项目已添加', 'success');
        }
        App.hideModal();
        App.hideLoading();
        this._loadEvents(container);
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      }
    });
  },

  _confirmDeleteEvent(id, name, container) {
    App.showModal(
      '<div class="confirm-dialog">' +
      '<div class="confirm-dialog__icon confirm-dialog__icon--danger"><i class="fas fa-trash"></i></div>' +
      '<div class="confirm-dialog__title">确认删除项目 "<strong>' + name + '</strong>"？</div>' +
      '<div class="confirm-dialog__desc">删除后不可恢复，相关报名和赛程数据也会受影响。</div>' +
      '<div class="modal__footer" style="justify-content:center;">' +
      '<button class="btn btn--outline" onclick="App.hideModal()">取消</button>' +
      '<button class="btn btn--danger" id="btn-confirm-delete-event">确认删除</button>' +
      '</div></div>'
    );
    document.getElementById('btn-confirm-delete-event').addEventListener('click', async () => {
      try {
        App.showLoading();
        await API.admin.deleteEvent(id);
        App.hideLoading();
        App.hideModal();
        App.showToast('项目已删除', 'success');
        this._loadEvents(container);
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      }
    });
  },

  // ==================== 报名管理 ====================
  _regPage: 1,
  _regLimit: 20,
  _regFilters: { grade: [], class_name: [], grade_multi: true, class_multi: true, gender: '', event_id: '', status: '' },
  _regFilterData: null,

  async renderRegistrations(container) {
    this._regPage = 1;
    container.innerHTML = `
      <div class="card" style="margin-bottom:24px;">
        <div class="card__header"><h3 class="card__title">报名记录</h3><div class="card__actions"><button class="btn btn--outline btn--sm" id="btn-export-reg"><i class="fas fa-download"></i> 导出报名表</button></div></div>
        <div class="card__body">
          <div class="empty-state" style="padding:1rem 0 1.25rem;text-align:left">
            <div class="empty-state__desc">管理员审核流程已下线，当前页面仅保留只读查看与导出能力。报名审核与取消审核统一由班主任在教师端处理。</div>
          </div>
          <div class="search-filter-bar" id="reg-filter-bar"></div>
          <div class="table-container" id="reg-table-container"></div>
          <div id="reg-pagination"></div>
        </div>
      </div>
      <div class="card-grid card-grid--2" style="margin-bottom:24px;">
        <div class="card"><div class="card__header"><h3 class="card__title">项目报名热度</h3></div><div class="card__body"><canvas id="chart-reg-heat" style="max-height:280px;"></canvas></div></div>
        <div class="card"><div class="card__header"><h3 class="card__title">未报名学生</h3></div><div class="card__body" id="reg-unregistered"></div></div>
      </div>
      <div class="card"><div class="card__header"><h3 class="card__title">报名统计</h3></div><div class="card__body" id="reg-stats-table"></div></div>
    `;
    this._renderRegFilter(container);
    this._loadRegistrations(container);
    this._renderRegPieChart(container);
    this._loadRegStats(container);
    this._bindRegEvents(container);
  },

  _renderRegFilter(container) {
    const bar = container.querySelector('#reg-filter-bar');
    const f = this._regFilters;
    const labels = [];
    if (f.grade.length) labels.push('年级：' + f.grade.join('、'));
    if (f.class_name.length) labels.push('班级：' + f.class_name.join('、'));
    if (f.gender) labels.push('性别：' + (f.gender === 'male' ? '男' : '女'));
    if (f.status) labels.push('状态：' + ({pending:'待审核',approved:'已通过',rejected:'已驳回',cancelling:'取消审核中'}[f.status] || f.status));
    if (f.event_id && this._regFilterData) {
      const evt = this._regFilterData.events.find(e => e.id == f.event_id);
      if (evt) labels.push('项目：' + evt.name);
    }
    bar.innerHTML = `
      <button class="btn btn--primary btn--sm" id="btn-reg-filter"><i class="fas fa-filter"></i> 筛选</button>
      ${labels.length > 0 ? '<span class="text-sm" style="color:var(--red);margin-left:8px">当前筛选：' + labels.join(' / ') + ' <a href="javascript:void(0)" id="btn-reg-clear" style="color:var(--text3)">[清除]</a></span>' : ''}
    `;
    bar.querySelector('#btn-reg-clear')?.addEventListener('click', () => {
      this._regFilters = { grade: [], class_name: [], grade_multi: true, class_multi: true, gender: '', event_id: '', status: '' };
      this._regPage = 1;
      this._renderRegFilter(container);
      this._loadRegistrations(container);
    });
    bar.querySelector('#btn-reg-filter')?.addEventListener('click', () => this._showRegFilterModal(container));
  },

  async _showRegFilterModal(container) {
    if (!this._regFilterData) {
      try {
        const gradesRes = await API.public.getGrades();
        const eventsRes = await API.get('/admin/events');
        this._regFilterData = {
          dictionary: this._buildGradeClassDictionary(gradesRes.data || {}),
          events: eventsRes.data || []
        };
      } catch (e) { App.showToast('加载筛选数据失败','error'); return; }
    }
    const f = this._regFilters;
    const eventOpts = this._regFilterData.events.map(e =>
      `<option value="${e.id}" ${f.event_id==e.id?'selected':''}>${e.name}</option>`
    ).join('');
    const genderOpts = `<option value="" ${!f.gender?'selected':''}>全部</option>
      <option value="male" ${f.gender==='male'?'selected':''}>男</option>
      <option value="female" ${f.gender==='female'?'selected':''}>女</option>`;
    const statusOpts = `<option value="" ${!f.status?'selected':''}>全部状态</option>
      <option value="pending" ${f.status==='pending'?'selected':''}>待审核</option>
      <option value="approved" ${f.status==='approved'?'selected':''}>已通过</option>
      <option value="rejected" ${f.status==='rejected'?'selected':''}>已驳回</option>`;

    const html = `
      <div class="modal-header"><h3>报名筛选</h3><button class="modal-close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>年级</label>
          <label class="text-sm" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--text2);"><input type="checkbox" id="reg-filter-grade-multi" ${f.grade_multi ? 'checked' : ''}> 下拉多选</label>
          <select id="reg-filter-grade" class="form__select"></select>
        </div>
        <div class="form-group">
          <label>班级</label>
          <label class="text-sm" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--text2);"><input type="checkbox" id="reg-filter-class-multi" ${f.class_multi ? 'checked' : ''}> 下拉多选</label>
          <select id="reg-filter-class" class="form__select"></select>
          <div class="form__hint" id="reg-filter-link-hint"></div>
        </div>
        <div class="form-group"><label>性别</label><select id="reg-filter-gender" class="form__select">${genderOpts}</select></div>
        <div class="form-group"><label>项目</label><select id="reg-filter-event" class="form__select"><option value="">全部项目</option>${eventOpts}</select></div>
        <div class="form-group"><label>状态</label><select id="reg-filter-status" class="form__select">${statusOpts}</select></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn--outline btn--sm" id="btn-reg-filter-cancel">取消</button>
        <button class="btn btn--primary btn--sm" id="btn-reg-filter-apply">确定筛选</button>
      </div>`;
    App.showModal(html);
    const pickerState = {
      grade: this._normalizeFilterValues(f.grade),
      class_name: this._normalizeFilterValues(f.class_name)
    };
    this._bindGradeClassPicker('reg-filter', this._regFilterData.dictionary, pickerState);

    document.getElementById('btn-reg-filter-cancel').onclick = () => App.hideModal();
    document.getElementById('btn-reg-filter-apply').onclick = () => {
      const gradeValues = this._getSelectValues(document.getElementById('reg-filter-grade'));
      const classValues = this._getSelectValues(document.getElementById('reg-filter-class'));
      const gender = document.getElementById('reg-filter-gender')?.value || '';
      const eventId = document.getElementById('reg-filter-event')?.value || '';
      const status = document.getElementById('reg-filter-status')?.value || '';
      this._regFilters.grade = gradeValues;
      this._regFilters.class_name = classValues;
      this._regFilters.grade_multi = !!document.getElementById('reg-filter-grade-multi')?.checked;
      this._regFilters.class_multi = !!document.getElementById('reg-filter-class-multi')?.checked;
      this._regFilters.gender = gender;
      this._regFilters.event_id = eventId;
      this._regFilters.status = status;
      this._regPage = 1;
      App.hideModal();
      this._renderRegFilter(container);
      this._loadRegistrations(container);
    };
  },

  async _loadRegFilters(container) {
    try {
      const gradesRes = await API.public.getGrades();
      const classes = gradesRes.data && gradesRes.data.classes ? gradesRes.data.classes : [];
      const classSel = container.querySelector('#reg-class');
      classes.forEach(c => { const o = document.createElement('option'); o.value = c.name; o.textContent = c.name; classSel.appendChild(o); });

      const eventsRes = await API.get('/admin/events');
      const events = eventsRes.data || [];
      const eventSel = container.querySelector('#reg-event');
      events.forEach(e => { const o = document.createElement('option'); o.value = e.id; o.textContent = e.name; eventSel.appendChild(o); });
    } catch (e) {}
  },

  _bindRegEvents(container) {
    container.querySelector('#btn-export-reg').addEventListener('click', () => this._exportRegistrations());
  },

  async _loadRegistrations(container) {
    try {
      App.showLoading();
      const f = this._regFilters;
      const params = { page: this._regPage, limit: this._regLimit };
      if (f.grade.length) params.grade = f.grade.join(',');
      if (f.class_name.length) params.class_name = f.class_name.join(',');
      if (f.gender) params.gender = f.gender;
      if (f.event_id) params.event_id = f.event_id;
      if (f.status) params.status = f.status;

      const res = await API.admin.getRegistrations(params);
      const d = res.data || res;
      const list = d.list || [];
      const total = d.total || 0;
      this._regListData = list;
      App.hideLoading();

      let html = '';
      if (list.length > 0) {
        html = '<table class="table table--striped"><thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>年级</th><th>项目</th><th>状态</th><th>说明</th><th>操作</th></tr></thead><tbody>';
        list.forEach(r => {
          const statusMap = { pending: '<span class="badge badge--pending">待审核</span>', approved: '<span class="badge badge--approved">已通过</span>', rejected: '<span class="badge badge--rejected">已驳回</span>', cancelling: '<span class="badge badge--warning">取消审核中</span>' };
          html += '<tr><td>' + (r.student_id || '-') + '</td>';
          html += '<td>' + (r.user_name || '-') + '</td>';
          html += '<td>' + (r.class_name || '-') + '</td>';
          html += '<td>' + (r.grade || '-') + '</td>';
          html += '<td>' + (r.event_name || '-') + '</td>';
          html += '<td>' + (statusMap[r.status] || r.status) + '</td>';
          html += '<td>' + (r.status === 'pending' || r.status === 'cancelling' ? '请由班主任教师端处理' : '已归档') + '</td>';
          html += '<td><div class="table__actions">';
          html += '<button class="btn btn--outline btn--xs btn-detail-reg" data-id="' + r.id + '"><i class="fas fa-eye"></i> 详情</button>';
          html += '</div></td></tr>';
        });
        html += '</tbody></table>';
      } else {
        html = this._emptyState('fas fa-clipboard-list', '暂无报名记录');
      }

      container.querySelector('#reg-table-container').innerHTML = html;
      const pagInfo = this._paginate({ page: this._regPage, total, limit: this._regLimit, callback: (p) => { this._regPage = p; this._loadRegistrations(container); } });
      container.querySelector('#reg-pagination').innerHTML = this._renderPagination(pagInfo, 'reg-pagination');
      container.querySelectorAll('.btn-detail-reg').forEach(btn => {
        btn.addEventListener('click', () => this._showRegDetail(btn.dataset.id, container));
      });
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  async _showRegDetail(id, container) {
    try {
      App.showLoading();
      const res = await API.admin.getRegistrationDetail(id);
      App.hideLoading();
      const r = res.data;
      if (!r) return App.showToast('报名记录不存在', 'error');
      const statusMap = { pending: '待审核', approved: '已通过', rejected: '已驳回', cancelling: '取消审核中' };
      const categoryMap = { track: '径赛', field: '田赛', relay: '接力', team: '集体' };
      const typeMap = { individual: '个人', team: '团体' };
      const genderMap = { male: '男子', female: '女子', mixed: '混合' };
      let html = '<div class="modal-header"><h3>报名详情</h3><button class="modal-close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
      html += '<div class="modal-body">';
      html += '<div class="detail-grid">';
      html += '<div><strong>学号</strong><br>' + (r.student_id || '-') + '</div>';
      html += '<div><strong>姓名</strong><br>' + (r.user_name || '-') + '</div>';
      html += '<div><strong>班级</strong><br>' + (r.class_name || '-') + '</div>';
      html += '<div><strong>年级</strong><br>' + (r.grade || '-') + '</div>';
      html += '<div><strong>性别</strong><br>' + (genderMap[r.gender] || r.gender || '-') + '</div>';
      html += '<div><strong>邮箱</strong><br>' + (r.email || '-') + '</div>';
      html += '</div>';
      html += '<hr style="margin:12px 0">';
      html += '<div class="detail-grid">';
      html += '<div><strong>报名项目</strong><br>' + (r.event_name || '-') + '</div>';
      html += '<div><strong>项目分类</strong><br>' + (categoryMap[r.category] || r.category || '-') + '</div>';
      html += '<div><strong>项目类型</strong><br>' + (typeMap[r.event_type] || r.event_type || '-') + '</div>';
      html += '<div><strong>性别组别</strong><br>' + (genderMap[r.gender_group] || r.gender_group || '-') + '</div>';
      html += '<div><strong>比赛场地</strong><br>' + (r.venue || '-') + '</div>';
      html += '<div><strong>审核状态</strong><br><span style="color:' + (r.status === 'approved' ? 'var(--green)' : r.status === 'rejected' ? 'var(--red)' : '#e07a5f') + ';font-weight:600">' + (statusMap[r.status] || r.status) + '</span></div>';
      html += '</div>';
      html += '<hr style="margin:12px 0">';
      html += '<div class="detail-grid">';
      html += '<div><strong>报名时间</strong><br>' + App.formatDate(r.created_at) + '</div>';
      html += '<div><strong>审核时间</strong><br>' + (r.reviewed_at ? App.formatDate(r.reviewed_at) : '-') + '</div>';
      html += '<div><strong>审核人</strong><br>' + (r.reviewer_name || '-') + '</div>';
      html += '<div><strong>驳回原因</strong><br>' + (r.reject_reason || '-') + '</div>';
      html += '</div>';
      html += '</div><div class="modal-footer"><button class="btn btn-secondary" onclick="App.hideModal()">关闭</button></div>';
      App.showModal(html);
    } catch(e) { App.hideLoading(); App.showToast(e.message, 'error'); }
  },

  async _renderRegPieChart(container) {
    const canvas = container.querySelector('#chart-reg-heat');
    if (!canvas) return;
    this._chartInstances = this._chartInstances.filter(c => {
      if (c.canvas === canvas) { try { c.destroy(); } catch (_) {} return false; }
      return true;
    });
    if (typeof Chart === 'undefined') return;
    try {
      // 加载全部报名数据用于图表（不受筛选影响）
      const res = await API.admin.getRegistrations({ limit: 99999 });
      const list = (res.data?.list || res.data || []);
      if (list.length === 0) {
        canvas.parentElement.innerHTML = '<p class="text-muted text-center" style="padding:2rem">暂无报名数据</p>';
        return;
      }
      const eventMap = {};
      list.forEach(r => {
        const key = r.event_name || '未知项目';
        eventMap[key] = (eventMap[key] || 0) + 1;
      });
      const labels = Object.keys(eventMap);
      const data = Object.values(eventMap);
      const colors = ['#a51d2d','#2d6a4f','#1e6091','#e07a5f','#b8860b','#7c3aed','#0284c7','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];
      const clickHandler = (evt, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const eventName = labels[idx];
          this._regFilters = { ...this._regFilters, event_id: '' };
          if (this._regFilterData) {
            const evtObj = this._regFilterData.events.find(e => e.name === eventName);
            if (evtObj) this._regFilters.event_id = String(evtObj.id);
          }
          this._regPage = 1;
          this._renderRegFilter(container);
          this._loadRegistrations(container);
        }
      };
      const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors.slice(0, labels.length),
            borderColor: '#fff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: clickHandler,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 12, usePointStyle: true, pointStyleWidth: 10 }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.raw} 人 (${((ctx.raw / data.reduce((a,b)=>a+b,0)) * 100).toFixed(1)}%)`
              }
            }
          }
        }
      });
      this._chartInstances.push(chart);
    } catch (e) {}
  },

  async _loadRegStats(container) {
    try {
      // 加载全部报名数据（不受筛选影响）
      const res = await API.admin.getRegistrations({ limit: 99999 });
      const list = (res.data?.list || res.data || []);
      this._regAllData = list;

      const categoryMap = { track: '径赛', field: '田赛', relay: '接力', team: '集体' };
      const genderMap = { male: '男子', female: '女子', mixed: '混合' };

      const total = list.length;
      const pending = list.filter(r => r.status === 'pending').length;
      const approved = list.filter(r => r.status === 'approved').length;
      const rejected = list.filter(r => r.status === 'rejected').length;

      let statsHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">';
      statsHtml += `<div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">报名总数</div></div>`;
      statsHtml += `<div class="stat-card"><div class="stat-num" style="color:#e07a5f">${pending}</div><div class="stat-label">待审核</div></div>`;
      statsHtml += `<div class="stat-card"><div class="stat-num" style="color:#52b788">${approved}</div><div class="stat-label">已通过</div></div>`;
      statsHtml += `<div class="stat-card"><div class="stat-num" style="color:#dc2626">${rejected}</div><div class="stat-label">已驳回</div></div>`;
      statsHtml += '</div>';

      const eventMap = {};
      list.forEach(r => {
        const key = r.event_name || '未知';
        if (!eventMap[key]) eventMap[key] = { name: key, category: r.category || '', gender_group: r.gender_group || '', count: 0, pending: 0, approved: 0, rejected: 0 };
        eventMap[key].count++;
        if (r.status === 'pending') eventMap[key].pending++;
        else if (r.status === 'approved') eventMap[key].approved++;
        else eventMap[key].rejected++;
      });
      const eventStats = Object.values(eventMap).sort((a, b) => b.count - a.count);

      statsHtml += '<table class="table table--striped"><thead><tr><th>项目</th><th>分类</th><th>组别</th><th>报名数</th><th>待审</th><th>通过</th><th>驳回</th></tr></thead><tbody>';
      if (eventStats.length > 0) {
        eventStats.forEach(e => {
          statsHtml += `<tr><td>${e.name}</td><td>${categoryMap[e.category] || e.category}</td><td>${genderMap[e.gender_group] || e.gender_group}</td><td><strong>${e.count}</strong></td><td style="color:#e07a5f">${e.pending || '-'}</td><td style="color:#52b788">${e.approved || '-'}</td><td style="color:#dc2626">${e.rejected || '-'}</td></tr>`;
        });
      } else {
        statsHtml += '<tr><td colspan="7"><p class="text-muted text-center">暂无报名数据</p></td></tr>';
      }
      statsHtml += '</tbody></table>';
      container.querySelector('#reg-stats-table').innerHTML = statsHtml;

      try {
        const statsRes = await API.get('/admin/registrations/stats');
        const sData = statsRes.data || {};
        const unregistered = sData.unregistered || [];
        let unregHtml = '';
        if (unregistered.length > 0) {
          unregHtml = '<div style="max-height:300px;overflow-y:auto;"><table class="table table--striped"><thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>年级</th></tr></thead><tbody>';
          unregistered.forEach(u => { unregHtml += '<tr><td>' + u.student_id + '</td><td>' + u.name + '</td><td>' + u.class_name + '</td><td>' + u.grade + '</td></tr>'; });
          unregHtml += '</tbody></table></div>';
          unregHtml += '<div style="padding:8px;color:#6b7280;font-size:0.875rem;">共 ' + unregistered.length + ' 名学生未报名</div>';
        } else {
          unregHtml = this._emptyState('fas fa-check-circle', '全部学生已报名');
        }
        container.querySelector('#reg-unregistered').innerHTML = unregHtml;
      } catch (_) {}
    } catch (e) {}
  },

  async _exportRegistrations() {
    try {
      App.showLoading();
      const res = await API.get('/admin/registrations/export');
      App.hideLoading();
      this._exportExcel(res.data || [], '报名记录');
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  // ==================== 赛程编排 ====================
  async renderSchedules(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">赛程编排</h3>
          <div class="card__actions">
            <button class="btn btn--primary btn--sm" id="btn-add-schedule"><i class="fas fa-plus"></i> 添加赛程</button>
            <button class="btn btn--accent btn--sm" id="btn-ai-schedule"><i class="fas fa-robot"></i> AI 智能编排</button>
            <button class="btn btn--success btn--sm" id="btn-auto-schedule"><i class="fas fa-magic"></i> 自动编排</button>
            <button class="btn btn--warning btn--sm" id="btn-publish-schedules"><i class="fas fa-bullhorn"></i> 发布赛程</button>
            <button class="btn btn--outline btn--sm" id="btn-export-schedules"><i class="fas fa-download"></i> 导出赛程表</button>
          </div>
        </div>
        <div class="card__body">
          <div class="table-container" id="schedules-table-container"></div>
        </div>
      </div>
    `;
    this._loadSchedules(container);
    this._bindSchedulesEvents(container);
  },

  _bindSchedulesEvents(container) {
    container.querySelector('#btn-add-schedule').addEventListener('click', () => this._showScheduleModal(null, container));
    container.querySelector('#btn-ai-schedule').addEventListener('click', () => this._showAISchedule(container));
    container.querySelector('#btn-auto-schedule').addEventListener('click', () => this._showAutoSchedule(container));
    container.querySelector('#btn-publish-schedules').addEventListener('click', () => this._publishSchedules(container));
    container.querySelector('#btn-export-schedules').addEventListener('click', () => this._exportSchedules());
  },

  async _loadSchedules(container) {
    try {
      App.showLoading();
      const res = await API.get('/admin/schedules');
      const list = res.data || [];
      App.hideLoading();

      const statusMap = { draft: '<span class="badge badge--inactive">草稿</span>', published: '<span class="badge badge--active">已发布</span>', completed: '<span class="badge badge--success">已完成</span>', cancelled: '<span class="badge badge--error">已取消</span>' };

      let html = '';
      if (list.length > 0) {
        html = '<table class="table table--striped"><thead><tr><th><input type="checkbox" id="schedule-select-all"></th><th>项目</th><th>轮次</th><th>开始时间</th><th>结束时间</th><th>场地</th><th>组数</th><th>状态</th><th>操作</th></tr></thead><tbody>';
        list.forEach(s => {
          html += '<tr><td><input type="checkbox" class="schedule-checkbox" data-id="' + s.id + '"></td>';
          html += '<td>' + (s.event_name || '-') + '</td>';
          html += '<td>' + (s.round_name || '-') + '</td>';
          html += '<td>' + (s.start_time || '-') + '</td>';
          html += '<td>' + (s.end_time || '-') + '</td>';
          html += '<td>' + (s.venue || '-') + '</td>';
          html += '<td>' + (s.max_heats || 1) + '</td>';
          html += '<td>' + (statusMap[s.status] || s.status) + '</td>';
          html += '<td><div class="table__actions">';
          html += '<button class="btn btn--ghost btn--xs btn-edit-schedule" data-id="' + s.id + '"><i class="fas fa-edit"></i></button>';
          html += '<button class="btn btn--ghost btn--xs btn-delete-schedule" data-id="' + s.id + '" style="color:#ef4444;"><i class="fas fa-trash"></i></button>';
          html += '<button class="btn btn--info btn--xs" onclick="Admin._viewParticipants(' + s.id + ',\'' + (s.event_name||s.event_id||'').replace(/'/g,"\\'") + '\')">参赛者</button>';
          html += '</div></td></tr>';
        });
        html += '</tbody></table>';
      } else {
        html = this._emptyState('fas fa-calendar-alt', '暂无赛程');
      }

      container.querySelector('#schedules-table-container').innerHTML = html;

      const selectAll = container.querySelector('#schedule-select-all');
      if (selectAll) {
        selectAll.addEventListener('change', () => {
          container.querySelectorAll('.schedule-checkbox').forEach(cb => { cb.checked = selectAll.checked; });
        });
      }

      container.querySelectorAll('.btn-edit-schedule').forEach(btn => {
        btn.addEventListener('click', () => {
          const sched = list.find(s => s.id == btn.dataset.id);
          if (sched) this._showScheduleModal(sched, container);
        });
      });
      container.querySelectorAll('.btn-delete-schedule').forEach(btn => {
        btn.addEventListener('click', () => this._confirmDeleteSchedule(btn.dataset.id, container));
      });
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  async _showScheduleModal(schedule, container) {
    const isEdit = !!schedule;
    let eventsOpts = '';
    try {
      const eventsRes = await API.get('/admin/events');
      const events = eventsRes.data || [];
      events.forEach(e => {
        const sel = isEdit && schedule.event_id === e.id ? ' selected' : '';
        eventsOpts += '<option value="' + e.id + '"' + sel + '>' + e.name + '</option>';
      });
    } catch (e) {}

    const title = isEdit ? '编辑赛程' : '添加赛程';
    let html = '<div class="modal__header"><h3 class="modal__title">' + title + '</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body"><div class="form">';
    html += '<div class="form__group"><label class="form__label form__label--required">项目</label><select class="form__select" id="sched-event">' + eventsOpts + '</select></div>';
    html += '<div class="form__group"><label class="form__label">轮次</label><select class="form__select" id="sched-round">';
    ['预赛:预赛', '复赛:复赛', '半决赛:半决赛', '决赛:决赛'].forEach(o => {
      const [val, label] = o.split(':');
      const sel = isEdit && schedule.round_name === val ? ' selected' : '';
      html += '<option value="' + val + '"' + sel + '>' + label + '</option>';
    });
    html += '</select></div>';
    html += '<div class="form__group"><label class="form__label form__label--required">开始时间</label><input class="form__input" id="sched-start" type="datetime-local" value="' + (isEdit ? (schedule.start_time || '').replace(' ', 'T').substring(0, 16) : '') + '"></div>';
    html += '<div class="form__group"><label class="form__label">结束时间</label><input class="form__input" id="sched-end" type="datetime-local" value="' + (isEdit ? (schedule.end_time || '').replace(' ', 'T').substring(0, 16) : '') + '"></div>';
    html += '<div class="form__group"><label class="form__label">场地</label><input class="form__input" id="sched-venue" value="' + (isEdit ? (schedule.venue || '') : '') + '"></div>';
    html += '<div class="form__group"><label class="form__label">组数</label><input class="form__input" id="sched-heats" type="number" value="' + (isEdit ? (schedule.max_heats || 1) : 1) + '"></div>';
    html += '<div class="form__group"><label class="form__label">备注</label><textarea class="form__textarea" id="sched-note" rows="2">' + (isEdit ? (schedule.note || '') : '') + '</textarea></div>';
    if (isEdit) {
      html += '<div class="form__group"><label class="form__label">状态</label><select class="form__select" id="sched-status">';
      ['draft:草稿', 'published:已发布', 'completed:已完成', 'cancelled:已取消'].forEach(o => {
        const [val, label] = o.split(':');
        const sel = schedule.status === val ? ' selected' : '';
        html += '<option value="' + val + '"' + sel + '>' + label + '</option>';
      });
      html += '</select></div>';
    }
    html += '</div></div>';
    html += '<div class="modal__footer"><button class="btn btn--outline" onclick="App.hideModal()">取消</button><button class="btn btn--primary" id="btn-save-schedule" data-id="' + (isEdit ? schedule.id : '') + '">保存</button></div>';
    App.showModal(html);

    document.getElementById('btn-save-schedule').addEventListener('click', async () => {
      const id = document.getElementById('btn-save-schedule').dataset.id;
      const data = {
        event_id: parseInt(document.getElementById('sched-event').value),
        round_name: document.getElementById('sched-round').value,
        start_time: document.getElementById('sched-start').value,
        end_time: document.getElementById('sched-end').value,
        venue: document.getElementById('sched-venue').value.trim(),
        max_heats: parseInt(document.getElementById('sched-heats').value) || 1,
        note: document.getElementById('sched-note').value.trim()
      };
      if (isEdit) data.status = document.getElementById('sched-status').value;
      if (!data.event_id || !data.start_time) { App.showToast('项目和开始时间必填', 'warning'); return; }
      try {
        App.showLoading();
        if (isEdit) {
          await API.admin.updateSchedule(id, data);
          App.showToast('赛程已更新', 'success');
        } else {
          await API.admin.createSchedule(data);
          App.showToast('赛程已创建', 'success');
        }
        App.hideModal();
        App.hideLoading();
        this._loadSchedules(container);
      } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
    });
  },

  _showAutoSchedule(container) {
    let html = '<div class="modal__header"><h3 class="modal__title">自动编排赛程</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body"><div class="form">';
    html += '<div class="form__group"><label class="form__label">开始日期</label><input class="form__input" id="auto-start-date" type="date" value="2026-06-01"></div>';
    html += '<div class="form__hint">系统将根据所有启用项目的报名人数，自动分配时间段和场地。已存在的赛程将被保留。</div>';
    html += '</div></div>';
    html += '<div class="modal__footer"><button class="btn btn--outline" onclick="App.hideModal()">取消</button><button class="btn btn--primary" id="btn-do-auto-schedule">开始自动编排</button></div>';
    App.showModal(html);

    document.getElementById('btn-do-auto-schedule').addEventListener('click', async () => {
      const startDate = document.getElementById('auto-start-date').value;
      try {
        App.showLoading();
        const res = await API.post('/admin/schedules/auto', { start_date: startDate });
        App.hideLoading();
        App.hideModal();
        App.showToast(res.message || '自动编排完成', 'success');
        this._loadSchedules(container);
      } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
    });
  },

  // AI 智能编排赛程
  _aiScheduleData: null,
  async _showAISchedule(container) {
    App.showLoading();
    try {
      const res = await API.ai.generateSchedule();
      App.hideLoading();
      if (!res.success) { App.showToast(res.error || '生成失败', 'error'); return; }
      this._aiScheduleData = res.data;

      const sections = [
        { key: 'day1_am', label: '第一天 上午 (08:00-12:00)' },
        { key: 'day1_pm', label: '第一天 下午 (14:00-17:00)' },
        { key: 'day2_am', label: '第二天 上午 (08:00-12:00)' },
        { key: 'day2_pm', label: '第二天 下午 (14:00-17:00)' }
      ];

      let html = '<div class="modal__header"><h3 class="modal__title">AI 智能赛程编排</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
      html += '<div class="modal__body"><div style="max-height:60vh;overflow-y:auto">';
      sections.forEach(sec => {
        const items = this._aiScheduleData[sec.key];
        if (!items || !items.length) return;
        html += `<h4 style="margin:12px 0 6px;color:var(--primary)">${sec.label}</h4>`;
        html += '<table class="table table--striped" style="font-size:.75rem"><thead><tr><th style="width:8%">时间</th><th style="width:22%">项目</th><th style="width:18%">轮次</th><th style="width:10%">场地</th><th style="width:42%">参赛者</th></tr></thead><tbody>';
        items.forEach(it => {
          html += `<tr><td style="white-space:nowrap">${it.time||'-'}</td><td>${it.event||'-'}</td><td>${it.round||'-'} <span class="badge badge--info">${it.groupSize||'?'}人</span></td><td>${it.venue||'-'}</td><td style="font-size:.7rem;line-height:1.4">${(it.students||[]).join('、')||'-'}</td></tr>`;
        });
        html += '</tbody></table>';
      });
      html += '</div></div>';
      html += '<div class="modal__footer">';
      html += '<button class="btn btn--outline" onclick="App.hideModal()">关闭</button>';
      html += '<button class="btn btn--primary" id="btn-ai-save"><i class="fas fa-save"></i> 确认并导入赛程</button>';
      html += '<button class="btn btn--success" id="btn-ai-pdf"><i class="fas fa-file-pdf"></i> 导出 PDF</button>';
      html += '</div>';
      App.showModal(html);

      document.getElementById('btn-ai-pdf').addEventListener('click', () => this._downloadSchedulePDF());
      document.getElementById('btn-ai-save').addEventListener('click', async () => {
        if (!this._aiScheduleData) return;
        App.showLoading();
        try {
          // 将 AI 结果导入为赛程记录
          let saved = 0;
          for (const sec of Object.values(this._aiScheduleData)) {
            if (!sec || !sec.length) continue;
            for (const item of sec) {
              const eventRes = await API.get('/public/events?gender_group=' + (item.gender || ''));
              // 简化：按项目名匹配
              const events = (eventRes.data || []);
              const matched = events.find(e => item.event && item.event.includes(e.name));
              if (matched) {
                await API.admin.createSchedule({
                  event_id: matched.id,
                  round_name: item.round || '预赛',
                  start_time: item.time || '',
                  venue: item.venue || '',
                  max_heats: 1,
                  note: (item.students || []).join('、')
                });
                saved++;
              }
            }
          }
          App.hideLoading();
          App.hideModal();
          App.showToast(`已导入 ${saved} 条赛程`, 'success');
          this._loadSchedules(container);
        } catch (e) { App.hideLoading(); App.showToast('导入失败: ' + e.message, 'error'); }
      });
    } catch(e) {
      App.hideLoading();
      App.showToast('AI 生成失败: ' + e.message, 'error');
    }
  },

  _downloadSchedulePDF() {
    if (!this._aiScheduleData) return;
    App.showLoading();
    // 直接 fetch PDF 并在新窗口打开
    fetch('/api/ai/export-schedule-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.token },
      body: JSON.stringify({ schedule: this._aiScheduleData })
    }).then(res => res.blob()).then(blob => {
      App.hideLoading();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      App.showToast('PDF 已生成', 'success');
    }).catch(e => {
      App.hideLoading();
      App.showToast('PDF 生成失败: ' + e.message, 'error');
    });
  },

  async _publishSchedules(container) {
    const ids = [];
    container.querySelectorAll('.schedule-checkbox:checked').forEach(cb => ids.push(parseInt(cb.dataset.id)));
    if (ids.length === 0) { App.showToast('请勾选要发布的赛程', 'warning'); return; }
    try {
      App.showLoading();
      await API.put('/admin/schedules/publish', { ids });
      App.hideLoading();
      App.showToast('已发布 ' + ids.length + ' 个赛程', 'success');
      this._loadSchedules(container);
    } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
  },

  async _exportSchedules() {
    try {
      App.showLoading();
      const res = await API.get('/admin/schedules/export');
      App.hideLoading();
      this._exportExcel(res.data || [], '赛程表');
    } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
  },

  _confirmDeleteSchedule(id, container) {
    App.showModal(
      '<div class="confirm-dialog">' +
      '<div class="confirm-dialog__icon confirm-dialog__icon--danger"><i class="fas fa-trash"></i></div>' +
      '<div class="confirm-dialog__title">确认删除赛程？</div>' +
      '<div class="confirm-dialog__desc">删除后不可恢复，相关成绩数据也会受影响。</div>' +
      '<div class="modal__footer" style="justify-content:center;">' +
      '<button class="btn btn--outline" onclick="App.hideModal()">取消</button>' +
      '<button class="btn btn--danger" id="btn-confirm-delete-schedule">确认删除</button>' +
      '</div></div>'
    );
    document.getElementById('btn-confirm-delete-schedule').addEventListener('click', async () => {
      try {
        App.showLoading();
        await API.admin.deleteSchedule(id);
        App.hideLoading();
        App.hideModal();
        App.showToast('赛程已删除', 'success');
        this._loadSchedules(container);
      } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
    });
  },

  // ==================== 成绩管理 ====================
  _resultsPage: 1,
  _resultsLimit: 20,
  _resultsFilters: { grade: [], class_name: [], grade_multi: true, class_multi: true, event_id: '', award: '', is_published: '' },
  _resultsFilterData: null,
  _resultDraftStorageKey: 'sportsMeet.admin.resultDrafts',
  _studentDirectoryCache: null,

  async renderResults(container) {
    this._resultsPage = 1;
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">成绩管理</h3>
          <div class="card__actions">
            <button class="btn btn--primary btn--sm" id="btn-add-result"><i class="fas fa-plus"></i> 录入成绩</button>
            <button class="btn btn--outline btn--sm" id="btn-import-results"><i class="fas fa-upload"></i> 批量导入</button>
            <button class="btn btn--warning btn--sm" id="btn-auto-rank"><i class="fas fa-sort-numeric-down"></i> 自动排名</button>
            <button class="btn btn--success btn--sm" id="btn-publish-results"><i class="fas fa-bullhorn"></i> 公示</button>
            <button class="btn btn--outline btn--sm" id="btn-unpublish-results"><i class="fas fa-undo"></i> 撤回公示</button>
            <button class="btn btn--outline btn--sm" id="btn-export-results"><i class="fas fa-download"></i> 导出获奖名单</button>
          </div>
        </div>
        <div class="card__body">
          <div class="search-filter-bar" id="results-filter-bar"></div>
          <div class="table-container" id="results-table-container"></div>
          <div id="results-pagination"></div>
        </div>
      </div>
    `;
    this._renderResultsFilter(container);
    this._loadResults(container);
    this._bindResultsEvents(container);
  },

  async renderForumManagement(container) {
    container.innerHTML = '<div class="text-center p-8"><div class="spinner"></div><p class="text-muted mt-2">正在加载论坛管理数据...</p></div>';
    try {
      const [statsRes, postsRes, repliesRes] = await Promise.all([
        API.forum.getAdminStats(),
        API.forum.getAdminPosts({ status: 'pending', limit: 8 }),
        API.forum.getPendingReplies()
      ]);
      const stats = statsRes.data || {};
      const overview = stats.overview || {};
      const pendingPosts = postsRes.data?.list || [];
      const pendingReplies = repliesRes.data || [];
      const reports = stats.reports || [];
      const hotPosts = stats.hot_posts || [];

      // 统计卡片增加 AI 审核状态
      const aiModerationEnabled = stats.moderator_enabled || stats.overview?.moderation_enabled;
      const aiStats = stats.overview?.ai_reviewed !== undefined ? stats.overview : stats;
      let html = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px">';
      [
        { label: '帖子总数', value: overview.total_posts || 0, icon: 'fa-file-lines' },
        { label: '待审帖子', value: overview.pending_posts || 0, icon: 'fa-hourglass-half' },
        { label: '已审帖子', value: overview.approved_posts || 0, icon: 'fa-circle-check' },
        { label: 'AI 审核次数', value: aiStats.ai_reviewed || 0, icon: 'fa-robot', color: 'var(--purple)' },
        { label: 'AI 拦截数', value: aiStats.ai_rejected || 0, icon: 'fa-shield-haltered', color: 'var(--red)' },
        { label: 'AI 审核', value: aiModerationEnabled ? '已开启' : '未开启', icon: aiModerationEnabled ? 'fa-toggle-on' : 'fa-toggle-off', color: aiModerationEnabled ? 'var(--green)' : 'var(--text3)' }
      ].forEach((item) => {
        html += `<div class="stat-card"><i class="fas ${item.icon}" style="color:${item.color || ''}"></i><div class="stat-num">${item.value}</div><div class="stat-label">${item.label}</div></div>`;
      });
      html += '</div>';

      html += '<div class="card-grid card-grid--2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">';
      html += '<div class="card"><div class="card__header"><h3 class="card__title">待审核帖子</h3></div><div class="card__body">';
      if (pendingPosts.length) {
        html += pendingPosts.map((post) => {
          const aiMod = post.ai_moderation || '';
          const [aiAction, aiReason] = aiMod.split('|');
          const aiBadge = aiAction === 'ai_approve_post' ? '<span class="badge" style="background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7">AI 通过</span>'
            : aiAction === 'ai_reject_post' ? '<span class="badge" style="background:#fce4ec;color:#c62828;border:1px solid #ef9a9a">AI 驳回</span>'
            : '';
          const aiReasonText = aiReason ? `<span style="font-size:.7rem;color:var(--text3);margin-left:6px">${this._escapeHtml(aiReason)}</span>` : '';
          return `
          <div class="friend-card" style="margin-bottom:12px;">
            <div class="friend-card__body">
              <div class="friend-card__top"><strong>${this._escapeHtml(post.title)}</strong><small>${this._escapeHtml(post.author_name || '-')}</small>${aiBadge}${aiReasonText}</div>
              <p>${this._escapeHtml(post.summary || '')}</p>
              <div class="friend-card__actions">
                <button class="btn btn--success btn--xs forum-admin-post-action" data-action="approve" data-id="${post.id}">通过</button>
                <button class="btn btn--warning btn--xs forum-admin-post-action" data-action="reject" data-id="${post.id}">驳回</button>
                <button class="btn btn--outline btn--xs forum-admin-post-action" data-action="feature" data-id="${post.id}">设为精华</button>
                <button class="btn btn--danger btn--xs forum-admin-post-action" data-action="delete" data-id="${post.id}">删除</button>
                <button class="btn btn--outline btn--xs forum-admin-mute-user" data-user-id="${post.user_id}">禁言作者</button>
              </div>
            </div>
          </div>
        `}).join('');
      } else {
        html += this._emptyState('fas fa-check-circle', '暂无待审核帖子');
      }
      html += '</div></div>';

      html += '<div class="card"><div class="card__header"><h3 class="card__title">待审核评论</h3></div><div class="card__body">';
      if (pendingReplies.length) {
        html += pendingReplies.map((reply) => `
          <div class="friend-card friend-card--request" style="margin-bottom:12px;">
            <div class="friend-card__body">
              <div class="friend-card__top"><strong>${this._escapeHtml(reply.author_name || '-')}</strong><small>${this._escapeHtml(reply.post_title || '-')}</small></div>
              <p>${this._escapeHtml(reply.content || '')}</p>
              <div class="friend-card__actions">
                <button class="btn btn--success btn--xs forum-admin-reply-action" data-action="approve" data-id="${reply.id}">通过</button>
                <button class="btn btn--warning btn--xs forum-admin-reply-action" data-action="reject" data-id="${reply.id}">驳回</button>
                <button class="btn btn--danger btn--xs forum-admin-reply-action" data-action="delete" data-id="${reply.id}">删除</button>
              </div>
            </div>
          </div>
        `).join('');
      } else {
        html += this._emptyState('fas fa-comment-slash', '暂无待审核评论');
      }
      html += '</div></div>';
      html += '</div>';

      html += '<div class="card" style="margin-top:20px;"><div class="card__header"><h3 class="card__title">举报与热帖概览</h3></div><div class="card__body">';
      html += '<div class="detail-grid" style="margin-bottom:16px;">';
      html += `<div><strong>待处理举报</strong><br>${reports.length} 条最新举报</div>`;
      html += `<div><strong>热门帖子</strong><br>${hotPosts.length} 条互动热帖</div>`;
      html += '</div>';
      html += '<div class="table-container"><table class="table"><thead><tr><th>类型</th><th>标题/原因</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>';
      if (reports.length) {
        reports.slice(0, 10).forEach((item) => {
          const targetLabel = item.target_type === 'reply' ? '评论举报' : '帖子举报';
          const actions = item.status === 'pending'
            ? `<div class="table-actions">
                 <button class="btn btn--warning btn--xs forum-admin-report-action" data-action="resolve" data-id="${item.id}">处理</button>
                 <button class="btn btn--outline btn--xs forum-admin-report-action" data-action="dismiss" data-id="${item.id}">驳回</button>
               </div>`
            : '<span class="text-muted">已处理</span>';
          html += `<tr><td>${this._escapeHtml(targetLabel)}</td><td>${this._escapeHtml((item.post_title || '帖子') + ' / ' + (item.reason || ''))}</td><td>${this._escapeHtml(item.status || '-')}</td><td>${this._escapeHtml(item.created_at || '-')}</td><td>${actions}</td></tr>`;
        });
      }
      if (hotPosts.length) {
        hotPosts.slice(0, 8).forEach((item) => {
          html += `<tr><td>热帖</td><td>${this._escapeHtml(item.title || '-')}</td><td>点赞 ${item.like_count || 0} / 收藏 ${item.favorite_count || 0}</td><td>评论 ${item.reply_count || 0}</td><td><span class="text-muted">概览</span></td></tr>`;
        });
      }
      if (!reports.length && !hotPosts.length) {
        html += `<tr><td colspan="5">${this._emptyState('fas fa-table', '暂无论坛统计数据')}</td></tr>`;
      }
      html += '</tbody></table></div></div></div>';

      container.innerHTML = html;
      container.querySelectorAll('.forum-admin-post-action').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const comment = action === 'reject' ? (window.prompt('请输入驳回原因') || '') : '';
          const res = await API.forum.auditPost(btn.dataset.id, { action, comment });
          if (res.success) {
            App.showToast(res.message || '操作成功', 'success');
            this.renderForumManagement(container);
          } else App.showToast(res.error || '操作失败', 'error');
        });
      });
      container.querySelectorAll('.forum-admin-reply-action').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const comment = action === 'reject' ? (window.prompt('请输入驳回原因') || '') : '';
          const res = await API.forum.auditReply(btn.dataset.id, { action, comment });
          if (res.success) {
            App.showToast(res.message || '操作成功', 'success');
            this.renderForumManagement(container);
          } else App.showToast(res.error || '操作失败', 'error');
        });
      });
      container.querySelectorAll('.forum-admin-report-action').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const comment = window.prompt(action === 'resolve' ? '请输入处理备注，可留空' : '请输入驳回备注，可留空', '') || '';
          let postAction = 'none';
          let muteHours = 0;
          if (action === 'resolve') {
            const postActionInput = window.prompt('请输入内容处理方式：none=仅结案，hide=隐藏内容，delete=删除内容', 'none');
            if (postActionInput === null) return;
            const normalizedAction = String(postActionInput || 'none').trim().toLowerCase();
            if (!['none', 'hide', 'delete'].includes(normalizedAction)) {
              App.showToast('内容处理方式无效', 'error');
              return;
            }
            postAction = normalizedAction;
            const muteInput = window.prompt('如需禁言请输入小时数，输入 0 表示不禁言', '0');
            if (muteInput === null) return;
            muteHours = Math.max(0, Number(muteInput) || 0);
          }
          const res = await API.forum.handleReport(btn.dataset.id, {
            action,
            comment,
            post_action: postAction,
            mute_user_hours: muteHours
          });
          if (res.success) {
            App.showToast(res.message || '操作成功', 'success');
            this.renderForumManagement(container);
          } else App.showToast(res.error || '操作失败', 'error');
        });
      });
      container.querySelectorAll('.forum-admin-mute-user').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const hours = window.prompt('请输入禁言小时数，输入 0 解除禁言', '24');
          if (hours === null) return;
          const res = await API.forum.muteUser(btn.dataset.userId, { duration_hours: Number(hours) || 0 });
          if (res.success) {
            App.showToast(res.message || '操作成功', 'success');
            this.renderForumManagement(container);
          } else App.showToast(res.error || '操作失败', 'error');
        });
      });
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state__desc">论坛管理加载失败：' + this._escapeHtml(e.message) + '</p></div>';
    }
  },

  async renderHighlightsAdmin(container) {
    container.innerHTML = '<h3>照片管理 · 首页精彩瞬间</h3><div class="admin-table-wrap" id="admin-highlights-table"><div class="text-center p-4"><div class="spinner"></div></div></div>';
    await this._loadHighlightsAdmin();
  },

  async _loadHighlightsAdmin() {
    const wrap = document.getElementById('admin-highlights-table');
    try {
      const res = await API.admin.getHighlights();
      const items = res.data || [];
      const statusMap = {
        pending: '<span class="badge badge--pending">待审核</span>',
        approved: '<span class="badge badge--approved">已通过</span>',
        rejected: '<span class="badge badge--rejected">已驳回</span>'
      };
      if (!items.length) { wrap.innerHTML = '<div class="empty-state"><div class="empty-state__icon"><i class="fas fa-images"></i></div><p>暂无照片</p><p class="text-sm text-muted">用户在首页上传后，照片将在此处显示</p></div>'; return; }
      wrap.innerHTML = '<table class="table"><thead><tr><th>预览</th><th>文件名</th><th>上传者</th><th>状态</th><th>AI审核</th><th>时间</th><th>操作</th></tr></thead><tbody>' +
        items.map(item => '<tr>' +
          '<td><img src="' + (item.url || '/images/' + item.filename) + '" class="admin-hl-thumb" data-lightbox="' + (item.url || '/images/' + item.filename) + '" style="width:120px;height:80px;object-fit:cover;border-radius:6px;cursor:zoom-in;border:1px solid var(--border)"></td>' +
          '<td style="font-size:.78rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + (item.original_name || item.filename || '') + '">' + (item.original_name || item.filename || '') + '</td>' +
          '<td>' + (item.uploader_name || '匿名') + '</td>' +
          '<td>' + (statusMap[item.status] || item.status) + '</td>' +
          '<td style="font-size:.7rem;max-width:120px">' + (item.moderation_note ? '<span style="color:#c62828">' + item.moderation_note + '</span>' : '<span style="color:var(--text3)">-</span>') + '</td>' +
          '<td style="font-size:.72rem;white-space:nowrap">' + (item.created_at || '') + '</td>' +
          '<td><div style="display:flex;gap:.3rem;flex-wrap:wrap">' +
          (item.status !== 'approved' ? '<button class="btn btn-success btn-xs admin-hl-approve" data-id="' + item.id + '">通过</button>' : '') +
          (item.status !== 'rejected' ? '<button class="btn btn-warning btn-xs admin-hl-reject" data-id="' + item.id + '">驳回</button>' : '') +
          '<button class="btn btn-danger btn-xs admin-hl-delete" data-id="' + item.id + '" data-file="' + (item.filename || '') + '">删除</button></div></td>' +
          '</tr>').join('') + '</tbody></table>';

      // 缩略图点击全屏灯箱
      wrap.querySelectorAll('.admin-hl-thumb').forEach(img => {
        img.addEventListener('click', () => App.openLightbox(img.dataset.lightbox));
      });

      wrap.querySelectorAll('.admin-hl-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
          const r = await API.admin.approveHighlight(btn.dataset.id);
          if (r.success) { App.showToast('已通过', 'success'); this._loadHighlightsAdmin(); }
          else App.showToast(r.error || '操作失败', 'error');
        });
      });
      wrap.querySelectorAll('.admin-hl-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
          const r = await API.admin.rejectHighlight(btn.dataset.id);
          if (r.success) { App.showToast('已驳回', 'success'); this._loadHighlightsAdmin(); }
          else App.showToast(r.error || '操作失败', 'error');
        });
      });
      wrap.querySelectorAll('.admin-hl-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!await App.confirmDialog('确认删除此照片？')) return;
          const r = await API.admin.deleteHighlight(btn.dataset.id);
          if (r.success) { App.showToast('已删除', 'success'); this._loadHighlightsAdmin(); }
          else App.showToast(r.error || '删除失败', 'error');
        });
      });
    } catch(e) {
      wrap.innerHTML = '<div class="empty-state"><p>加载失败：' + e.message + '</p></div>';
    }
  },

  _renderResultsFilter(container) {
    const bar = container.querySelector('#results-filter-bar');
    const f = this._resultsFilters;
    const labels = [];
    if (f.grade.length) labels.push('年级：' + f.grade.join('、'));
    if (f.class_name.length) labels.push('班级：' + f.class_name.join('、'));
    if (f.event_id && this._resultsFilterData) {
      const evt = this._resultsFilterData.events.find(e => e.id == f.event_id);
      if (evt) labels.push('项目：' + evt.name);
    }
    if (f.award) labels.push('奖项：' + f.award);
    if (f.is_published !== '') labels.push('公示：' + (f.is_published === '1' ? '已公示' : '未公示'));
    bar.innerHTML = `
      <button class="btn btn--primary btn--sm" id="btn-results-search"><i class="fas fa-search"></i> 筛选</button>
      ${labels.length > 0 ? '<span class="text-sm" style="color:var(--red);margin-left:8px">当前筛选：' + labels.join(' / ') + ' <a href="javascript:void(0)" id="btn-results-clear" style="color:var(--text3)">[清除]</a></span>' : ''}
    `;
    bar.querySelector('#btn-results-clear')?.addEventListener('click', () => {
      this._resultsFilters = { grade: [], class_name: [], grade_multi: true, class_multi: true, event_id: '', award: '', is_published: '' };
      this._resultsPage = 1;
      this._renderResultsFilter(container);
      this._loadResults(container);
    });
    bar.querySelector('#btn-results-search')?.addEventListener('click', () => this._showResultsFilterModal(container));
  },

  async _showResultsFilterModal(container) {
    if (!this._resultsFilterData) {
      try {
        const gradesRes = await API.public.getGrades();
        const eventsRes = await API.get('/admin/events');
        this._resultsFilterData = {
          dictionary: this._buildGradeClassDictionary(gradesRes.data || {}),
          events: eventsRes.data || []
        };
      } catch (e) { App.showToast('加载筛选数据失败','error'); return; }
    }
    const f = this._resultsFilters;
    const eventOpts = this._resultsFilterData.events.map(e =>
      `<option value="${e.id}" ${f.event_id==e.id?'selected':''}>${e.name}</option>`
    ).join('');
    const awardOpts = `<option value="" ${!f.award?'selected':''}>全部奖项</option>
      <option value="第一名" ${f.award==='第一名'?'selected':''}>第一名</option>
      <option value="第二名" ${f.award==='第二名'?'selected':''}>第二名</option>
      <option value="第三名" ${f.award==='第三名'?'selected':''}>第三名</option>
      <option value="优秀" ${f.award==='优秀'?'selected':''}>优秀奖</option>`;
    const publishOpts = `<option value="" ${f.is_published===''?'selected':''}>全部</option>
      <option value="1" ${f.is_published==='1'?'selected':''}>已公示</option>
      <option value="0" ${f.is_published==='0'?'selected':''}>未公示</option>`;

    const html = `
      <div class="modal-header"><h3>成绩筛选</h3><button class="modal-close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>年级</label>
          <label class="text-sm" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--text2);"><input type="checkbox" id="results-filter-grade-multi" ${f.grade_multi ? 'checked' : ''}> 下拉多选</label>
          <select id="results-filter-grade" class="form__select"></select>
        </div>
        <div class="form-group">
          <label>班级</label>
          <label class="text-sm" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--text2);"><input type="checkbox" id="results-filter-class-multi" ${f.class_multi ? 'checked' : ''}> 下拉多选</label>
          <select id="results-filter-class" class="form__select"></select>
          <div class="form__hint" id="results-filter-link-hint"></div>
        </div>
        <div class="form-group"><label>项目</label><select id="results-filter-event" class="form__select"><option value="">全部项目</option>${eventOpts}</select></div>
        <div class="form-group"><label>奖项</label><select id="results-filter-award" class="form__select">${awardOpts}</select></div>
        <div class="form-group"><label>公示状态</label><select id="results-filter-published" class="form__select">${publishOpts}</select></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn--outline btn--sm" id="btn-results-filter-cancel">取消</button>
        <button class="btn btn--primary btn--sm" id="btn-results-filter-apply">确定筛选</button>
      </div>`;
    App.showModal(html);
    const pickerState = {
      grade: this._normalizeFilterValues(f.grade),
      class_name: this._normalizeFilterValues(f.class_name)
    };
    this._bindGradeClassPicker('results-filter', this._resultsFilterData.dictionary, pickerState);

    document.getElementById('btn-results-filter-cancel').onclick = () => App.hideModal();
    document.getElementById('btn-results-filter-apply').onclick = () => {
      const grade = this._getSelectValues(document.getElementById('results-filter-grade'));
      const className = this._getSelectValues(document.getElementById('results-filter-class'));
      const eventId = document.getElementById('results-filter-event')?.value || '';
      const award = document.getElementById('results-filter-award')?.value || '';
      const published = document.getElementById('results-filter-published')?.value;
      this._resultsFilters.grade = grade;
      this._resultsFilters.class_name = className;
      this._resultsFilters.grade_multi = !!document.getElementById('results-filter-grade-multi')?.checked;
      this._resultsFilters.class_multi = !!document.getElementById('results-filter-class-multi')?.checked;
      this._resultsFilters.event_id = eventId;
      this._resultsFilters.award = award;
      this._resultsFilters.is_published = published;
      this._resultsPage = 1;
      App.hideModal();
      this._renderResultsFilter(container);
      this._loadResults(container);
    };
  },

  _bindResultsEvents(container) {
    container.querySelector('#btn-add-result').addEventListener('click', () => this._showResultModal(null, container));
    container.querySelector('#btn-import-results').addEventListener('click', () => this._showResultsImport(container));
    container.querySelector('#btn-auto-rank').addEventListener('click', () => this._autoRank());
    container.querySelector('#btn-publish-results').addEventListener('click', () => this._publishResults(container));
    container.querySelector('#btn-unpublish-results').addEventListener('click', () => this._unpublishResults(container));
    container.querySelector('#btn-export-results').addEventListener('click', () => this._exportResults());
  },

  async _loadResults(container) {
    try {
      App.showLoading();
      const f = this._resultsFilters;
      const params = { page: this._resultsPage, limit: this._resultsLimit };
      if (f.grade.length) params.grade = f.grade.join(',');
      if (f.class_name.length) params.class_name = f.class_name.join(',');
      if (f.event_id) params.event_id = f.event_id;
      if (f.award) params.award = f.award;
      if (f.is_published !== '') params.is_published = f.is_published;

      const res = await API.get('/admin/results' + API._qs(params));
      const d = res.data || res;
      const list = d.list || [];
      const total = d.total || 0;
      App.hideLoading();

      let html = '';
      if (list.length > 0) {
        html = '<table class="table table--striped"><thead><tr><th><input type="checkbox" id="results-select-all"></th><th>学号</th><th>姓名</th><th>班级</th><th>项目</th><th>轮次</th><th>成绩</th><th>排名</th><th>奖项</th><th>校纪录</th><th>公示</th><th>操作</th></tr></thead><tbody>';
        list.forEach(r => {
          html += '<tr><td><input type="checkbox" class="result-checkbox" data-id="' + r.id + '"></td>';
          html += '<td>' + (r.student_id || '-') + '</td>';
          html += '<td>' + (r.user_name || '-') + '</td>';
          html += '<td>' + (r.class_name || '-') + '</td>';
          html += '<td>' + (r.event_name || '-') + '</td>';
          html += '<td>' + (r.round_name || '-') + '</td>';
          html += '<td>' + (r.performance || '-') + '</td>';
          html += '<td>' + (r.rank || '-') + '</td>';
          html += '<td>' + (r.award || '-') + '</td>';
          html += '<td>' + (r.is_school_record ? '<span class="badge badge--warning">已刷新</span>' : '-') + '</td>';
          html += '<td>' + (r.is_published ? '<span class="badge badge--success">已公示</span>' : '<span class="badge badge--inactive">未公示</span>') + '</td>';
          html += '<td><div class="table__actions">';
          html += '<button class="btn btn--ghost btn--xs btn-edit-result" data-id="' + r.id + '"><i class="fas fa-edit"></i></button>';
          html += '<button class="btn btn--ghost btn--xs btn-delete-result" data-id="' + r.id + '" style="color:#ef4444;"><i class="fas fa-trash"></i></button>';
          html += '</div></td></tr>';
        });
        html += '</tbody></table>';
      } else {
        html = this._emptyState('fas fa-medal', '暂无成绩');
      }

      container.querySelector('#results-table-container').innerHTML = html;
      const pagInfo = this._paginate({ page: this._resultsPage, total, limit: this._resultsLimit, callback: (p) => { this._resultsPage = p; this._loadResults(container); } });
      container.querySelector('#results-pagination').innerHTML = this._renderPagination(pagInfo, 'results-pagination');

      const selectAll = container.querySelector('#results-select-all');
      if (selectAll) {
        selectAll.addEventListener('change', () => {
          container.querySelectorAll('.result-checkbox').forEach(cb => { cb.checked = selectAll.checked; });
        });
      }

      container.querySelectorAll('.btn-edit-result').forEach(btn => {
        btn.addEventListener('click', () => {
          const result = list.find(r => r.id == btn.dataset.id);
          if (result) this._showResultModal(result, container);
        });
      });
      container.querySelectorAll('.btn-delete-result').forEach(btn => {
        btn.addEventListener('click', () => this._confirmDeleteResult(btn.dataset.id, container));
      });
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  _escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  _getResultDrafts() {
    try {
      const drafts = JSON.parse(localStorage.getItem(this._resultDraftStorageKey) || '[]');
      return Array.isArray(drafts) ? drafts : [];
    } catch (_) {
      return [];
    }
  },

  _setResultDrafts(drafts) {
    localStorage.setItem(this._resultDraftStorageKey, JSON.stringify((drafts || []).slice(0, 50)));
  },

  _collectResultFormData() {
    return {
      schedule_id: document.getElementById('result-schedule') ? document.getElementById('result-schedule').value : '',
      grade: document.getElementById('result-grade') ? document.getElementById('result-grade').value : '',
      class_name: document.getElementById('result-class') ? document.getElementById('result-class').value : '',
      user_id: document.getElementById('result-user-id') ? document.getElementById('result-user-id').value : '',
      student_name: document.getElementById('result-student-name') ? document.getElementById('result-student-name').value : '',
      performance: document.getElementById('result-performance') ? document.getElementById('result-performance').value : '',
      award: document.getElementById('result-award') ? document.getElementById('result-award').value : '',
      note: document.getElementById('result-note') ? document.getElementById('result-note').value : '',
      is_school_record: !!(document.getElementById('result-school-record') && document.getElementById('result-school-record').checked)
    };
  },

  _applyResultFormData(data) {
    if (document.getElementById('result-schedule')) document.getElementById('result-schedule').value = data.schedule_id || document.getElementById('result-schedule').value;
    if (document.getElementById('result-grade')) document.getElementById('result-grade').value = data.grade || '';
    if (document.getElementById('result-class')) document.getElementById('result-class').value = data.class_name || '';
    if (document.getElementById('result-user-id')) document.getElementById('result-user-id').value = data.user_id || '';
    if (document.getElementById('result-student-name')) document.getElementById('result-student-name').value = data.student_name || '';
    if (document.getElementById('result-performance')) document.getElementById('result-performance').value = data.performance || '';
    if (document.getElementById('result-award')) document.getElementById('result-award').value = data.award || '';
    if (document.getElementById('result-note')) document.getElementById('result-note').value = data.note || '';
    if (document.getElementById('result-school-record')) document.getElementById('result-school-record').checked = !!data.is_school_record;
    this._updateSelectedStudentInfo(data);
    this._updateResultNoteCounter();
  },

  _serializeResultForm(data) {
    return JSON.stringify({
      schedule_id: String(data.schedule_id || ''),
      grade: String(data.grade || ''),
      class_name: String(data.class_name || ''),
      user_id: String(data.user_id || ''),
      student_name: String(data.student_name || ''),
      performance: String(data.performance || ''),
      award: String(data.award || ''),
      note: String(data.note || ''),
      is_school_record: !!data.is_school_record
    });
  },

  _updateResultNoteCounter() {
    const noteInput = document.getElementById('result-note');
    const counter = document.getElementById('result-note-counter');
    if (noteInput && counter) counter.textContent = noteInput.value.length + '/500';
  },

  _setResultFieldError(field, message) {
    const input = document.getElementById('result-' + field);
    const error = document.getElementById('result-' + field + '-error');
    if (!error) return;
    error.textContent = message || '';
    error.style.display = message ? 'block' : 'none';
    if (input) input.style.borderColor = message ? '#dc2626' : '';
  },

  _sanitizeResultDraftData(raw) {
    return {
      schedule_id: String(raw.schedule_id || '').replace(/[^\d]/g, '').slice(0, 10),
      grade: String(raw.grade || '').replace(/[<>{}\[\]$^|~`]/g, '').slice(0, 50),
      class_name: String(raw.class_name || '').replace(/[<>{}\[\]$^|~`]/g, '').slice(0, 50),
      user_id: String(raw.user_id || '').replace(/[^\d]/g, '').slice(0, 10),
      student_name: String(raw.student_name || '').replace(/[<>{}\[\]$^|~`]/g, '').slice(0, 50),
      student_id: String(raw.student_id || '').replace(/[<>{}\[\]$^|~`]/g, '').slice(0, 30),
      performance: String(raw.performance || '').toUpperCase().replace(/[^0-9A-Z:.]/g, '').slice(0, 20),
      award: String(raw.award || ''),
      note: String(raw.note || '').replace(/[<>{}\[\]$^|~`]/g, '').slice(0, 500),
      is_school_record: !!raw.is_school_record
    };
  },

  _validateResultForm(raw, options = {}) {
    const strict = options.strict !== false;
    const data = this._sanitizeResultDraftData(raw);
    const errors = {};
    const performancePattern = /^(?:\d{1,2}:\d{1,2}(?:\.\d{1,3})?|\d{1,5}(?:\.\d{1,3})?|DNS|DNF|DQ|NM)$/i;

    if (strict && !data.schedule_id) errors.schedule = '请选择赛程';
    if (strict && !data.grade) errors.grade = '请选择年级';
    if (strict && !data.class_name) errors.class = '请选择班级';
    if (strict && !data.student_name) errors['student-name'] = '请输入并选择学生姓名';
    if (strict && !data.user_id) errors['student-name'] = '请选择有效的学生账号';
    if (data.user_id && (!/^\d+$/.test(data.user_id) || Number(data.user_id) <= 0)) errors['student-name'] = '学生账号映射无效，请重新选择';
    if (raw.student_name && raw.student_name !== data.student_name) errors['student-name'] = '学生姓名包含非法字符';

    if (data.performance) {
      if (!performancePattern.test(data.performance)) {
        errors.performance = '请输入数字、时间格式或 DNS/DNF/DQ/NM';
      } else if (data.performance.includes(':')) {
        const parts = data.performance.split(':');
        const minutes = parseInt(parts[0], 10);
        const seconds = parseFloat(parts[1]);
        if (minutes > 99 || seconds >= 60) errors.performance = '时间格式超出合理范围';
      } else if (!['DNS', 'DNF', 'DQ', 'NM'].includes(data.performance)) {
        const score = parseFloat(data.performance);
        if (isNaN(score) || score < 0 || score > 99999.999) errors.performance = '成绩数值超出合理范围';
      }
    } else if (strict) {
      errors.performance = '请输入成绩';
    }

    if ((raw.note || '').length > 500) errors.note = '备注最多500字';
    if (raw.note && raw.note !== data.note) errors.note = '备注已自动过滤非法字符';

    return { data, errors, valid: Object.keys(errors).length === 0 };
  },

  _updateSelectedStudentInfo(data) {
    const info = document.getElementById('result-selected-student');
    if (!info) return;
    if (data && data.user_id) {
      const extra = [];
      if (data.student_id) extra.push('学号: ' + data.student_id);
      if (data.class_name) extra.push(data.class_name);
      if (data.grade) extra.push(data.grade);
      info.textContent = extra.length ? '已绑定学生账号：' + extra.join(' / ') : '已绑定学生账号';
      info.style.display = 'block';
    } else {
      info.textContent = '';
      info.style.display = 'none';
    }
  },

  _sortStudentsByName(students) {
    return (students || []).slice().sort((a, b) => {
      const nameCompare = String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN-u-co-pinyin');
      if (nameCompare !== 0) return nameCompare;
      return String(a.student_id || '').localeCompare(String(b.student_id || ''));
    });
  },

  async _getStudentDirectory(forceRefresh) {
    if (!forceRefresh && this._studentDirectoryCache) return this._studentDirectoryCache;
    const res = await API.get('/admin/student-directory');
    const data = res.data || {};
    const classes = (data.classes || []).slice().sort((a, b) => {
      if ((a.grade_sort_order || 0) !== (b.grade_sort_order || 0)) return (a.grade_sort_order || 0) - (b.grade_sort_order || 0);
      if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0);
      const gradeCompare = String(a.grade_name || '').localeCompare(String(b.grade_name || ''), 'zh-Hans-CN-u-co-pinyin');
      if (gradeCompare !== 0) return gradeCompare;
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN-u-co-pinyin');
    });
    const students = this._sortStudentsByName(data.students || []);
    this._studentDirectoryCache = { grades: data.grades || [], classes, students };
    return this._studentDirectoryCache;
  },

  _closeStudentPicker() {
    const layer = document.getElementById('result-student-picker-layer');
    if (layer) layer.remove();
  },

  _renderStudentPickerShell(title, bodyHtml, options = {}) {
    this._closeStudentPicker();
    const layer = document.createElement('div');
    layer.id = 'result-student-picker-layer';
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.background = 'rgba(0,0,0,0.35)';
    layer.style.zIndex = '1600';
    layer.style.display = 'flex';
    layer.style.alignItems = 'center';
    layer.style.justifyContent = 'center';
    layer.style.padding = '16px';
    layer.innerHTML =
      '<div id="result-student-picker-dialog" style="width:min(680px, calc(100vw - 32px));max-height:min(80vh, 720px);overflow:hidden;background:#fff;border-radius:14px;border:1px solid #e5e7eb;box-shadow:0 20px 40px rgba(0,0,0,0.18);display:flex;flex-direction:column;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #e5e7eb;background:#faf7ef;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
      (options.showBack ? '<button type="button" id="btn-student-picker-back" class="btn btn--outline btn--sm"><i class="fas fa-arrow-left"></i> 返回</button>' : '') +
      '<strong style="color:#7f1d1d;">' + this._escapeHtml(title) + '</strong>' +
      '</div>' +
      '<button type="button" id="btn-student-picker-close" class="btn btn--ghost btn--sm"><i class="fas fa-times"></i></button>' +
      '</div>' +
      '<div id="result-student-picker-body" style="padding:16px;overflow:auto;">' + bodyHtml + '</div>' +
      '</div>';
    document.body.appendChild(layer);
    layer.addEventListener('click', (e) => {
      if (e.target === layer) this._closeStudentPicker();
    });
    document.getElementById('btn-student-picker-close').addEventListener('click', () => this._closeStudentPicker());
    if (options.showBack && typeof options.onBack === 'function') {
      document.getElementById('btn-student-picker-back').addEventListener('click', options.onBack);
    }
  },

  async _openStudentClassPicker() {
    this._renderStudentPickerShell('选择班级', '<div style="padding:24px;text-align:center;color:#6b7280;"><div class="spinner" style="margin:0 auto 12px;"></div><div>正在加载班级列表...</div></div>');
    try {
      const directory = await this._getStudentDirectory(false);
      const selectedGrade = document.getElementById('result-grade')?.value || '';
      const classes = (directory.classes || []).filter((item) => !selectedGrade || item.grade_name === selectedGrade);
      if (classes.length === 0) {
        this._renderStudentPickerShell('选择班级', this._emptyState('fas fa-users', '暂无班级', selectedGrade ? '当前年级下暂无班级，请重新选择年级' : '请先在年级班级管理中添加班级'));
        return;
      }
      let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;">';
      classes.forEach((cls) => {
        html += '<button type="button" class="student-class-option" data-class-name="' + this._escapeHtml(cls.name) + '" data-grade-name="' + this._escapeHtml(cls.grade_name || '') + '" style="text-align:left;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;cursor:pointer;transition:.15s;">';
        html += '<div style="font-weight:700;color:#111827;margin-bottom:6px;">' + this._escapeHtml((cls.grade_name ? cls.grade_name + ' ' : '') + cls.name) + '</div>';
        html += '<div style="font-size:0.8125rem;color:#6b7280;">学生数：' + (cls.student_count || 0) + '</div>';
        html += '</button>';
      });
      html += '</div>';
      this._renderStudentPickerShell('选择班级', html);
      document.querySelectorAll('.student-class-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (document.getElementById('result-grade')) document.getElementById('result-grade').value = btn.dataset.gradeName || '';
          if (document.getElementById('result-class')) document.getElementById('result-class').value = btn.dataset.className || '';
          this._openStudentListPicker({
            class_name: btn.dataset.className,
            grade_name: btn.dataset.gradeName
          });
        });
      });
    } catch (e) {
      this._renderStudentPickerShell('选择班级', '<div style="padding:24px;text-align:center;color:#dc2626;">加载班级失败：' + this._escapeHtml(e.message || '未知错误') + '</div>');
    }
  },

  _filterStudentsForPicker(students, keyword) {
    const search = String(keyword || '').trim().toLowerCase();
    if (!search) return this._sortStudentsByName(students);
    return this._sortStudentsByName((students || []).filter((student) => {
      const name = String(student.name || '').toLowerCase();
      const studentId = String(student.student_id || '').toLowerCase();
      const username = String(student.username || '').toLowerCase();
      return name.includes(search) || studentId.includes(search) || username.includes(search);
    }));
  },

  async _openStudentListPicker(selectedClass) {
    const classTitle = (selectedClass.grade_name ? selectedClass.grade_name + ' ' : '') + selectedClass.class_name;
    this._renderStudentPickerShell('选择学生', '<div style="padding:24px;text-align:center;color:#6b7280;"><div class="spinner" style="margin:0 auto 12px;"></div><div>正在加载学生列表...</div></div>', {
      showBack: true,
      onBack: () => this._openStudentClassPicker()
    });
    const directory = await this._getStudentDirectory(false);
    const students = (directory.students || []).filter((student) => student.class_name === selectedClass.class_name && student.grade === selectedClass.grade_name);
    let debounceTimer = null;

    const renderList = (keyword) => {
      const filtered = this._filterStudentsForPicker(students, keyword);
      let listHtml = '<div style="margin-bottom:12px;font-size:0.875rem;color:#6b7280;">当前班级：' + this._escapeHtml(classTitle) + '，共 ' + students.length + ' 名学生</div>';
      listHtml += '<div style="margin-bottom:12px;"><input id="student-picker-search-input" class="form__input" placeholder="搜索学生姓名、学号或账号" value="' + this._escapeHtml(keyword || '') + '"></div>';
      if (filtered.length === 0) {
        listHtml += this._emptyState('fas fa-search', '未找到匹配学生', '请尝试其他关键词');
      } else {
        listHtml += '<div style="display:flex;flex-direction:column;gap:8px;">';
        filtered.forEach((student) => {
          listHtml += '<button type="button" class="student-name-option" data-id="' + student.id + '" data-name="' + this._escapeHtml(student.name || '') + '" data-student-id="' + this._escapeHtml(student.student_id || '') + '" data-class-name="' + this._escapeHtml(student.class_name || '') + '" data-grade="' + this._escapeHtml(student.grade || '') + '" style="text-align:left;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;">';
          listHtml += '<div style="font-weight:700;color:#111827;">' + this._escapeHtml(student.name || '-') + '</div>';
          listHtml += '<div style="font-size:0.8125rem;color:#6b7280;">' + this._escapeHtml(student.student_id || '-') + ' / ' + this._escapeHtml(student.class_name || '-') + ' / ' + this._escapeHtml(student.grade || '-') + '</div>';
          listHtml += '</button>';
        });
        listHtml += '</div>';
      }
      this._renderStudentPickerShell('选择学生', listHtml, {
        showBack: true,
        onBack: () => this._openStudentClassPicker()
      });

      const searchInput = document.getElementById('student-picker-search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        searchInput.addEventListener('input', () => {
          clearTimeout(debounceTimer);
          const nextKeyword = searchInput.value;
          debounceTimer = setTimeout(() => renderList(nextKeyword), 100);
        });
      }

      document.querySelectorAll('.student-name-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const data = {
            user_id: btn.dataset.id,
            student_name: btn.dataset.name,
            student_id: btn.dataset.studentId,
            class_name: btn.dataset.className,
            grade: btn.dataset.grade
          };
          if (document.getElementById('result-user-id')) document.getElementById('result-user-id').value = data.user_id;
          if (document.getElementById('result-student-name')) document.getElementById('result-student-name').value = data.student_name;
          this._updateSelectedStudentInfo(data);
          this._closeStudentPicker();
          this._runResultValidation(false);
        });
      });
    };

    renderList('');
  },

  _bindResultStudentSearch() {
    const input = document.getElementById('result-student-name');
    const hiddenId = document.getElementById('result-user-id');
    const gradeInput = document.getElementById('result-grade');
    const classInput = document.getElementById('result-class');
    if (!input || !hiddenId) return;
    input.readOnly = true;
    input.addEventListener('click', () => {
      if (!gradeInput?.value) {
        this._setResultFieldError('grade', '请选择年级');
        App.showToast('请先选择年级', 'warning');
        return;
      }
      if (!classInput?.value) {
        this._setResultFieldError('class', '请选择班级');
        App.showToast('请先选择班级', 'warning');
        return;
      }
      this._openStudentListPicker({
        class_name: classInput.value,
        grade_name: gradeInput.value
      });
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
  },

  _renderResultDrafts(state) {
    const wrap = document.getElementById('result-draft-list');
    if (!wrap) return;
    const drafts = this._getResultDrafts();
    if (drafts.length === 0) {
      wrap.innerHTML = '<div class="empty-state" style="padding:16px 0;"><div class="empty-state__title">暂无待提交成绩</div><div class="empty-state__desc">可使用“暂存草稿”保存未完成录入内容</div></div>';
      return;
    }

    let html = '<table class="table table--striped"><thead><tr><th><input type="checkbox" id="result-draft-select-all"></th><th>赛程</th><th>学生姓名</th><th>成绩</th><th>奖项</th><th>校纪录</th><th>保存时间</th><th>操作</th></tr></thead><tbody>';
    drafts.forEach((draft) => {
      html += '<tr>';
      html += '<td><input type="checkbox" class="result-draft-checkbox" data-id="' + draft.id + '"></td>';
      html += '<td>' + this._escapeHtml(draft.schedule_label || draft.schedule_id || '-') + '</td>';
      html += '<td>' + this._escapeHtml(draft.student_name || '-') + '</td>';
      html += '<td>' + this._escapeHtml(draft.performance || '-') + '</td>';
      html += '<td>' + this._escapeHtml(draft.award || '-') + '</td>';
      html += '<td>' + (draft.is_school_record ? '是' : '否') + '</td>';
      html += '<td>' + this._escapeHtml(draft.saved_at || '-') + '</td>';
      html += '<td><button class="btn btn--ghost btn--xs btn-load-result-draft" data-id="' + draft.id + '"><i class="fas fa-folder-open"></i> 载入</button></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;

    const selectAll = document.getElementById('result-draft-select-all');
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        document.querySelectorAll('.result-draft-checkbox').forEach((cb) => { cb.checked = selectAll.checked; });
      });
    }

    document.querySelectorAll('.btn-load-result-draft').forEach((btn) => {
      btn.addEventListener('click', () => {
        const draft = this._getResultDrafts().find((item) => item.id === btn.dataset.id);
        if (!draft) return;
        const dirty = this._serializeResultForm(this._collectResultFormData()) !== state.initialSnapshot;
        if (dirty && !window.confirm('当前输入尚未保存，确认覆盖为选中草稿吗？')) return;
        this._applyResultFormData(draft);
        state.activeDraftId = draft.id;
        state.initialSnapshot = this._serializeResultForm(this._collectResultFormData());
        this._runResultValidation(false);
      });
    });
  },

  _runResultValidation(strict) {
    const validation = this._validateResultForm(this._collectResultFormData(), { strict });
    this._setResultFieldError('schedule', validation.errors.schedule || '');
    this._setResultFieldError('grade', validation.errors.grade || '');
    this._setResultFieldError('class', validation.errors.class || '');
    this._setResultFieldError('student-name', validation.errors['student-name'] || '');
    this._setResultFieldError('performance', validation.errors.performance || '');
    this._setResultFieldError('note', validation.errors.note || '');
    this._updateResultNoteCounter();
    return validation;
  },

  async _showResultModal(result, container) {
    const isEdit = !!result;
    const schedules = [];
    let schedOpts = '';
    try {
      const schedRes = await API.get('/admin/schedules');
      (schedRes.data || []).forEach((item) => schedules.push(item));
      schedules.forEach(s => {
        const sel = isEdit && result.schedule_id === s.id ? ' selected' : '';
        schedOpts += '<option value="' + s.id + '"' + sel + '>' + s.event_name + ' - ' + s.round_name + ' (' + (s.start_time || '') + ')</option>';
      });
    } catch (e) {}

    const initialData = this._sanitizeResultDraftData({
      schedule_id: isEdit ? (result.schedule_id || '') : (schedules[0] ? schedules[0].id : ''),
      user_id: isEdit ? (result.user_id || '') : '',
      student_name: isEdit ? (result.user_name || '') : '',
      performance: isEdit ? (result.performance || '') : '',
      award: isEdit ? (result.award || '') : '',
      note: isEdit ? (result.note || '') : '',
      is_school_record: isEdit ? !!result.is_school_record : false,
      student_id: isEdit ? (result.student_id || '') : '',
      class_name: isEdit ? (result.class_name || '') : '',
      grade: isEdit ? (result.grade || '') : ''
    });
    const title = isEdit ? '编辑成绩' : '录入成绩';
    let html = '<div class="modal__header"><h3 class="modal__title">' + title + '</h3><button class="modal__close" id="btn-close-result-modal"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body"><div class="form">';
    html += '<div class="form__group"><label class="form__label form__label--required">赛程</label><select class="form__select" id="result-schedule">' + schedOpts + '</select><div class="form__hint" id="result-schedule-error" style="display:none;color:#dc2626;"></div></div>';
      html += '<div class="form__group"><label class="form__label form__label--required">年级</label><select class="form__select" id="result-grade"></select><div class="form__hint">年级数据同步自学校教务字典</div><div class="form__hint" id="result-grade-error" style="display:none;color:#dc2626;"></div></div>';
      html += '<div class="form__group"><label class="form__label form__label--required">班级</label><select class="form__select" id="result-class"></select><div class="form__hint">选择年级后自动筛出对应班级</div><div class="form__hint" id="result-class-error" style="display:none;color:#dc2626;"></div></div>';
    html += '<input type="hidden" id="result-user-id" value="' + this._escapeHtml(initialData.user_id) + '">';
    html += '<div class="form__group"><label class="form__label form__label--required">学生姓名</label><input class="form__input" id="result-student-name" placeholder="请先选择年级和班级，再点击选择学生" autocomplete="off" readonly value="' + this._escapeHtml(initialData.student_name) + '"><div class="form__hint" id="result-selected-student" style="display:none;"></div><div class="form__hint">点击学生姓名字段后，只会展示当前年级和班级下的学生</div><div class="form__hint" id="result-student-name-error" style="display:none;color:#dc2626;"></div></div>';
    html += '<div class="form__group"><label class="form__label form__label--required">成绩</label><input class="form__input" id="result-performance" placeholder="如: 12.34、1:23.45、DNS" value="' + this._escapeHtml(initialData.performance) + '"><div class="form__hint">支持纯数字、时间格式，或 DNS / DNF / DQ / NM</div><div class="form__hint" id="result-performance-error" style="display:none;color:#dc2626;"></div></div>';
    html += '<div class="form__group"><label class="form__label">奖项</label><select class="form__select" id="result-award"><option value="">无</option><option value="第一名"' + (initialData.award === '第一名' ? ' selected' : '') + '>第一名</option><option value="第二名"' + (initialData.award === '第二名' ? ' selected' : '') + '>第二名</option><option value="第三名"' + (initialData.award === '第三名' ? ' selected' : '') + '>第三名</option><option value="优秀"' + (initialData.award === '优秀' ? ' selected' : '') + '>优秀</option><option value="团体"' + (initialData.award === '团体' ? ' selected' : '') + '>团体</option></select></div>';
    html += '<div class="form__group"><label class="form__label form__label--required">输入备注</label><textarea class="form__textarea" id="result-note" rows="4" placeholder="请输入补充说明，最多500字">' + this._escapeHtml(initialData.note) + '</textarea><div style="display:flex;justify-content:space-between;gap:12px;"><div class="form__hint">支持中文、英文、数字及常用标点</div><div class="form__hint" id="result-note-counter">0/500</div></div><div class="form__hint" id="result-note-error" style="display:none;color:#dc2626;"></div></div>';
    html += '<div class="form__group"><label class="form__label form__label--required">是否打破学校记录</label><label style="display:flex;align-items:center;gap:8px;font-weight:500;color:#374151;"><input type="checkbox" id="result-school-record"' + (initialData.is_school_record ? ' checked' : '') + '> 是，已刷新校史记录</label></div>';
    if (!isEdit) {
      html += '<div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:16px;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;"><strong style="color:#1f2937;">待提交成绩草稿</strong><div style="display:flex;gap:8px;"><button class="btn btn--outline btn--sm" type="button" id="btn-delete-result-drafts"><i class="fas fa-trash"></i> 批量删除待提交成绩</button></div></div>';
      html += '<div id="result-draft-list"></div>';
      html += '</div>';
    }
    html += '</div></div>';
    html += '<div class="modal__footer"><button class="btn btn--outline" type="button" id="btn-cancel-result">取消</button><button class="btn btn--outline" type="button" id="btn-reset-result">重置输入</button>' + (!isEdit ? '<button class="btn btn--warning" type="button" id="btn-save-result-draft"><i class="fas fa-save"></i> 暂存草稿</button>' : '') + '<button class="btn btn--primary" id="btn-save-result" data-id="' + (isEdit ? result.id : '') + '">提交</button></div>';
    App.showModal(html);

    this._applyResultFormData(initialData);
    const state = {
      initialSnapshot: this._serializeResultForm(this._collectResultFormData()),
      activeDraftId: null
    };

    App._modalBeforeClose = () => {
      if (document.getElementById('result-student-picker-layer')) {
        this._closeStudentPicker();
        return false;
      }
      const dirty = this._serializeResultForm(this._collectResultFormData()) !== state.initialSnapshot;
      if (!dirty) return true;
      return window.confirm('当前存在未保存的输入内容，确认关闭录入界面吗？');
    };

    const scheduleInput = document.getElementById('result-schedule');
    const gradeInput = document.getElementById('result-grade');
    const classInput = document.getElementById('result-class');
    const performanceInput = document.getElementById('result-performance');
    const noteInput = document.getElementById('result-note');
    const studentDirectory = await this._getStudentDirectory(false);
    const dictionary = this._buildGradeClassDictionary(studentDirectory);

    const syncResultClassOptions = (preserveSelection) => {
      const selectedGrade = gradeInput.value || '';
      const classes = this._getLinkedClasses(dictionary, selectedGrade ? [selectedGrade] : []);
      const previousClass = preserveSelection ? (classInput.value || initialData.class_name || '') : '';
      classInput.innerHTML = '<option value="">请选择班级</option>';
      classes.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.name;
        option.textContent = item.name;
        classInput.appendChild(option);
      });
      classInput.value = classes.some((item) => item.name === previousClass) ? previousClass : '';
    };
    gradeInput.innerHTML = '<option value="">请选择年级</option>' + dictionary.grades.map((item) => '<option value="' + this._escapeHtml(item.name) + '">' + this._escapeHtml(item.name) + '</option>').join('');
    gradeInput.value = initialData.grade || '';
    syncResultClassOptions(true);
    if (initialData.class_name) classInput.value = initialData.class_name;

    const handleLiveInput = () => this._runResultValidation(false);
    scheduleInput.addEventListener('change', handleLiveInput);
    gradeInput.addEventListener('change', () => {
      syncResultClassOptions(false);
      document.getElementById('result-user-id').value = '';
      document.getElementById('result-student-name').value = '';
      this._updateSelectedStudentInfo({});
      handleLiveInput();
    });
    classInput.addEventListener('change', () => {
      document.getElementById('result-user-id').value = '';
      document.getElementById('result-student-name').value = '';
      this._updateSelectedStudentInfo({});
      handleLiveInput();
    });
    this._bindResultStudentSearch();
    performanceInput.addEventListener('input', () => {
      const sanitized = performanceInput.value.toUpperCase().replace(/[^0-9A-Z:.]/g, '').slice(0, 20);
      if (sanitized !== performanceInput.value) performanceInput.value = sanitized;
      handleLiveInput();
    });
    noteInput.addEventListener('input', () => {
      const sanitized = noteInput.value.replace(/[<>{}\[\]$^|~`]/g, '').slice(0, 500);
      if (sanitized !== noteInput.value) noteInput.value = sanitized;
      handleLiveInput();
    });
    document.getElementById('result-award').addEventListener('change', handleLiveInput);
    document.getElementById('result-school-record').addEventListener('change', handleLiveInput);
    this._runResultValidation(false);

    document.getElementById('btn-close-result-modal').addEventListener('click', () => App.hideModal());
    document.getElementById('btn-cancel-result').addEventListener('click', () => App.hideModal());
    document.getElementById('btn-reset-result').addEventListener('click', () => {
      const dirty = this._serializeResultForm(this._collectResultFormData()) !== state.initialSnapshot;
      if (dirty && !window.confirm('确认重置当前输入内容吗？未保存的数据将会丢失。')) return;
      this._applyResultFormData(initialData);
      state.activeDraftId = null;
      state.initialSnapshot = this._serializeResultForm(this._collectResultFormData());
      this._runResultValidation(false);
    });

    if (!isEdit) {
      this._renderResultDrafts(state);
      document.getElementById('btn-save-result-draft').addEventListener('click', () => {
        const current = this._validateResultForm(this._collectResultFormData(), { strict: false });
        const data = current.data;
        const hasContent = data.student_name || data.performance || data.award || data.note || data.is_school_record;
        if (!hasContent) {
          App.showToast('请先填写至少一项内容再保存草稿', 'warning');
          return;
        }
        const scheduleText = scheduleInput.options[scheduleInput.selectedIndex] ? scheduleInput.options[scheduleInput.selectedIndex].textContent : '';
        const drafts = this._getResultDrafts();
        const draftId = state.activeDraftId || ('draft-' + Date.now());
        const nextDraft = {
          id: draftId,
          ...data,
          schedule_label: scheduleText,
          saved_at: new Date().toLocaleString()
        };
        const nextDrafts = drafts.filter((item) => item.id !== draftId);
        nextDrafts.unshift(nextDraft);
        this._setResultDrafts(nextDrafts);
        state.activeDraftId = draftId;
        state.initialSnapshot = this._serializeResultForm(this._collectResultFormData());
        this._renderResultDrafts(state);
        App.showToast('草稿已保存', 'success');
      });

      document.getElementById('btn-delete-result-drafts').addEventListener('click', () => {
        const selectedIds = [];
        document.querySelectorAll('.result-draft-checkbox:checked').forEach((cb) => selectedIds.push(cb.dataset.id));
        if (selectedIds.length === 0) {
          App.showToast('请先勾选要删除的待提交成绩', 'warning');
          return;
        }
        if (!window.confirm('确认批量删除选中的待提交成绩草稿吗？')) return;
        const nextDrafts = this._getResultDrafts().filter((item) => !selectedIds.includes(item.id));
        this._setResultDrafts(nextDrafts);
        if (state.activeDraftId && selectedIds.includes(state.activeDraftId)) state.activeDraftId = null;
        this._renderResultDrafts(state);
        App.showToast('已删除 ' + selectedIds.length + ' 条待提交成绩', 'success');
      });
    }

    document.getElementById('btn-save-result').addEventListener('click', async () => {
      const id = document.getElementById('btn-save-result').dataset.id;
      const validation = this._runResultValidation(true);
      if (!validation.valid) {
        const firstError = validation.errors.schedule || validation.errors['student-name'] || validation.errors.performance || validation.errors.note;
        App.showToast(firstError || '请先修正表单错误', 'warning');
        return;
      }
      try {
        App.showLoading();
        if (isEdit) {
          await API.admin.updateResult(id, validation.data);
          App.showToast('成绩已更新', 'success');
        } else {
          await API.admin.submitResult(validation.data);
          App.showToast('成绩已录入', 'success');
          if (state.activeDraftId) {
            this._setResultDrafts(this._getResultDrafts().filter((item) => item.id !== state.activeDraftId));
          }
        }
        this._closeStudentPicker();
        App._modalBeforeClose = null;
        App.hideModal();
        App.hideLoading();
        this._loadResults(container);
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      }
    });
  },

  _showResultsImport(container) {
    let html = '<div class="modal__header"><h3 class="modal__title">批量导入成绩</h3><button class="modal__close" type="button" id="btn-close-results-import"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body"><button type="button" class="btn btn-outline btn-sm mb-2" id="btn-download-results-template"><i class="fas fa-download"></i> 下载Excel模板</button><div class="form"><div class="form__group"><label class="form__label">选择 Excel 文件</label><input type="file" id="results-import-file" class="form__input" accept=".xlsx,.xls,.csv"></div>';
    html += '<div class="form__hint">支持列：赛程ID(schedule_id)、学生姓名(name) 或 学号(student_id) 或 用户ID(user_id)、成绩(performance)、奖项(award)、输入备注(note)、是否打破学校记录(is_school_record)</div></div></div>';
    html += '<div class="modal__footer"><button class="btn btn--outline" type="button" id="btn-cancel-results-import">取消</button><button class="btn btn--primary" id="btn-do-import-results">开始导入</button></div>';
    App.showModal(html);
    document.getElementById('btn-close-results-import').addEventListener('click', () => App.hideModal());
    document.getElementById('btn-cancel-results-import').addEventListener('click', () => App.hideModal());
    document.getElementById('btn-download-results-template').addEventListener('click', () => this._downloadTemplate('results'));

    document.getElementById('btn-do-import-results').addEventListener('click', async () => {
      const fileInput = document.getElementById('results-import-file');
      if (!fileInput.files || !fileInput.files[0]) { App.showToast('请选择文件', 'warning'); return; }
      const file = fileInput.files[0];
      if (file.size > 10 * 1024 * 1024) { App.showToast('文件大小不能超过10MB', 'warning'); return; }
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { App.showToast('仅支持 Excel 或 CSV 文件', 'warning'); return; }
      const confirmed = await App.confirmDialog('确认开始批量导入成绩吗？系统将按文件内容写入正式成绩数据。');
      if (!confirmed) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        App.showLoading();
        const res = await API.upload('/admin/results/batch', formData);
        App.hideLoading();
        App.hideModal();
        App.showToast(res.message || '导入完成', 'success');
        this._loadResults(container);
      } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
    });
  },

  async _autoRank() {
    try {
      App.showLoading();
      const res = await API.post('/admin/results/auto-rank');
      App.hideLoading();
      App.showToast(res.message || '自动排名完成', 'success');
    } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
  },

  async _publishResults(container) {
    const ids = [];
    container.querySelectorAll('.result-checkbox:checked').forEach(cb => ids.push(parseInt(cb.dataset.id)));
    if (ids.length === 0) {
      const allIds = [];
      container.querySelectorAll('.result-checkbox').forEach(cb => allIds.push(parseInt(cb.dataset.id)));
      if (allIds.length === 0) { App.showToast('没有成绩可公示', 'warning'); return; }
      // Publish all
      try {
        App.showLoading();
        await API.put('/admin/results/publish', { ids: allIds });
        App.hideLoading();
        App.showToast('已公示全部成绩', 'success');
        this._loadResults(container);
      } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
      return;
    }
    try {
      App.showLoading();
      await API.put('/admin/results/publish', { ids });
      App.hideLoading();
      App.showToast('已公示 ' + ids.length + ' 条成绩', 'success');
      this._loadResults(container);
    } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
  },

  async _unpublishResults(container) {
    const ids = [];
    container.querySelectorAll('.result-checkbox:checked').forEach(cb => ids.push(parseInt(cb.dataset.id)));
    if (ids.length === 0) { App.showToast('请勾选要撤回公示的成绩', 'warning'); return; }
    try {
      App.showLoading();
      await API.put('/admin/results/unpublish', { ids });
      App.hideLoading();
      App.showToast('已撤回 ' + ids.length + ' 条成绩公示', 'success');
      this._loadResults(container);
    } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
  },

  async _exportResults() {
    try {
      App.showLoading();
      const res = await API.get('/admin/results/export');
      App.hideLoading();
      this._exportExcel(res.data || [], '获奖名单');
    } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
  },

  _confirmDeleteResult(id, container) {
    App.showModal(
      '<div class="confirm-dialog">' +
      '<div class="confirm-dialog__icon confirm-dialog__icon--danger"><i class="fas fa-trash"></i></div>' +
      '<div class="confirm-dialog__title">确认删除成绩？</div>' +
      '<div class="confirm-dialog__desc">删除后不可恢复。</div>' +
      '<div class="modal__footer" style="justify-content:center;">' +
      '<button class="btn btn--outline" onclick="App.hideModal()">取消</button>' +
      '<button class="btn btn--danger" id="btn-confirm-delete-result">确认删除</button>' +
      '</div></div>'
    );
    document.getElementById('btn-confirm-delete-result').addEventListener('click', async () => {
      try {
        App.showLoading();
        await API.admin.deleteResult(id);
        App.hideLoading();
        App.hideModal();
        App.showToast('成绩已删除', 'success');
        this._loadResults(container);
      } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
    });
  },

  // ==================== 数据统计 ====================
  async renderStats(container) {
    container.innerHTML = '<div style="text-align:center;padding:60px;color:#9ca3af;">加载中...</div>';
    try {
      App.showLoading();
      const classRes = await API.get('/admin/stats/class');
      const gradeRes = await API.get('/admin/stats/grade');
      const classData = classRes.data || [];
      const gradeData = gradeRes.data || [];
      App.hideLoading();

      let html = '<div class="card-grid card-grid--2" style="margin-bottom:24px;">';

      // 班级获奖统计柱状图
      html += '<div class="card"><div class="card__header"><h3 class="card__title">各班级获奖统计</h3></div><div class="card__body">';
      if (classData.length > 0) {
        html += '<canvas id="chart-class-awards" style="max-height:300px;"></canvas>';
      } else {
        html += this._emptyState('fas fa-chart-bar', '暂无数据');
      }
      html += '</div></div>';

      // 年级获奖分布饼图
      html += '<div class="card"><div class="card__header"><h3 class="card__title">各年级获奖分布</h3></div><div class="card__body">';
      if (gradeData.length > 0) {
        html += '<canvas id="chart-grade-dist" style="max-height:300px;"></canvas>';
      } else {
        html += this._emptyState('fas fa-chart-pie', '暂无数据');
      }
      html += '</div></div>';

      html += '</div>';

      // 班级统计表格
      html += '<div class="card" style="margin-bottom:24px;">';
      html += '<div class="card__header"><h3 class="card__title">班级统计</h3><div class="card__actions"><button class="btn btn--outline btn--sm" id="btn-export-stats"><i class="fas fa-download"></i> 导出统计报表</button></div></div>';
      html += '<div class="card__body"><div class="table-container"><table class="table table--striped"><thead><tr><th>排名</th><th>班级</th><th>年级</th><th>总人数</th><th>报名人数</th><th>参赛率</th><th>获奖人数</th><th>总分</th></tr></thead><tbody id="class-stats-body">';
      if (classData.length > 0) {
        classData.forEach((c, i) => {
          html += '<tr>';
          html += '<td>' + (i + 1) + '</td>';
          html += '<td><strong>' + c.class_name + '</strong></td>';
          html += '<td>' + c.grade + '</td>';
          html += '<td>' + c.total_students + '</td>';
          html += '<td>' + c.registered_count + '</td>';
          html += '<td>' + (c.reg_rate || 0) + '%</td>';
          html += '<td>' + c.awarded_count + '</td>';
          html += '<td><strong>' + c.total_score + '</strong></td>';
          html += '</tr>';
        });
      } else {
        html += '<tr><td colspan="8">' + this._emptyState('fas fa-table', '暂无统计数据') + '</td></tr>';
      }
      html += '</tbody></table></div></div></div>';

      // 年级统计汇总
      html += '<div class="card">';
      html += '<div class="card__header"><h3 class="card__title">年级统计汇总</h3></div>';
      html += '<div class="card__body"><div class="table-container"><table class="table table--striped"><thead><tr><th>年级</th><th>总人数</th><th>报名人数</th><th>获奖人数</th><th>第一名</th><th>第二名</th><th>第三名</th><th>总分</th></tr></thead><tbody>';
      if (gradeData.length > 0) {
        gradeData.forEach(g => {
          html += '<tr><td><strong>' + g.grade + '</strong></td><td>' + g.total_students + '</td><td>' + g.registered_count + '</td><td>' + g.awarded_count + '</td><td>' + (g.first_prize || 0) + '</td><td>' + (g.second_prize || 0) + '</td><td>' + (g.third_prize || 0) + '</td><td><strong>' + g.total_score + '</strong></td></tr>';
        });
      } else {
        html += '<tr><td colspan="8">' + this._emptyState('fas fa-table', '暂无统计数据') + '</td></tr>';
      }
      html += '</tbody></table></div></div></div>';

      container.innerHTML = html;

      // 渲染图表
      if (classData.length > 0) {
        const ctx1 = document.getElementById('chart-class-awards');
        if (ctx1) {
          const chart1 = new Chart(ctx1, {
            type: 'bar',
            data: {
              labels: classData.slice(0, 15).map(c => c.class_name),
              datasets: [{
                label: '获奖人数',
                data: classData.slice(0, 15).map(c => c.awarded_count),
                backgroundColor: 'rgba(26, 115, 232, 0.6)',
                borderColor: 'rgba(26, 115, 232, 1)',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
          });
          this._chartInstances.push(chart1);
        }
      }

      if (gradeData.length > 0) {
        const ctx2 = document.getElementById('chart-grade-dist');
        if (ctx2) {
          const chart2 = new Chart(ctx2, {
            type: 'pie',
            data: {
              labels: gradeData.map(g => g.grade),
              datasets: [{
                data: gradeData.map(g => g.total_score),
                backgroundColor: ['#1a73e8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' } }
            }
          });
          this._chartInstances.push(chart2);
        }
      }

      // 导出统计
      const exportBtn = container.querySelector('#btn-export-stats');
      if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
          try {
            App.showLoading();
            const res = await API.get('/admin/stats/export');
            App.hideLoading();
            const data = res.data || {};
            const combined = [...(data.classStats || []), ...(data.eventStats || []), ...(data.awardSummary || [])];
            this._exportExcel(combined, '统计报表');
          } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
        });
      }
    } catch (e) {
      App.hideLoading();
      container.innerHTML = '<div class="empty-state"><div class="empty-state__icon"><i class="fas fa-exclamation-triangle"></i></div><div class="empty-state__title">加载失败</div><div class="empty-state__desc">' + e.message + '</div></div>';
    }
  },

  // ==================== 公告管理 ====================
  _annPage: 1,
  _annLimit: 20,

  async renderAnnouncements(container) {
    this._annPage = 1;
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">公告管理</h3>
          <div class="card__actions">
            <button class="btn btn--primary btn--sm" id="btn-add-announcement"><i class="fas fa-plus"></i> 发布公告</button>
          </div>
        </div>
        <div class="card__body">
          <div class="table-container" id="ann-table-container"></div>
          <div id="ann-pagination"></div>
        </div>
      </div>
    `;
    this._loadAnnouncements(container);
    container.querySelector('#btn-add-announcement').addEventListener('click', () => this._showAnnouncementModal(null, container));
  },

  async _loadAnnouncements(container) {
    try {
      App.showLoading();
      const res = await API.get('/admin/announcements?page=' + this._annPage + '&limit=' + this._annLimit);
      const d = res.data || res;
      const list = d.list || [];
      const total = d.total || 0;
      App.hideLoading();

      let html = '';
      if (list.length > 0) {
        html = '<table class="table table--striped"><thead><tr><th>标题</th><th>分类</th><th>发布人</th><th>发布时间</th><th>置顶</th><th>状态</th><th>有效期</th><th>操作</th></tr></thead><tbody>';
        list.forEach(a => {
          const statusMap = { draft: '<span class="badge badge--inactive">草稿</span>', published: '<span class="badge badge--active">已发布</span>' };
          html += '<tr>';
          html += '<td>' + a.title + '</td>';
          html += '<td>' + (a.category === 'general' ? '一般' : a.category === 'urgent' ? '紧急' : a.category || '一般') + '</td>';
          html += '<td>' + (a.publisher_name || '-') + '</td>';
          html += '<td>' + (a.publish_time || a.created_at || '-') + '</td>';
          html += '<td>' + (a.is_pinned ? '<span class="badge badge--warning">置顶</span>' : '<span class="badge badge--inactive">否</span>') + '</td>';
          html += '<td>' + (statusMap[a.status] || a.status) + '</td>';
          html += '<td>' + (a.expire_time || '永久') + '</td>';
          html += '<td><div class="table__actions">';
          html += '<button class="btn btn--ghost btn--xs btn-edit-ann" data-id="' + a.id + '"><i class="fas fa-edit"></i></button>';
          html += '<button class="btn btn--ghost btn--xs btn-pin-ann" data-id="' + a.id + '" title="' + (a.is_pinned ? '取消置顶' : '置顶') + '"><i class="fas fa-thumbtack" style="' + (a.is_pinned ? 'color:#f59e0b;' : '') + '"></i></button>';
          html += '<button class="btn btn--ghost btn--xs btn-delete-ann" data-id="' + a.id + '" style="color:#ef4444;"><i class="fas fa-trash"></i></button>';
          html += '</div></td></tr>';
        });
        html += '</tbody></table>';
      } else {
        html = this._emptyState('fas fa-bullhorn', '暂无公告');
      }

      container.querySelector('#ann-table-container').innerHTML = html;
      const pagInfo = this._paginate({ page: this._annPage, total, limit: this._annLimit, callback: (p) => { this._annPage = p; this._loadAnnouncements(container); } });
      container.querySelector('#ann-pagination').innerHTML = this._renderPagination(pagInfo, 'ann-pagination');

      container.querySelectorAll('.btn-edit-ann').forEach(btn => {
        btn.addEventListener('click', () => {
          const ann = list.find(a => a.id == btn.dataset.id);
          if (ann) this._showAnnouncementModal(ann, container);
        });
      });
      container.querySelectorAll('.btn-pin-ann').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            App.showLoading();
            await API.put('/admin/announcements/' + btn.dataset.id + '/pin');
            App.hideLoading();
            App.showToast('操作成功', 'success');
            this._loadAnnouncements(container);
          } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
        });
      });
      container.querySelectorAll('.btn-delete-ann').forEach(btn => {
        btn.addEventListener('click', () => this._confirmDeleteAnnouncement(btn.dataset.id, container));
      });
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  _showAnnouncementModal(announcement, container) {
    const isEdit = !!announcement;
    const title = isEdit ? '编辑公告' : '发布公告';
    let html = '<div class="modal__header"><h3 class="modal__title">' + title + '</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body"><div class="form">';
    html += '<div class="form__group"><label class="form__label form__label--required">标题</label><input class="form__input" id="ann-title" value="' + (isEdit ? (announcement.title || '') : '') + '"></div>';
    html += '<div class="form__group"><label class="form__label form__label--required">内容</label><textarea class="form__textarea" id="ann-content" rows="5">' + (isEdit ? (announcement.content || '') : '') + '</textarea></div>';
    html += '<div class="form__group"><label class="form__label">分类</label><select class="form__select" id="ann-category">';
    ['general:一般', 'urgent:紧急', 'notice:通知'].forEach(o => {
      const [val, label] = o.split(':');
      const sel = isEdit && announcement.category === val ? ' selected' : '';
      html += '<option value="' + val + '"' + sel + '>' + label + '</option>';
    });
    html += '</select></div>';
    html += '<div class="form__group"><label class="form__label">置顶</label><select class="form__select" id="ann-pinned"><option value="0">否</option><option value="1"' + (isEdit && announcement.is_pinned ? ' selected' : '') + '>是</option></select></div>';
    html += '<div class="form__group"><label class="form__label">状态</label><select class="form__select" id="ann-status"><option value="published">发布</option><option value="draft"' + (isEdit && announcement.status === 'draft' ? ' selected' : '') + '>草稿</option></select></div>';
    html += '<div class="form__group"><label class="form__label">有效期</label><input class="form__input" id="ann-expire" type="datetime-local" value="' + (isEdit && announcement.expire_time ? (announcement.expire_time || '').replace(' ', 'T').substring(0, 16) : '') + '"></div>';
    html += '</div></div>';
    html += '<div class="modal__footer"><button class="btn btn--outline" onclick="App.hideModal()">取消</button><button class="btn btn--primary" id="btn-save-ann" data-id="' + (isEdit ? announcement.id : '') + '">保存</button></div>';
    App.showModal(html);

    document.getElementById('btn-save-ann').addEventListener('click', async () => {
      const id = document.getElementById('btn-save-ann').dataset.id;
      const data = {
        title: document.getElementById('ann-title').value.trim(),
        content: document.getElementById('ann-content').value.trim(),
        category: document.getElementById('ann-category').value,
        is_pinned: document.getElementById('ann-pinned').value === '1',
        status: document.getElementById('ann-status').value,
        expire_time: document.getElementById('ann-expire').value || null
      };
      if (!data.title || !data.content) { App.showToast('标题和内容必填', 'warning'); return; }
      try {
        App.showLoading();
        if (isEdit) {
          await API.admin.updateAnnouncement(id, data);
          App.showToast('公告已更新', 'success');
        } else {
          await API.admin.createAnnouncement(data);
          App.showToast('公告已发布', 'success');
        }
        App.hideModal();
        App.hideLoading();
        this._loadAnnouncements(container);
      } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
    });
  },

  _confirmDeleteAnnouncement(id, container) {
    App.showModal(
      '<div class="confirm-dialog">' +
      '<div class="confirm-dialog__icon confirm-dialog__icon--danger"><i class="fas fa-trash"></i></div>' +
      '<div class="confirm-dialog__title">确认删除公告？</div>' +
      '<div class="confirm-dialog__desc">删除后不可恢复。</div>' +
      '<div class="modal__footer" style="justify-content:center;">' +
      '<button class="btn btn--outline" onclick="App.hideModal()">取消</button>' +
      '<button class="btn btn--danger" id="btn-confirm-delete-ann">确认删除</button>' +
      '</div></div>'
    );
    document.getElementById('btn-confirm-delete-ann').addEventListener('click', async () => {
      try {
        App.showLoading();
        await API.admin.deleteAnnouncement(id);
        App.hideLoading();
        App.hideModal();
        App.showToast('公告已删除', 'success');
        this._loadAnnouncements(container);
      } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
    });
  },

  // ==================== 系统设置 ====================
  async renderSettings(container) {
    container.innerHTML = '<div style="text-align:center;padding:60px;color:#9ca3af;">加载中...</div>';
    try {
      App.showLoading();
      const settingsRes = await API.get('/admin/settings');
      const rulesRes = await API.get('/admin/rules');
      const gradesRes = await API.get('/admin/grades');
      const settings = settingsRes.data || {};
      const rules = rulesRes.data && rulesRes.data.rules ? rulesRes.data.rules : {};
      const gradesData = gradesRes.data || {};
      const grades = gradesData.grades || [];
      const classes = gradesData.classes || [];
      App.hideLoading();

      let html = '<div class="card-grid card-grid--2" style="margin-bottom:24px;">';

      // 基本设置
      html += '<div class="card"><div class="card__header"><h3 class="card__title">基本设置</h3></div><div class="card__body"><div class="form">';
      html += '<div class="form__group"><label class="form__label">网站名称</label><input class="form__input" id="set-site-name" value="' + (settings.site_name || '') + '"></div>';
      html += '<div class="form__group"><label class="form__label">运动会主题</label><input class="form__input" id="set-theme" value="' + (settings.theme || '') + '"></div>';
      html += '<div class="form__group"><label class="form__label">开始日期</label><input class="form__input" id="set-start-date" type="date" value="' + (settings.start_date || '') + '"></div>';
      html += '<div class="form__group"><label class="form__label">结束日期</label><input class="form__input" id="set-end-date" type="date" value="' + (settings.end_date || '') + '"></div>';
      html += '</div></div></div>';

      // 开关设置
      html += '<div class="card"><div class="card__header"><h3 class="card__title">功能开关</h3></div><div class="card__body"><div class="form">';
      html += '<div class="form__group form__group--row"><label class="form__label">报名开关</label><input type="checkbox" id="set-reg-open"' + (settings.registration_open ? ' checked' : '') + ' style="width:18px;height:18px;"></div>';
      html += '<div class="form__group form__group--row"><label class="form__label">网站维护模式</label><input type="checkbox" id="set-maintenance"' + (settings.site_maintenance ? ' checked' : '') + ' style="width:18px;height:18px;"></div>';
      html += '<div class="form__group form__group--row"><label class="form__label">AI 审核 (DeepSeek+豆包)</label><input type="checkbox" id="set-ai-moderation"' + (settings.ai_moderation_enabled === '1' ? ' checked' : '') + ' style="width:18px;height:18px;"><span style="font-size:.65rem;color:var(--text3);margin-left:6px">自动审核论坛文字和图片内容</span></div>';
      html += '</div><div class="card__header"><h3 class="card__title">报名规则</h3></div><div class="card__body"><div class="form">';
      html += '<div class="form__group"><label class="form__label">每人限报项目数</label><input class="form__input" id="set-max-events" type="number" value="' + (rules.max_events_per_person || 3) + '"></div>';
      html += '<div class="form__group"><label class="form__label">每项目人数上限</label><input class="form__input" id="set-max-per-event" type="number" value="' + (rules.max_participants_per_event || 0) + '" placeholder="0=不限"></div>';
      html += '</div></div></div>';
      html += '</div>';

      // 年级班级管理
      html += '<div class="card-grid card-grid--2" style="margin-bottom:24px;">';

      html += '<div class="card"><div class="card__header"><h3 class="card__title">年级管理</h3><div class="card__actions"><button class="btn btn--primary btn--sm" id="btn-add-grade"><i class="fas fa-plus"></i></button></div></div><div class="card__body">';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;" id="grades-list">';
      if (grades.length > 0) {
        grades.forEach(g => {
          html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#e8f0fe;border-radius:4px;font-size:0.875rem;">' + g.name + ' <button class="btn btn--ghost btn--xs btn-delete-grade" data-id="' + g.id + '" style="color:#ef4444;padding:0 4px;"><i class="fas fa-times"></i></button></div>';
        });
      } else {
        html += '<span style="color:#9ca3af;font-size:0.875rem;">暂无年级</span>';
      }
      html += '</div></div></div>';

      html += '<div class="card"><div class="card__header"><h3 class="card__title">班级管理</h3><div class="card__actions"><button class="btn btn--primary btn--sm" id="btn-add-class"><i class="fas fa-plus"></i></button></div></div><div class="card__body">';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;" id="classes-list">';
      if (classes.length > 0) {
        classes.forEach(c => {
          html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#d1fae5;border-radius:4px;font-size:0.875rem;">' + c.grade_name + ' ' + c.name + ' <button class="btn btn--ghost btn--xs btn-delete-class" data-id="' + c.id + '" style="color:#ef4444;padding:0 4px;"><i class="fas fa-times"></i></button></div>';
        });
      } else {
        html += '<span style="color:#9ca3af;font-size:0.875rem;">暂无班级</span>';
      }
      html += '</div></div></div>';

      html += '</div>';

      // 保存按钮
      html += '<div style="display:flex;gap:12px;justify-content:flex-start;"><button class="btn btn--primary btn--lg" id="btn-save-settings"><i class="fas fa-save"></i> 保存设置</button></div>';

      container.innerHTML = html;

      // 保存设置
      container.querySelector('#btn-save-settings').addEventListener('click', async () => {
        const settingsData = {
          site_name: document.getElementById('set-site-name').value,
          theme: document.getElementById('set-theme').value,
          start_date: document.getElementById('set-start-date').value,
          end_date: document.getElementById('set-end-date').value,
          registration_open: document.getElementById('set-reg-open').checked,
          site_maintenance: document.getElementById('set-maintenance').checked,
          ai_moderation_enabled: document.getElementById('set-ai-moderation')?.checked ? '1' : '0'
        };
        const rulesData = {
          max_events_per_person: document.getElementById('set-max-events').value,
          max_participants_per_event: document.getElementById('set-max-per-event').value
        };
        try {
          App.showLoading();
          await API.put('/admin/settings', settingsData);
          await API.put('/admin/rules', rulesData);
          App.hideLoading();
          App.showToast('设置已保存', 'success');
        } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
      });

      // 添加年级
      container.querySelector('#btn-add-grade').addEventListener('click', () => {
        App.showModal(
          '<div class="modal__header"><h3 class="modal__title">添加年级</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>' +
          '<div class="modal__body"><div class="form"><div class="form__group"><label class="form__label">年级名称</label><input class="form__input" id="new-grade-name" placeholder="如: 高一"></div></div></div>' +
          '<div class="modal__footer"><button class="btn btn--outline" onclick="App.hideModal()">取消</button><button class="btn btn--primary" id="btn-confirm-add-grade">添加</button></div>'
        );
        document.getElementById('btn-confirm-add-grade').addEventListener('click', async () => {
          const name = document.getElementById('new-grade-name').value.trim();
          if (!name) { App.showToast('请输入年级名称', 'warning'); return; }
          try {
            App.showLoading();
            await API.admin.createGrade({ name });
            App.hideLoading();
            App.hideModal();
            App.showToast('年级已添加', 'success');
            this.renderSettings(container);
          } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
        });
      });

      // 添加班级
      container.querySelector('#btn-add-class').addEventListener('click', () => {
        let gradeOpts = '';
        const currentGrades = grades;
        currentGrades.forEach(g => { gradeOpts += '<option value="' + g.id + '">' + g.name + '</option>'; });
        App.showModal(
          '<div class="modal__header"><h3 class="modal__title">添加班级</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>' +
          '<div class="modal__body"><div class="form"><div class="form__group"><label class="form__label">年级</label><select class="form__select" id="new-class-grade">' + gradeOpts + '</select></div><div class="form__group"><label class="form__label">班级名称</label><input class="form__input" id="new-class-name" placeholder="如: 1班"></div></div></div>' +
          '<div class="modal__footer"><button class="btn btn--outline" onclick="App.hideModal()">取消</button><button class="btn btn--primary" id="btn-confirm-add-class">添加</button></div>'
        );
        document.getElementById('btn-confirm-add-class').addEventListener('click', async () => {
          const gradeId = document.getElementById('new-class-grade').value;
          const name = document.getElementById('new-class-name').value.trim();
          if (!gradeId || !name) { App.showToast('请填写完整信息', 'warning'); return; }
          try {
            App.showLoading();
            await API.admin.createClass({ grade_id: parseInt(gradeId), name });
            App.hideLoading();
            App.hideModal();
            App.showToast('班级已添加', 'success');
            this.renderSettings(container);
          } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
        });
      });

      // 删除年级/班级
      container.querySelectorAll('.btn-delete-grade').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('确认删除该年级？将同时删除该年级下所有班级。')) return;
          try {
            App.showLoading();
            await API.admin.deleteGrade(btn.dataset.id);
            App.hideLoading();
            App.showToast('年级已删除', 'success');
            this.renderSettings(container);
          } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
        });
      });
      container.querySelectorAll('.btn-delete-class').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('确认删除该班级？')) return;
          try {
            App.showLoading();
            await API.admin.deleteClass(btn.dataset.id);
            App.hideLoading();
            App.showToast('班级已删除', 'success');
            this.renderSettings(container);
          } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
        });
      });
    } catch (e) {
      App.hideLoading();
      container.innerHTML = '<div class="empty-state"><div class="empty-state__icon"><i class="fas fa-exclamation-triangle"></i></div><div class="empty-state__title">加载失败</div><div class="empty-state__desc">' + e.message + '</div></div>';
    }
  },

  // ==================== 操作日志 ====================
  _logsPage: 1,
  _logsLimit: 20,

  async renderLogs(container) {
    this._logsPage = 1;
    container.innerHTML = `
      <div class="card">
        <div class="card__header"><h3 class="card__title">操作日志</h3></div>
        <div class="card__body">
          <div class="search-filter-bar">
            <input type="text" id="logs-keyword" class="form__input" placeholder="搜索操作..." style="max-width:240px;">
            <button class="btn btn--primary btn--sm" id="btn-logs-search"><i class="fas fa-search"></i> 搜索</button>
          </div>
          <div class="table-container" id="logs-table-container"></div>
          <div id="logs-pagination"></div>
        </div>
      </div>
    `;
    this._loadLogs(container);
    container.querySelector('#btn-logs-search').addEventListener('click', () => { this._logsPage = 1; this._loadLogs(container); });
  },

  async _loadLogs(container) {
    try {
      App.showLoading();
      const keyword = container.querySelector('#logs-keyword').value;
      const params = { page: this._logsPage, limit: this._logsLimit };
      if (keyword) params.action = keyword;
      const res = await API.get('/admin/logs' + API._qs(params));
      const d = res.data || res;
      const list = d.list || [];
      const total = d.total || 0;
      App.hideLoading();

      let html = '';
      if (list.length > 0) {
        html = '<table class="table table--striped"><thead><tr><th>时间</th><th>用户</th><th>操作</th><th>详情</th><th>IP</th></tr></thead><tbody>';
        list.forEach(l => {
          html += '<tr><td>' + (l.created_at || '') + '</td><td>' + (l.username || '-') + '</td><td>' + (l.action || '') + '</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + (l.detail || '') + '">' + (l.detail || '') + '</td><td>' + (l.ip_address || l.ip || '') + '</td></tr>';
        });
        html += '</tbody></table>';
      } else {
        html = this._emptyState('fas fa-history', '暂无日志');
      }

      container.querySelector('#logs-table-container').innerHTML = html;
      const pagInfo = this._paginate({ page: this._logsPage, total, limit: this._logsLimit, callback: (p) => { this._logsPage = p; this._loadLogs(container); } });
      container.querySelector('#logs-pagination').innerHTML = this._renderPagination(pagInfo, 'logs-pagination');
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  // ==================== 参赛者查看 ====================
  async _viewParticipants(scheduleId, eventName) {
    try {
      App.showLoading();
      const res = await API.admin.getScheduleParticipants(scheduleId);
      App.hideLoading();
      const data = res.data || [];
      let html = `<div class="modal-header"><h3>参赛学生 - ${eventName||''}</h3><button class="modal-close" onclick="App.hideModal()">&times;</button></div><div class="modal-body">`;
      if (data.length === 0) {
        html += '<p class="text-muted">暂无已通过审核的参赛学生</p>';
      } else {
        html += `<div class="table-container"><table class="table"><thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>年级</th><th>报名时间</th></tr></thead><tbody>`;
        data.forEach(p => {
          html += `<tr><td>${p.student_id||'-'}</td><td>${p.name||'-'}</td><td>${p.class_name||'-'}</td><td>${p.grade||'-'}</td><td>${App.formatDate(p.registration_time)}</td></tr>`;
        });
        html += `</tbody></table></div><p class="text-sm text-muted mt-2">共 ${data.length} 人</p>`;
      }
      html += '</div><div class="modal-footer"><button class="btn btn-secondary" onclick="App.hideModal()">关闭</button></div>';
      App.showModal(html);
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  // ==================== 年级班级管理 ====================
  _renderGrades(content) {
    content.innerHTML = `
      <div class="mb-3"><h2>年级班级管理</h2></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
        <div class="card">
          <div class="card-header"><h3>年级列表</h3><button class="btn btn-primary btn-sm" onclick="Admin._addGrade()">添加年级</button></div>
          <div class="card-body" id="grade-list"><p class="text-muted">加载中...</p></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>班级列表</h3><button class="btn btn-primary btn-sm" onclick="Admin._addClass()">添加班级</button></div>
          <div class="card-body" id="class-list"><p class="text-muted">加载中...</p></div>
        </div>
      </div>
    `;
    this._loadGradesClasses();
  },
  async _loadGradesClasses() {
    try {
      const res = await API.get('/admin/grades');
      const grades = res.data?.grades || [];
      const classes = res.data?.classes || [];
      let gh = '<table class="table"><thead><tr><th>名称</th><th>排序</th><th>操作</th></tr></thead><tbody>';
      let ch = '';
      grades.forEach(g => {
        gh += `<tr><td>${g.name}</td><td>${g.sort_order||0}</td><td><button class="btn btn-danger btn-xs" onclick="Admin._deleteGrade(${g.id})">删除</button></td></tr>`;
      });
      gh += grades.length === 0 ? '<tr><td colspan="3" class="text-muted">暂无年级</td></tr>' : '';
      gh += '</tbody></table>';
      classes.forEach(c => {
        ch += `<tr><td>${c.name} (${c.grade_name||''})</td><td>${c.sort_order||0}</td><td><button class="btn btn-danger btn-xs" onclick="Admin._deleteClass(${c.id})">删除</button></td></tr>`;
      });
      ch = ch ? '<table class="table"><thead><tr><th>名称</th><th>排序</th><th>操作</th></tr></thead><tbody>' + ch + '</tbody></table>' : '<p class="text-muted">暂无班级</p>';
      document.getElementById('grade-list').innerHTML = gh;
      document.getElementById('class-list').innerHTML = ch;
    } catch(e) { App.showToast(e.message,'error'); }
  },
  async _addGrade() {
    App.showModal(`
      <div class="modal__header"><h3 class="modal__title">添加年级</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>
      <div class="modal__body"><div class="form"><div class="form__group"><label class="form__label">年级名称</label><input class="form__input" id="new-grade-name" placeholder="如：高一"></div></div></div>
      <div class="modal__footer"><button class="btn btn--outline" onclick="App.hideModal()">取消</button><button class="btn btn--primary" id="btn-confirm-add-grade">添加</button></div>
    `);
    document.getElementById('btn-confirm-add-grade').addEventListener('click', async () => {
      const name = document.getElementById('new-grade-name').value.trim();
      if (!name) { App.showToast('请输入年级名称','warning'); return; }
      try { App.showLoading(); await API.admin.createGrade({name}); App.hideModal(); Admin._loadGradesClasses(); App.showToast('添加成功','success'); } catch(e) { App.hideLoading(); App.showToast(e.message,'error'); }
    });
  },
  async _deleteGrade(id) {
    App.showModal(`
      <div class="confirm-dialog"><p>确认删除该年级？将同时删除该年级下所有班级。</p>
        <div class="confirm-actions"><button class="btn btn-secondary" id="confirm-grade-cancel">取消</button><button class="btn btn-danger" id="confirm-grade-ok">确认删除</button></div>
      </div>
    `);
    document.getElementById('confirm-grade-cancel').onclick = () => App.hideModal();
    document.getElementById('confirm-grade-ok').onclick = async () => {
      App.hideModal();
      try { App.showLoading(); await API.admin.deleteGrade(id); Admin._loadGradesClasses(); App.showToast('已删除','success'); } catch(e) { App.hideLoading(); App.showToast(e.message,'error'); }
    };
  },
  async _addClass() {
    try {
      App.showLoading();
      const gRes = await API.get('/admin/grades');
      App.hideLoading();
      const grades = gRes.data?.grades || [];
      if (!grades.length) { App.showToast('请先添加年级','warning'); return; }
      let gradeOpts = '';
      grades.forEach(g => { gradeOpts += `<option value="${g.id}">${g.name}</option>`; });
      App.showModal(`
        <div class="modal__header"><h3 class="modal__title">添加班级</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>
        <div class="modal__body"><div class="form">
          <div class="form__group"><label class="form__label">年级</label><select class="form__select" id="new-class-grade">${gradeOpts}</select></div>
          <div class="form__group"><label class="form__label">班级名称</label><input class="form__input" id="new-class-name" placeholder="如：1班"></div>
        </div></div>
        <div class="modal__footer"><button class="btn btn--outline" onclick="App.hideModal()">取消</button><button class="btn btn--primary" id="btn-confirm-add-class">添加</button></div>
      `);
      document.getElementById('btn-confirm-add-class').addEventListener('click', async () => {
        const gradeId = document.getElementById('new-class-grade').value;
        const name = document.getElementById('new-class-name').value.trim();
        if (!name) { App.showToast('请输入班级名称','warning'); return; }
        try { App.showLoading(); await API.admin.createClass({grade_id:parseInt(gradeId),name}); App.hideModal(); Admin._loadGradesClasses(); App.showToast('添加成功','success'); } catch(e) { App.hideLoading(); App.showToast(e.message,'error'); }
      });
    } catch(e) { App.hideLoading(); App.showToast(e.message,'error'); }
  },
  async _deleteClass(id) {
    App.showModal(`
      <div class="confirm-dialog"><p>确认删除该班级？</p>
        <div class="confirm-actions"><button class="btn btn-secondary" id="confirm-class-cancel">取消</button><button class="btn btn-danger" id="confirm-class-ok">确认删除</button></div>
      </div>
    `);
    document.getElementById('confirm-class-cancel').onclick = () => App.hideModal();
    document.getElementById('confirm-class-ok').onclick = async () => {
      App.hideModal();
      try { App.showLoading(); await API.admin.deleteClass(id); Admin._loadGradesClasses(); App.showToast('已删除','success'); } catch(e) { App.hideLoading(); App.showToast(e.message,'error'); }
    };
  },

  // ==================== 模板下载 ====================
  _downloadTemplate(type) {
    if (typeof XLSX === 'undefined') return App.showToast('请检查网络连接（XLSX库未加载）','error');
    let headers, filename;
    if (type === 'users') {
      headers = ['学号', '姓名', '班级', '年级'];
      filename = '学生导入模板.xlsx';
    } else if (type === 'results') {
      headers = ['赛程ID', '学生姓名', '学号', '成绩', '奖项', '输入备注', '是否打破学校记录'];
      filename = '成绩导入模板.xlsx';
    } else return;
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename);
    App.showToast('模板已下载', 'success');
  },
};

window.Admin = Admin;
