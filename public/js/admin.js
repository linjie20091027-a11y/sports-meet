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
    return `<div class="empty-state"><div class="empty-state__icon"><i class="${icon}"></i></div><p class="empty-state__desc">${title||''}</p>${desc?`<p class="text-sm text-muted">${desc}</p>`:''}</div>`;
  },

  // 论坛评论审核
  async _showForumModeration() {
    App.showLoading();
    try {
      const res = await API.get('/forum/pending-replies');
      App.hideLoading();
      const replies = res.data || [];
      let html = '<div class="modal__header"><h3 class="modal__title">论坛评论审核</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
      html += '<div class="modal__body">';
      if (replies.length === 0) {
        html += '<p class="text-muted text-center">没有待审核的评论</p>';
      } else {
        html += replies.map(r => `
          <div style="border:1px solid var(--border-light);padding:12px;margin-bottom:8px;border-radius:4px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <strong>${r.author_name} (${r.class_name||''})</strong>
              <span class="text-sm text-muted">帖子：${r.post_title}</span>
            </div>
            <p style="margin-bottom:12px;color:var(--text2)">${r.content}</p>
            <div style="display:flex;gap:8px">
              <button class="btn btn-success btn-xs" onclick="Admin._approveReply(${r.id})">通过</button>
              <button class="btn btn-danger btn-xs" onclick="Admin._rejectReply(${r.id})">驳回</button>
            </div>
          </div>
        `).join('');
      }
      html += '</div><div class="modal__footer"><button class="btn btn-secondary" onclick="App.hideModal()">关闭</button></div>';
      App.showModal(html);
    } catch(e) { App.hideLoading(); App.showToast(e.message,'error'); }
  },

  async _approveReply(id) {
    try { await API.put('/forum/replies/'+id+'/approve'); App.showToast('已通过','success'); this._showForumModeration(); }
    catch(e) { App.showToast(e.message,'error'); }
  },

  async _rejectReply(id) {
    try { await API.put('/forum/replies/'+id+'/reject'); App.showToast('已驳回','success'); this._showForumModeration(); }
    catch(e) { App.showToast(e.message,'error'); }
  },

  // AI 生成赛程
  async _generateSchedule() {
    App.showLoading();
    try {
      const res = await API.get('/ai/generate-schedule');
      App.hideLoading();
      if (!res.success) return App.showToast(res.error,'error');
      const schedule = res.data;
      
      let html = '<div class="modal__header"><h3 class="modal__title">AI生成赛程表</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
      html += '<div class="modal__body">';
      const days = [
        { key: 'day1_am', label: '第一天 上午 (8:00-12:00)' },
        { key: 'day1_pm', label: '第一天 下午 (14:00-17:00)' },
        { key: 'day2_am', label: '第二天 上午 (8:00-12:00)' },
        { key: 'day2_pm', label: '第二天 下午 (14:00-17:00)' },
      ];
      days.forEach(day => {
        const items = schedule[day.key] || [];
        if (items.length) {
          html += `<h4 style="margin:12px 0 8px;color:var(--red)">${day.label}</h4>`;
          html += '<div class="table-container"><table class="table"><thead><tr><th>时间</th><th>项目</th><th>轮次</th><th>场地</th><th>参赛者</th></tr></thead><tbody>';
          items.forEach(item => {
            html += `<tr><td>${item.time||'-'}</td><td>${item.event||'-'}</td><td>${item.round||'-'}</td><td>${item.venue||'-'}</td><td>${Array.isArray(item.students)?item.students.join('、'):item.students||'-'}</td></tr>`;
          });
          html += '</tbody></table></div>';
        }
      });

      // 导出Excel按钮
      html += '<div style="margin-top:16px"><button class="btn btn-success btn-sm" onclick="Admin._exportScheduleExcel()">导出为Excel</button></div>';
      html += '</div><div class="modal__footer"><button class="btn btn-secondary" onclick="App.hideModal()">关闭</button></div>';
      
      // 保存赛程数据供导出
      this._currentSchedule = schedule;
      App.showModal(html);
    } catch(e) { App.hideLoading(); App.showToast(e.message,'error'); }
  },

  _exportScheduleExcel() {
    if (!this._currentSchedule) return App.showToast('没有赛程数据');
    const days = ['day1_am','day1_pm','day2_am','day2_pm'];
    const labels = ['第一天 上午','第一天 下午','第二天 上午','第二天 下午'];
    const rows = [['赛段','时间','项目','轮次','场地','参赛者']];
    days.forEach((d,i) => {
      (this._currentSchedule[d]||[]).forEach(item => {
        rows.push([labels[i], item.time||'', item.event||'', item.round||'', item.venue||'', Array.isArray(item.students)?item.students.join('、'):'']);
      });
    });
    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '赛程表');
      XLSX.writeFile(wb, '运动会赛程表.xlsx');
      App.showToast('导出成功','success');
    } else { App.showToast('XLSX库未加载','error'); }
  },
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

  async renderRegistrations(container) {
    this._regPage = 1;
    container.innerHTML = `
      <div class="card" style="margin-bottom:24px;">
        <div class="card__header"><h3 class="card__title">报名记录</h3><div class="card__actions"><button class="btn btn--success btn--sm" id="btn-batch-approve"><i class="fas fa-check-double"></i> 批量通过</button><button class="btn btn--outline btn--sm" id="btn-export-reg"><i class="fas fa-download"></i> 导出报名表</button></div></div>
        <div class="card__body">
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
    this._loadRegStats(container);
    this._bindRegEvents(container);
  },

  _renderRegFilter(container) {
    const bar = container.querySelector('#reg-filter-bar');
    bar.innerHTML = `
      <select id="reg-grade" class="form__select"><option value="">全部年级</option></select>
      <select id="reg-class" class="form__select"><option value="">全部班级</option></select>
      <select id="reg-event" class="form__select"><option value="">全部项目</option></select>
      <select id="reg-status" class="form__select"><option value="">全部状态</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已驳回</option></select>
      <button class="btn btn--primary btn--sm" id="btn-reg-search"><i class="fas fa-search"></i> 筛选</button>
    `;
    this._loadRegFilters(container);
  },

  async _loadRegFilters(container) {
    try {
      const gradesRes = await API.public.getGrades();
      const grades = gradesRes.data && gradesRes.data.grades ? gradesRes.data.grades : [];
      const classes = gradesRes.data && gradesRes.data.classes ? gradesRes.data.classes : [];
      const gradeSel = container.querySelector('#reg-grade');
      grades.forEach(g => { const o = document.createElement('option'); o.value = g.name; o.textContent = g.name; gradeSel.appendChild(o); });
      const classSel = container.querySelector('#reg-class');
      classes.forEach(c => { const o = document.createElement('option'); o.value = c.name; o.textContent = c.name; classSel.appendChild(o); });

      const eventsRes = await API.get('/admin/events');
      const events = eventsRes.data || [];
      const eventSel = container.querySelector('#reg-event');
      events.forEach(e => { const o = document.createElement('option'); o.value = e.id; o.textContent = e.name; eventSel.appendChild(o); });
    } catch (e) {}
  },

  _bindRegEvents(container) {
    container.querySelector('#btn-reg-search').addEventListener('click', () => { this._regPage = 1; this._loadRegistrations(container); });
    container.querySelector('#btn-batch-approve').addEventListener('click', () => this._batchApprove(container));
    container.querySelector('#btn-export-reg').addEventListener('click', () => this._exportRegistrations());
  },

  async _loadRegistrations(container) {
    try {
      App.showLoading();
      const params = { page: this._regPage, limit: this._regLimit };
      const grade = container.querySelector('#reg-grade').value;
      const className = container.querySelector('#reg-class').value;
      const eventId = container.querySelector('#reg-event').value;
      const status = container.querySelector('#reg-status').value;
      if (grade) params.grade = grade;
      if (className) params.class_name = className;
      if (eventId) params.event_id = eventId;
      if (status) params.status = status;

      const res = await API.admin.getRegistrations(params);
      const d = res.data || res;
      const list = d.list || [];
      const total = d.total || 0;
      App.hideLoading();

      let html = '';
      if (list.length > 0) {
        html = '<table class="table table--striped"><thead><tr><th><input type="checkbox" id="reg-select-all"></th><th>学号</th><th>姓名</th><th>班级</th><th>年级</th><th>项目</th><th>状态</th><th>操作</th></tr></thead><tbody>';
        list.forEach(r => {
          const statusMap = { pending: '<span class="badge badge--pending">待审核</span>', approved: '<span class="badge badge--approved">已通过</span>', rejected: '<span class="badge badge--rejected">已驳回</span>' };
          html += '<tr><td><input type="checkbox" class="reg-checkbox" data-id="' + r.id + '" data-status="' + r.status + '"></td>';
          html += '<td>' + (r.student_id || '-') + '</td>';
          html += '<td>' + (r.user_name || '-') + '</td>';
          html += '<td>' + (r.class_name || '-') + '</td>';
          html += '<td>' + (r.grade || '-') + '</td>';
          html += '<td>' + (r.event_name || '-') + '</td>';
          html += '<td>' + (statusMap[r.status] || r.status) + '</td>';
          html += '<td><div class="table__actions">';
          if (r.status === 'pending') {
            html += '<button class="btn btn--success btn--xs btn-approve-reg" data-id="' + r.id + '"><i class="fas fa-check"></i> 通过</button>';
            html += '<button class="btn btn--warning btn--xs btn-reject-reg" data-id="' + r.id + '"><i class="fas fa-times"></i> 驳回</button>';
          }
          html += '</div></td></tr>';
        });
        html += '</tbody></table>';
      } else {
        html = this._emptyState('fas fa-clipboard-list', '暂无报名记录');
      }

      container.querySelector('#reg-table-container').innerHTML = html;
      const pagInfo = this._paginate({ page: this._regPage, total, limit: this._regLimit, callback: (p) => { this._regPage = p; this._loadRegistrations(container); } });
      container.querySelector('#reg-pagination').innerHTML = this._renderPagination(pagInfo, 'reg-pagination');

      // 全选
      const selectAll = container.querySelector('#reg-select-all');
      if (selectAll) {
        selectAll.addEventListener('change', () => {
          container.querySelectorAll('.reg-checkbox').forEach(cb => { if (cb.dataset.status === 'pending') cb.checked = selectAll.checked; });
        });
      }

      container.querySelectorAll('.btn-approve-reg').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await API.admin.approveRegistration(btn.dataset.id);
            App.showToast('已通过', 'success');
            this._loadRegistrations(container);
          } catch (e) { App.showToast(e.message, 'error'); }
        });
      });
      container.querySelectorAll('.btn-reject-reg').forEach(btn => {
        btn.addEventListener('click', () => this._showRejectReason(btn.dataset.id, container));
      });
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  _showRejectReason(id, container) {
    let html = '<div class="modal__header"><h3 class="modal__title">驳回报名</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body"><div class="form"><div class="form__group"><label class="form__label">驳回原因</label><textarea class="form__textarea" id="reject-reason" rows="3" placeholder="请输入驳回原因..."></textarea></div></div></div>';
    html += '<div class="modal__footer"><button class="btn btn--outline" onclick="App.hideModal()">取消</button><button class="btn btn--warning" id="btn-confirm-reject">确认驳回</button></div>';
    App.showModal(html);
    document.getElementById('btn-confirm-reject').addEventListener('click', async () => {
      const reason = document.getElementById('reject-reason').value.trim();
      try {
        App.showLoading();
        await API.put('/admin/registrations/' + id + '/reject', { reason });
        App.hideLoading();
        App.hideModal();
        App.showToast('已驳回', 'success');
        this._loadRegistrations(container);
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      }
    });
  },

  async _batchApprove(container) {
    const ids = [];
    container.querySelectorAll('.reg-checkbox:checked').forEach(cb => { if (cb.dataset.status === 'pending') ids.push(parseInt(cb.dataset.id)); });
    if (ids.length === 0) { App.showToast('请勾选待审核的记录', 'warning'); return; }
    try {
      App.showLoading();
      await API.put('/admin/registrations/batch-approve', { ids });
      App.hideLoading();
      App.showToast('已批量通过 ' + ids.length + ' 条报名', 'success');
      this._loadRegistrations(container);
    } catch (e) {
      App.hideLoading();
      App.showToast(e.message, 'error');
    }
  },

  async _loadRegStats(container) {
    try {
      const heatRes = await API.get('/admin/registrations/heatmap');
      const heatData = heatRes.data || [];
      if (heatData.length > 0 && container.querySelector('#chart-reg-heat')) {
        const chart = new Chart(container.querySelector('#chart-reg-heat'), {
          type: 'pie',
          data: { labels: heatData.map(h => h.name), datasets: [{ data: heatData.map(h => h.approved_count || h.total_count || 0), backgroundColor: ['#1a73e8','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1'] }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
        this._chartInstances.push(chart);
      }

      const statsRes = await API.get('/admin/registrations/stats');
      const sData = statsRes.data || {};
      const eventStats = sData.eventStats || [];
      const unregistered = sData.unregistered || [];

      let tableHtml = '<table class="table table--striped"><thead><tr><th>项目</th><th>分类</th><th>性别组别</th><th>报名人数</th></tr></thead><tbody>';
      if (eventStats.length > 0) {
        eventStats.forEach(e => { tableHtml += '<tr><td>' + e.name + '</td><td>' + e.category + '</td><td>' + e.gender_group + '</td><td>' + e.count + '</td></tr>'; });
      } else {
        tableHtml += '<tr><td colspan="4">' + this._emptyState('fas fa-chart-bar', '暂无统计数据') + '</td></tr>';
      }
      tableHtml += '</tbody></table>';
      container.querySelector('#reg-stats-table').innerHTML = tableHtml;

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

  _renderResultsFilter(container) {
    const bar = container.querySelector('#results-filter-bar');
    bar.innerHTML = `
      <select id="results-grade" class="form__select"><option value="">全部年级</option></select>
      <select id="results-class" class="form__select"><option value="">全部班级</option></select>
      <select id="results-award" class="form__select"><option value="">全部奖项</option><option value="一等">一等</option><option value="二等">二等</option><option value="三等">三等</option></select>
      <select id="results-published" class="form__select"><option value="">公示状态</option><option value="1">已公示</option><option value="0">未公示</option></select>
      <button class="btn btn--primary btn--sm" id="btn-results-search"><i class="fas fa-search"></i> 筛选</button>
    `;
  },

  _bindResultsEvents(container) {
    container.querySelector('#btn-results-search').addEventListener('click', () => { this._resultsPage = 1; this._loadResults(container); });
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
      const params = { page: this._resultsPage, limit: this._resultsLimit };
      const grade = container.querySelector('#results-grade').value;
      const className = container.querySelector('#results-class').value;
      const award = container.querySelector('#results-award').value;
      const published = container.querySelector('#results-published').value;
      if (grade) params.grade = grade;
      if (className) params.class_name = className;
      if (award) params.award = award;
      if (published !== '') params.is_published = published;

      const res = await API.get('/admin/results' + API._qs(params));
      const d = res.data || res;
      const list = d.list || [];
      const total = d.total || 0;
      App.hideLoading();

      let html = '';
      if (list.length > 0) {
        html = '<table class="table table--striped"><thead><tr><th><input type="checkbox" id="results-select-all"></th><th>学号</th><th>姓名</th><th>班级</th><th>项目</th><th>轮次</th><th>成绩</th><th>排名</th><th>奖项</th><th>公示</th><th>操作</th></tr></thead><tbody>';
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

  async _showResultModal(result, container) {
    const isEdit = !!result;
    let schedOpts = '';
    try {
      const schedRes = await API.get('/admin/schedules');
      const schedules = schedRes.data || [];
      schedules.forEach(s => {
        const sel = isEdit && result.schedule_id === s.id ? ' selected' : '';
        schedOpts += '<option value="' + s.id + '"' + sel + '>' + s.event_name + ' - ' + s.round_name + ' (' + (s.start_time || '') + ')</option>';
      });
    } catch (e) {}

    const title = isEdit ? '编辑成绩' : '录入成绩';
    let html = '<div class="modal__header"><h3 class="modal__title">' + title + '</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body"><div class="form">';
    html += '<div class="form__group"><label class="form__label form__label--required">赛程</label><select class="form__select" id="result-schedule">' + schedOpts + '</select></div>';
    html += '<div class="form__group"><label class="form__label form__label--required">用户ID</label><input class="form__input" id="result-user-id" type="number" value="' + (isEdit ? (result.user_id || '') : '') + '"></div>';
    html += '<div class="form__group"><label class="form__label">成绩</label><input class="form__input" id="result-performance" placeholder="如: 12.34" value="' + (isEdit ? (result.performance || '') : '') + '"></div>';
    html += '<div class="form__group"><label class="form__label">奖项</label><select class="form__select" id="result-award"><option value="">无</option><option value="一等"' + (isEdit && result.award === '一等' ? ' selected' : '') + '>一等</option><option value="二等"' + (isEdit && result.award === '二等' ? ' selected' : '') + '>二等</option><option value="三等"' + (isEdit && result.award === '三等' ? ' selected' : '') + '>三等</option></select></div>';
    html += '</div></div>';
    html += '<div class="modal__footer"><button class="btn btn--outline" onclick="App.hideModal()">取消</button><button class="btn btn--primary" id="btn-save-result" data-id="' + (isEdit ? result.id : '') + '">保存</button></div>';
    App.showModal(html);

    document.getElementById('btn-save-result').addEventListener('click', async () => {
      const id = document.getElementById('btn-save-result').dataset.id;
      const data = {
        schedule_id: parseInt(document.getElementById('result-schedule').value),
        user_id: parseInt(document.getElementById('result-user-id').value),
        performance: document.getElementById('result-performance').value.trim(),
        award: document.getElementById('result-award').value
      };
      if (!data.schedule_id || !data.user_id) { App.showToast('赛程和用户ID必填', 'warning'); return; }
      try {
        App.showLoading();
        if (isEdit) {
          await API.admin.updateResult(id, data);
          App.showToast('成绩已更新', 'success');
        } else {
          await API.admin.submitResult(data);
          App.showToast('成绩已录入', 'success');
        }
        App.hideModal();
        App.hideLoading();
        this._loadResults(container);
      } catch (e) { App.hideLoading(); App.showToast(e.message, 'error'); }
    });
  },

  _showResultsImport(container) {
    let html = '<div class="modal__header"><h3 class="modal__title">批量导入成绩</h3><button class="modal__close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>';
    html += '<div class="modal__body"><button type="button" class="btn btn-outline btn-sm mb-2" onclick="Admin._downloadTemplate(\'results\')"><i class="fas fa-download"></i> 下载Excel模板</button><div class="form"><div class="form__group"><label class="form__label">选择 Excel 文件</label><input type="file" id="results-import-file" class="form__input" accept=".xlsx,.xls,.csv"></div>';
    html += '<div class="form__hint">表格需包含列：赛程ID(schedule_id)、用户ID(user_id)、成绩(performance)、奖项(award)</div></div></div>';
    html += '<div class="modal__footer"><button class="btn btn--outline" onclick="App.hideModal()">取消</button><button class="btn btn--primary" id="btn-do-import-results">开始导入</button></div>';
    App.showModal(html);

    document.getElementById('btn-do-import-results').addEventListener('click', async () => {
      const fileInput = document.getElementById('results-import-file');
      if (!fileInput.files || !fileInput.files[0]) { App.showToast('请选择文件', 'warning'); return; }
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
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
      html += '<div class="card__body"><div class="table-container"><table class="table table--striped"><thead><tr><th>年级</th><th>总人数</th><th>报名人数</th><th>获奖人数</th><th>一等奖</th><th>二等奖</th><th>三等奖</th><th>总分</th></tr></thead><tbody>';
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
          site_maintenance: document.getElementById('set-maintenance').checked
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
      const data = res.data || [];
      let gh = '<table class="table"><thead><tr><th>名称</th><th>排序</th><th>操作</th></tr></thead><tbody>';
      let ch = '';
      data.forEach(g => {
        gh += `<tr><td>${g.name}</td><td>${g.sort_order||0}</td><td><button class="btn btn-danger btn-xs" onclick="Admin._deleteGrade(${g.id})">删除</button></td></tr>`;
        if (g.classes) {
          g.classes.forEach(c => {
            ch += `<tr><td>${c.name} (${g.name})</td><td>${c.sort_order||0}</td><td><button class="btn btn-danger btn-xs" onclick="Admin._deleteClass(${c.id})">删除</button></td></tr>`;
          });
        }
      });
      gh += '</tbody></table>';
      ch = ch ? '<table class="table"><thead><tr><th>名称</th><th>排序</th><th>操作</th></tr></thead><tbody>' + ch + '</tbody></table>' : '<p class="text-muted">暂无班级</p>';
      document.getElementById('grade-list').innerHTML = gh;
      document.getElementById('class-list').innerHTML = ch;
    } catch(e) { App.showToast(e.message,'error'); }
  },
  async _addGrade() {
    const name = prompt('请输入年级名称（如：初一、高一）:');
    if (!name) return;
    try { App.showLoading(); await API.post('/admin/grades',{name});this._loadGradesClasses();App.showToast('添加成功','success'); } catch(e) { App.showToast(e.message,'error'); } finally { App.hideLoading(); }
  },
  async _deleteGrade(id) {
    if (!await App.confirmDialog('确认删除？')) return;
    try { App.showLoading(); await API.delete('/admin/grades/'+id);this._loadGradesClasses();App.showToast('已删除','success'); } catch(e) { App.showToast(e.message,'error'); } finally { App.hideLoading(); }
  },
  async _addClass() {
    try { App.showLoading(); const gRes = await API.get('/admin/grades'); App.hideLoading();
      const grades = gRes.data||[]; if(!grades.length) return App.showToast('请先添加年级','warning');
      const gid = prompt('请选择年级:\n'+grades.map((g,i)=>`${i+1}. ${g.name}`).join('\n')+'\n输入序号:');
      const grade = grades[parseInt(gid)-1]; if(!grade) return;
      const cname = prompt('请输入班级名称（如：1班）:');
      if(!cname) return;
      App.showLoading(); await API.post('/admin/classes',{grade_id:grade.id,name:cname});this._loadGradesClasses();App.showToast('添加成功','success');
    } catch(e) { App.showToast(e.message,'error'); } finally { App.hideLoading(); }
  },
  async _deleteClass(id) {
    if (!await App.confirmDialog('确认删除？')) return;
    try { App.showLoading(); await API.delete('/admin/classes/'+id);this._loadGradesClasses();App.showToast('已删除','success'); } catch(e) { App.showToast(e.message,'error'); } finally { App.hideLoading(); }
  },

  // ==================== 模板下载 ====================
  _downloadTemplate(type) {
    if (typeof XLSX === 'undefined') return App.showToast('请检查网络连接（XLSX库未加载）','error');
    let headers, filename;
    if (type === 'users') {
      headers = ['学号', '姓名', '班级', '年级'];
      filename = '学生导入模板.xlsx';
    } else if (type === 'results') {
      headers = ['赛程ID', '学号', '成绩', '奖项'];
      filename = '成绩导入模板.xlsx';
    } else return;
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename);
    App.showToast('模板已下载', 'success');
  },
};
