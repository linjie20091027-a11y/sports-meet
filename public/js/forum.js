const Forum = {
  _lightboxEl: null,

  openImage(url) {
    if (!this._lightboxEl) {
      const el = document.createElement('div');
      el.className = 'forum-lightbox';
      el.innerHTML = '<div class="forum-lightbox__backdrop"></div><img class="forum-lightbox__img" src="" alt=""><button type="button" class="forum-lightbox__close">&times;</button>';
      document.body.appendChild(el);
      this._lightboxEl = el;
      el.querySelector('.forum-lightbox__backdrop').addEventListener('click', () => this.closeImage());
      el.querySelector('.forum-lightbox__close').addEventListener('click', () => this.closeImage());
      el.addEventListener('click', (e) => { if (e.target === el) this.closeImage(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeImage(); });
    }
    this._lightboxEl.querySelector('.forum-lightbox__img').src = url;
    this._lightboxEl.classList.add('forum-lightbox--visible');
  },

  closeImage() {
    if (this._lightboxEl) {
      this._lightboxEl.classList.remove('forum-lightbox--visible');
    }
  },
  _meta: null,
  _filters: { keyword: '', category: '', tag: '', mine: false },
  _page: 1,
  _composerAttachments: [],

  handleRoute(hash) {
    const page = document.getElementById('page-forum');
    if (!page) return;
    if (hash === '/forum' || hash === '/forum/') {
      this.renderList();
    } else if (hash.startsWith('/forum/')) {
      this.renderPost(hash.split('/')[2]);
    }
  },

  async renderList() {
    const page = document.getElementById('page-forum');
    const user = App.user;
    page.innerHTML = `
      <div class="container page-top">
        <div class="card forum-shell">
          <div class="card-header forum-shell__head">
            <div>
              <div class="section-title" style="margin-bottom:0;">交流论坛<small>置顶公告 · 精华推荐 · 全站讨论</small></div>
              <p class="text-sm text-muted" style="margin-top:8px;">支持富文本发帖、附件上传、分类标签、搜索筛选与分页浏览。</p>
            </div>
            <div class="forum-shell__actions">
              ${user ? `<button type="button" class="btn btn-primary btn-sm" id="forum-new-btn"><i class="fas fa-pen"></i> 发布帖子</button>` : `<a href="#/login" class="btn btn-outline btn-sm">登录后发帖</a>`}
            </div>
          </div>
          <div class="card-body">
            <div class="forum-toolbar">
              <input id="forum-keyword" class="form__input" placeholder="搜索标题、摘要或正文关键词">
              <select id="forum-category" class="form__select"><option value="">全部分类</option></select>
              <select id="forum-tag" class="form__select"><option value="">全部标签</option></select>
              ${user ? `<label class="text-sm" style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="forum-mine-only"> 仅看我的帖子</label>` : ''}
              <button type="button" class="btn btn-primary btn-sm" id="forum-search-btn"><i class="fas fa-search"></i> 查询</button>
            </div>
            <div id="forum-pinned" class="forum-highlight"></div>
            <div id="forum-featured" class="forum-highlight"></div>
            <div id="forum-list"><div class="text-center p-8"><div class="spinner"></div></div></div>
            <div id="forum-pagination" class="text-center mt-3"></div>
          </div>
        </div>
      </div>
    `;
    await this._ensureMeta();
    this._renderFilterOptions();
    document.getElementById('forum-new-btn')?.addEventListener('click', () => this._showNewPostForm());
    document.getElementById('forum-search-btn')?.addEventListener('click', () => {
      this._filters.keyword = document.getElementById('forum-keyword')?.value?.trim() || '';
      this._filters.category = document.getElementById('forum-category')?.value || '';
      this._filters.tag = document.getElementById('forum-tag')?.value || '';
      this._filters.mine = !!document.getElementById('forum-mine-only')?.checked;
      this._loadList(1);
    });
    await this._loadList(1);
  },

  async _ensureMeta() {
    if (this._meta) return this._meta;
    const res = await API.forum.getMeta();
    this._meta = res.data || { categories: [], tags: [], report_reasons: [] };
    return this._meta;
  },

  _renderFilterOptions() {
    const meta = this._meta || {};
    const category = document.getElementById('forum-category');
    const tag = document.getElementById('forum-tag');
    if (category) {
      category.innerHTML = '<option value="">全部分类</option>' + (meta.categories || []).map((item) =>
        `<option value="${App._escHtml(item.value)}">${App._escHtml(item.label)}</option>`
      ).join('');
      category.value = this._filters.category || '';
    }
    if (tag) {
      tag.innerHTML = '<option value="">全部标签</option>' + (meta.tags || []).map((item) =>
        `<option value="${App._escHtml(item)}">${App._escHtml(item)}</option>`
      ).join('');
      tag.value = this._filters.tag || '';
    }
    if (document.getElementById('forum-keyword')) document.getElementById('forum-keyword').value = this._filters.keyword || '';
    if (document.getElementById('forum-mine-only')) document.getElementById('forum-mine-only').checked = !!this._filters.mine;
  },

  _renderHighlightSection(targetId, title, badge, items) {
    const wrap = document.getElementById(targetId);
    if (!wrap) return;
    if (!items || !items.length) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = `
      <div class="forum-highlight__title">${title}</div>
      <div class="forum-highlight__list">
        ${items.map((item) => `
          <a href="#/forum/${item.id}" class="forum-highlight__item">
            <span class="badge badge-pin">${badge}</span>
            <strong>${App._escHtml(item.title)}</strong>
            <small>${App._escHtml(item.author_name || '-')} · ${App.formatDate(item.updated_at || item.created_at)}</small>
          </a>
        `).join('')}
      </div>
    `;
  },

  _renderPostCard(post) {
    const tags = Array.isArray(post.tags) ? post.tags : [];
    const summary = post.summary || String(post.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    return `
      <article class="forum-card card mb-2">
        <a href="#/forum/${post.id}" class="forum-card__link">
          <div class="forum-card__badges">
            ${post.is_pinned ? '<span class="badge badge-pin">置顶</span>' : ''}
            ${post.is_featured ? '<span class="badge badge-success">精华</span>' : ''}
            ${post.status && post.status !== 'approved' ? `<span class="badge badge-warning">${post.status === 'pending' ? '审核中' : '未通过'}</span>` : ''}
            ${post.category ? `<span class="badge badge-info">${App._escHtml(post.category)}</span>` : ''}
          </div>
          <h3>${App._escHtml(post.title)}</h3>
          <p class="forum-card__excerpt">${App._escHtml(summary)}</p>
          <div class="forum-card__tags">
            ${tags.map((tag) => `<span>${App._escHtml(tag)}</span>`).join('')}
          </div>
          <div class="forum-card__meta">
            <span><i class="fas fa-user"></i> ${App._escHtml(post.author_name || '-')} ${post.class_name ? `· ${App._escHtml(post.class_name)}` : ''}</span>
            <span><i class="fas fa-comment"></i> ${post.reply_count || 0}</span>
            <span><i class="fas fa-heart"></i> ${post.like_count || 0}</span>
            <span><i class="fas fa-star"></i> ${post.favorite_count || 0}</span>
            <span>${App.formatDate(post.updated_at || post.created_at)}</span>
          </div>
        </a>
      </article>
    `;
  },

  async _loadList(page) {
    const list = document.getElementById('forum-list');
    try {
      this._page = page;
      const res = await API.forum.getPosts({
        page,
        limit: 10,
        keyword: this._filters.keyword || '',
        category: this._filters.category || '',
        tag: this._filters.tag || '',
        mine: this._filters.mine ? 1 : ''
      });
      const data = res.data || {};
      const posts = data.list || [];
      this._renderHighlightSection('forum-pinned', '置顶帖', '置顶', data.pinned || []);
      this._renderHighlightSection('forum-featured', '精华推荐', '精华', data.featured || []);
      if (!posts.length) {
        list.innerHTML = '<div class="empty-state"><p>当前筛选下暂无帖子，试试调整关键词或分类</p></div>';
        return;
      }
      list.innerHTML = posts.map((item) => this._renderPostCard(item)).join('');

      const total = data.total || 0;
      const pages = Math.ceil(total / (data.limit || 10));
      const pag = document.getElementById('forum-pagination');
      if (pag && pages > 1) {
        pag.innerHTML = `<button class="btn btn-outline btn-sm" ${page <= 1 ? 'disabled' : ''} id="forum-prev">上一页</button>
          <span class="text-sm text-muted mx-2">第 ${page} / ${pages} 页</span>
          <button class="btn btn-outline btn-sm" ${page >= pages ? 'disabled' : ''} id="forum-next">下一页</button>`;
        document.getElementById('forum-prev')?.addEventListener('click', () => this._loadList(page - 1));
        document.getElementById('forum-next')?.addEventListener('click', () => this._loadList(page + 1));
      }
    } catch (e) {
      list.innerHTML = `<div class="empty-state"><p>加载失败：${App._escHtml(e.message)}</p></div>`;
    }
  },

  async renderPost(id) {
    const page = document.getElementById('page-forum');
    page.innerHTML = `<div class="container page-top" id="forum-post-root"><div class="text-center p-8"><div class="spinner"></div></div></div>`;
    const root = document.getElementById('forum-post-root');

    try {
      const res = await API.forum.getPost(id);
      if (!res.success || !res.data?.post) {
        root.innerHTML = '<div class="empty-state"><p>帖子不存在</p><a href="#/forum" class="btn btn-outline mt-2">返回论坛</a></div>';
        return;
      }
      const { post, replies } = res.data;
      const isAdmin = App.user?.role === 'admin';
      const canDelete = isAdmin || Number(post.user_id) === Number(App.user?.id);
      const attachments = Array.isArray(post.attachments) ? post.attachments : [];
      const tags = Array.isArray(post.tags) ? post.tags : [];
      let images = [];
      try { images = JSON.parse(post.images || '[]'); } catch(e) {}

      root.innerHTML = `
        <nav class="breadcrumb"><a href="#/forum">论坛</a> <span>/</span> <span>帖子详情</span></nav>
        <article class="card forum-post-detail">
          <div class="card-header">
            <div>
              <div class="forum-card__badges">
                ${post.is_pinned ? '<span class="badge badge-pin">置顶</span>' : ''}
                ${post.is_featured ? '<span class="badge badge-success">精华</span>' : ''}
                ${post.status && post.status !== 'approved' ? `<span class="badge badge-warning">${post.status === 'pending' ? '审核中' : '未通过'}</span>` : ''}
              </div>
              <h2 style="margin:8px 0 0;font-size:1.25rem">${App._escHtml(post.title)}</h2>
            </div>
            <div class="forum-post-detail__actions">
              ${canDelete ? `<button type="button" class="btn btn-danger btn-xs" id="forum-del-post">删除帖子</button>` : ''}
              ${App.user ? `<button type="button" class="btn btn-outline btn-xs" id="forum-report-post"><i class="fas fa-flag"></i> 举报</button>` : ''}
            </div>
          </div>
          <div class="card-body">
            <p class="forum-card__meta mb-2">
              <span>${App._escHtml(post.author_name || '-')} ${post.class_name ? `· ${App._escHtml(post.class_name)}` : ''}</span>
              <span>${App.formatDate(post.created_at)}</span>
              <span>${post.view_count || 0} 浏览</span>
              <span>${post.reply_count || 0} 评论</span>
            </p>
            <div class="forum-card__tags">${tags.map((tag) => `<span>${App._escHtml(tag)}</span>`).join('')}</div>
            <div class="detail-prose">${post.content || ''}</div>
            ${images.length ? `<div class="forum-images"><div class="forum-images__grid">${images.map((img, i) => `<div class="forum-image-wrap"><img src="${App._escAttr(img)}" alt="帖子图片" loading="lazy" data-lightbox="${App._escAttr(img)}">${isAdmin ? `<button type="button" class="btn btn-danger btn-xs forum-del-img-btn" data-file="${App._escAttr(img.split('/').pop())}"><i class="fas fa-trash"></i></button>` : ''}</div>`).join('')}</div>${isAdmin ? (post.image_status === 'pending' ? `<div class="forum-image-admin mt-2"><button type="button" class="btn btn-success btn-xs" id="forum-approve-images">通过图片审核</button> <button type="button" class="btn btn-danger btn-xs" id="forum-reject-images">驳回图片</button></div>` : post.image_status === 'rejected' ? `<span class="badge badge-danger mt-2">图片已驳回</span>` : '') : (post.image_status === 'pending' ? `<span class="badge badge-warning mt-2">图片待审核</span>` : '')}</div>` : ''}
            ${attachments.length ? `<div class="forum-attachments">${attachments.map((item) => `<a href="${App._escAttr(item.url)}" target="_blank" rel="noopener" class="forum-attachment"><i class="fas fa-paperclip"></i> ${App._escHtml(item.name || '附件')}</a>`).join('')}</div>` : ''}
            ${App.user ? `<div class="forum-interactions">
              <button type="button" class="btn btn-outline btn-sm" id="forum-like-btn"><i class="fas fa-heart"></i> ${post.liked ? '已点赞' : '点赞'} (${post.like_count || 0})</button>
              <button type="button" class="btn btn-outline btn-sm" id="forum-favorite-btn"><i class="fas fa-star"></i> ${post.favorited ? '已收藏' : '收藏'} (${post.favorite_count || 0})</button>
            </div>` : ''}
          </div>
        </article>
        <h3 class="mt-4 mb-2" style="font-size:1rem">评论 (${replies.length})</h3>
        <div id="forum-replies">${replies.length ? replies.map(r => `
          <div class="forum-reply card mb-2">
            <div class="card-body">
              <div class="forum-card__meta mb-1">
                <strong>${App._escHtml(r.author_name)}</strong>
                <span>${App.formatDate(r.created_at)}</span>
                ${r.status && r.status !== 'approved' ? `<span class="badge badge-warning">${r.status === 'pending' ? '待审核' : '已驳回'}</span>` : ''}
                ${(isAdmin || Number(r.user_id) === Number(App.user?.id)) ? `<button type="button" class="btn btn-danger btn-xs forum-del-reply" data-id="${r.id}">删除</button>` : ''}
              </div>
              <p style="margin:0;line-height:1.7">${App._escHtml(r.content).replace(/\n/g, '<br>')}</p>
            </div>
          </div>
        `).join('') : '<p class="text-muted">暂无回复</p>'}</div>
        ${App.user ? `
          <div class="card mt-3" style="max-height:180px;overflow-y:auto">
            <div class="card-body" style="padding:.6rem 1rem">
              <div class="form-group" style="margin-bottom:.3rem"><label style="font-size:.7rem">发表评论</label><textarea id="forum-reply-text" class="form-input" rows="2" placeholder="输入评论内容，支持文明交流" style="overflow-y:auto;resize:none"></textarea></div>
              <button type="button" class="btn btn-primary btn-sm" id="forum-reply-submit" style="padding:.25rem .6rem;font-size:.7rem">提交评论</button>
            </div>
          </div>
        ` : '<p class="text-muted mt-3"><a href="#/login">登录</a> 後可回复</p>'}
        <p class="mt-3"><a href="#/forum" class="btn btn-outline btn-sm"><i class="fas fa-arrow-left"></i> 返回论坛</a></p>
      `;

      document.getElementById('forum-del-post')?.addEventListener('click', async () => {
        if (!await App.confirmDialog('确认删除此帖子？')) return;
        const r = await API.forum.deletePost(id);
        if (r.success) { App.showToast('已删除', 'success'); window.location.hash = '#/forum'; }
        else App.showToast(r.error || '删除失败', 'error');
      });
      root.querySelectorAll('.forum-del-reply').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!await App.confirmDialog('确认删除此回复？')) return;
          const r = await API.forum.deleteReply(btn.dataset.id);
          if (r.success) { App.showToast('已删除', 'success'); this.renderPost(id); }
          else App.showToast(r.error || '删除失败', 'error');
        });
      });
      document.getElementById('forum-reply-submit')?.addEventListener('click', async () => {
        const content = document.getElementById('forum-reply-text')?.value?.trim();
        if (!content) return App.showToast('请输入评论内容', 'warning');
        const r = await API.forum.reply(id, content);
        if (r.success) { App.showToast(r.message || '评论已提交', 'success'); this.renderPost(id); }
        else App.showToast(r.error || '评论失败', 'error');
      });
      document.getElementById('forum-like-btn')?.addEventListener('click', async () => {
        const r = await API.forum.likePost(id);
        if (r.success) this.renderPost(id);
        else App.showToast(r.error || '操作失败', 'error');
      });
      document.getElementById('forum-favorite-btn')?.addEventListener('click', async () => {
        const r = await API.forum.favoritePost(id);
        if (r.success) this.renderPost(id);
        else App.showToast(r.error || '操作失败', 'error');
      });
      document.getElementById('forum-report-post')?.addEventListener('click', () => this._showReportModal(id));
      root.querySelectorAll('.forum-del-img-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!await App.confirmDialog('确认删除此图片？')) return;
          const filename = btn.dataset.file;
          const r = await API.forum.deleteImage(id, filename);
          if (r.success) { App.showToast('图片已删除', 'success'); this.renderPost(id); }
          else App.showToast(r.error || '删除失败', 'error');
        });
      });
      // 图片点击全屏灯箱（事件委托）
      root.querySelectorAll('img[data-lightbox]').forEach(img => {
        img.addEventListener('click', () => Forum.openImage(img.dataset.lightbox));
      });
      document.getElementById('forum-approve-images')?.addEventListener('click', async () => {
        const r = await API.forum.approveImages(id);
        if (r.success) { App.showToast('图片已通过审核', 'success'); this.renderPost(id); }
        else App.showToast(r.error || '操作失败', 'error');
      });
      document.getElementById('forum-reject-images')?.addEventListener('click', async () => {
        const r = await API.forum.rejectImages(id);
        if (r.success) { App.showToast('图片已驳回', 'success'); this.renderPost(id); }
        else App.showToast(r.error || '操作失败', 'error');
      });
    } catch (e) {
      root.innerHTML = `<div class="empty-state"><p>${App._escHtml(e.message)}</p></div>`;
    }
  },

  async _showNewPostForm() {
    if (!App.user) { window.location.hash = '#/login'; return; }
    await this._ensureMeta();
    this._composerAttachments = [];
    this._composerImages = [];
    App.showModal(`
      <div class="modal-header"><h3>发表帖子</h3><button type="button" class="modal-close" onclick="App.hideModal()">&times;</button></div>
      <div class="modal-body">
        <div class="form-group"><label>标题</label><input type="text" id="forum-post-title" class="form-input" maxlength="120" placeholder="请输入帖子标题"></div>
        <div class="form-row">
          <div class="form-group"><label>分类</label><select id="forum-post-category" class="form__select">${(this._meta.categories || []).map((item) => `<option value="${App._escHtml(item.value)}">${App._escHtml(item.label)}</option>`).join('')}</select></div>
          <div class="form-group"><label>附件上传</label><input type="file" id="forum-post-files" class="form-input" multiple></div>
        </div>
        <div class="form-group">
          <label>标签</label>
          <div class="forum-tag-picker">${(this._meta.tags || []).map((tag) => `<label><input type="checkbox" value="${App._escHtml(tag)}"> ${App._escHtml(tag)}</label>`).join('')}</div>
        </div>
        <div class="form-group"><label>图片上传（最多5张，JPG/PNG/GIF/WebP）</label><input type="file" id="forum-post-images" class="form-input" multiple accept="image/*"></div>
        <div id="forum-post-image-preview" class="forum-image-preview"></div>
        <div class="form-group">
          <label>正文</label>
          <div class="forum-editor__toolbar">
            <button type="button" class="btn btn-outline btn-xs forum-editor-cmd" data-cmd="bold">加粗</button>
            <button type="button" class="btn btn-outline btn-xs forum-editor-cmd" data-cmd="italic">斜体</button>
            <button type="button" class="btn btn-outline btn-xs forum-editor-cmd" data-cmd="insertUnorderedList">列表</button>
            <button type="button" class="btn btn-outline btn-xs" id="forum-editor-link">链接</button>
          </div>
          <div id="forum-post-content" class="forum-editor__input" contenteditable="true"></div>
          <div class="form__hint">支持基础富文本格式，内容将自动过滤不安全标签。</div>
        </div>
        <div id="forum-uploaded-files" class="forum-upload-list"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="App.hideModal()">取消</button>
        <button type="button" class="btn btn-primary" id="forum-post-submit">发布</button>
      </div>
    `);
    document.querySelectorAll('.forum-editor-cmd').forEach((btn) => {
      btn.addEventListener('click', () => document.execCommand(btn.dataset.cmd, false));
    });
    document.getElementById('forum-editor-link')?.addEventListener('click', () => {
      const url = window.prompt('请输入链接地址');
      if (url) document.execCommand('createLink', false, url);
    });
    document.getElementById('forum-post-files')?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const res = await API.forum.uploadAttachments(formData);
      if (res.success) {
        this._composerAttachments = (this._composerAttachments || []).concat(res.data || []).slice(0, 4);
        this._renderComposerAttachments();
        App.showToast('附件上传成功', 'success');
      } else {
        App.showToast(res.error || '附件上传失败', 'error');
      }
      e.target.value = '';
    });
    document.getElementById('forum-post-images')?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []).slice(0, 5);
      this._composerImages = files;
      this._renderComposerImages();
    });
    document.getElementById('forum-post-submit').addEventListener('click', async () => {
      const title = document.getElementById('forum-post-title')?.value?.trim();
      const contentEl = document.getElementById('forum-post-content');
      const contentHtml = contentEl?.innerHTML?.trim();
      const contentText = contentEl?.innerText?.trim();
      const category = document.getElementById('forum-post-category')?.value || 'general';
      const tags = Array.from(document.querySelectorAll('.forum-tag-picker input:checked')).map((item) => item.value);
      const hasImages = this._composerImages && this._composerImages.length > 0;
      const hasAttachments = this._composerAttachments && this._composerAttachments.length > 0;
      if (!title && !contentText && !hasImages && !hasAttachments) return App.showToast('请至少填写标题、内容或上传文件', 'warning');
      let r;
      if (hasImages) {
        const fd = new FormData();
        fd.append('title', title);
        fd.append('content', contentHtml);
        fd.append('category', category);
        fd.append('tags', JSON.stringify(tags));
        fd.append('attachments', JSON.stringify(this._composerAttachments || []));
        for (const f of this._composerImages) fd.append('images', f);
        r = await API.forum.createPost(fd);
      } else {
        r = await API.forum.createPost({ title, content: contentHtml, category, tags, attachments: this._composerAttachments });
      }
      if (r.success) {
        App.hideModal();
        App.showToast(r.message || '发布成功', 'success');
        window.location.hash = `#/forum/${r.data?.id || ''}`;
        if (r.data?.id) this.renderPost(r.data.id);
        else this.renderList();
      } else App.showToast(r.error || '发布失败', 'error');
    });
  },

  _renderComposerAttachments() {
    const wrap = document.getElementById('forum-uploaded-files');
    if (!wrap) return;
    if (!this._composerAttachments.length) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = this._composerAttachments.map((item, index) => `
      <div class="forum-upload-item">
        <span><i class="fas fa-paperclip"></i> ${App._escHtml(item.name || '附件')}</span>
        <button type="button" class="btn btn-danger btn-xs forum-remove-upload" data-index="${index}">移除</button>
      </div>
    `).join('');
    wrap.querySelectorAll('.forum-remove-upload').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._composerAttachments.splice(Number(btn.dataset.index), 1);
        this._renderComposerAttachments();
      });
    });
  },

  _renderComposerImages() {
    const wrap = document.getElementById('forum-post-image-preview');
    if (!wrap) return;
    if (!this._composerImages || !this._composerImages.length) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = this._composerImages.map((file, index) => `
      <div class="forum-image-preview-item">
        <img src="${URL.createObjectURL(file)}" alt="预览" style="max-width:100px;max-height:100px;object-fit:cover;">
        <button type="button" class="btn btn-danger btn-xs forum-remove-image" data-index="${index}">移除</button>
      </div>
    `).join('');
    wrap.querySelectorAll('.forum-remove-image').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._composerImages.splice(Number(btn.dataset.index), 1);
        this._renderComposerImages();
      });
    });
  },

  async _showReportModal(postId) {
    await this._ensureMeta();
    App.showModal(`
      <div class="modal-header"><h3>举报帖子</h3><button type="button" class="modal-close" onclick="App.hideModal()">&times;</button></div>
      <div class="modal-body">
        <div class="form-group"><label>举报原因</label><select id="forum-report-reason" class="form__select">${(this._meta.report_reasons || []).map((item) => `<option value="${App._escHtml(item)}">${App._escHtml(item)}</option>`).join('')}</select></div>
        <div class="form-group"><label>补充说明</label><textarea id="forum-report-detail" class="form-input" rows="4" placeholder="可选，最多 300 字"></textarea></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="App.hideModal()">取消</button>
        <button type="button" class="btn btn-primary" id="forum-report-submit">提交举报</button>
      </div>
    `);
    document.getElementById('forum-report-submit')?.addEventListener('click', async () => {
      const reason = document.getElementById('forum-report-reason')?.value || '';
      const detail = document.getElementById('forum-report-detail')?.value?.trim() || '';
      const res = await API.forum.reportPost(postId, { reason, detail });
      if (res.success) {
        App.hideModal();
        App.showToast(res.message || '举报已提交', 'success');
      } else {
        App.showToast(res.error || '举报失败', 'error');
      }
    });
  },

  // ===== AI 助手 =====
  _initAIChat() {
    if (document.getElementById('ai-chat-panel')) return;
    // 按用户ID隔离历史记录
    var uid = (App.user && App.user.id) ? App.user.id : 'guest';
    var key = 'ai_chat_history_' + uid;
    try { this._chatHistory = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { this._chatHistory = []; }
    this._chatKey = key;
    if (this._chatHistory.length > 40) this._chatHistory = this._chatHistory.slice(-40);
    const html = `
      <div id="ai-chat-bubble" class="ai-chat-bubble" title="AI 助手小濠">
        <i class="fas fa-robot"></i>
        <span class="ai-bubble-dot"></span>
      </div>
      <div id="ai-chat-panel" class="ai-chat-panel hidden">
        <div class="ai-chat-header">
          <span><i class="fas fa-robot"></i> 小濠 AI 助手</span>
          <button class="ai-chat-close" id="ai-chat-close">&times;</button>
        </div>
        <div class="ai-chat-messages" id="ai-chat-messages">
          <div class="ai-msg ai-msg-bot">你好！我是运动会助手「小濠」🏃<br>有什麼可以幫你的嗎？</div>
        </div>
        <div class="ai-chat-input">
          <input type="text" id="ai-chat-input" placeholder="输入問题...">
          <button id="ai-chat-send"><i class="fas fa-paper-plane"></i></button>
        </div>
        ${App.user?.role==='admin'?`<div class="ai-chat-admin"><button class="btn-text" id="ai-key-btn">设定 API Key</button></div>`:''}
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('ai-chat-bubble').addEventListener('click', () => {
      const panel = document.getElementById('ai-chat-panel');
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        document.getElementById('ai-chat-input')?.focus();
        this._restoreChatHistory();
      }
    });
    document.getElementById('ai-chat-close').addEventListener('click', () => {
      document.getElementById('ai-chat-panel').classList.add('hidden');
    });
    document.getElementById('ai-chat-send').addEventListener('click', () => this._sendAIMessage());
    document.getElementById('ai-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._sendAIMessage();
    });
    document.getElementById('ai-key-btn')?.addEventListener('click', () => this._showAIKeyModal());
  },

  _showAIKeyModal() {
    App.showModal(`
      <div class="modal-header"><h3>设定 DeepSeek API Key</h3><button class="modal-close" onclick="App.hideModal()">&times;</button></div>
      <div class="modal-body">
        <p class="text-sm text-muted mb-2">请输入您的 DeepSeek API Key，用於驅动 AI 助手</p>
        <div class="form-group"><label>API Key</label><input type="text" id="ai-key-input" class="form-input" placeholder="sk-..."></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.hideModal()">取消</button>
        <button class="btn btn-primary" id="ai-key-submit">保存</button>
      </div>
    `);
    document.getElementById('ai-key-submit').addEventListener('click', async () => {
      const key = document.getElementById('ai-key-input')?.value?.trim();
      if (!key) return App.showToast('请输入 API Key', 'warning');
      try {
        const r = await API.post('/ai/ai-key', { key });
        if (r.success) { App.showToast('API Key 已保存', 'success'); App.hideModal(); }
        else App.showToast(r.error, 'error');
      } catch(e) { App.showToast(e.message, 'error'); }
    });
  },

  _restoreChatHistory() {
    const msgs = document.getElementById('ai-chat-messages');
    if (!msgs || !this._chatHistory.length) return;
    msgs.innerHTML = this._chatHistory.map(h => 
      `<div class="ai-msg ${h.role==='user'?'ai-msg-user':'ai-msg-bot'}">${App._escHtml(h.content).replace(/\n/g,'<br>')}</div>`
    ).join('');
    msgs.scrollTop = msgs.scrollHeight;
  },

  _saveChatHistory() {
    try { localStorage.setItem(this._chatKey || 'ai_chat_history', JSON.stringify(this._chatHistory.slice(-40))); } catch(e) {}
  },

  async _sendAIMessage() {
    const input = document.getElementById('ai-chat-input');
    const msg = input?.value?.trim();
    if (!msg) return;
    const msgs = document.getElementById('ai-chat-messages');
    msgs.innerHTML += `<div class="ai-msg ai-msg-user">${App._escHtml(msg)}</div>`;
    this._chatHistory.push({ role: 'user', content: msg });
    this._saveChatHistory();
    input.value = '';
    msgs.scrollTop = msgs.scrollHeight;

    const loading = document.createElement('div');
    loading.className = 'ai-msg ai-msg-bot ai-typing';
    loading.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    msgs.appendChild(loading);
    msgs.scrollTop = msgs.scrollHeight;

    try {
      const r = await API.post('/ai/ai-chat', { message: msg, history: this._chatHistory.slice(-16) });
      loading.remove();
      if (r.success) {
        msgs.innerHTML += `<div class="ai-msg ai-msg-bot">${r.data.reply.replace(/\n/g,'<br>')}</div>`;
        this._chatHistory.push({ role: 'assistant', content: r.data.reply });
        this._saveChatHistory();
      } else {
        msgs.innerHTML += `<div class="ai-msg ai-msg-bot" style="color:var(--red)">${r.error}</div>`;
      }
    } catch(e) {
      loading.remove();
      msgs.innerHTML += `<div class="ai-msg ai-msg-bot" style="color:var(--red)">${e.message}</div>`;
    }
    msgs.scrollTop = msgs.scrollHeight;
  },
};
