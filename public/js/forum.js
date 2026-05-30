const Forum = {
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
        <div class="section-title">
          交流论坛
          <small>赛事討論 · 經驗分享</small>
        </div>
        ${user ? `<div class="mb-3"><button type="button" class="btn btn-primary btn-sm" id="forum-new-btn"><i class="fas fa-pen"></i> 發表帖子</button></div>` : `<p class="text-muted mb-3"><a href="#/login">登录</a> 後可發帖與回复</p>`}
        <div id="forum-list"><div class="text-center p-8"><div class="spinner"></div></div></div>
        <div id="forum-pagination" class="text-center mt-3"></div>
      </div>
    `;
    document.getElementById('forum-new-btn')?.addEventListener('click', () => this._showNewPostForm());
    await this._loadList(1);
  },

  async _loadList(page) {
    const list = document.getElementById('forum-list');
    try {
      const res = await API.forum.getPosts({ page, limit: 15 });
      const data = res.data || {};
      const posts = data.list || [];
      if (!posts.length) {
        list.innerHTML = '<div class="empty-state"><p>暂无帖子，成為第一個發言的人吧</p></div>';
        return;
      }
      list.innerHTML = posts.map(p => `
        <article class="forum-card card mb-2">
          <a href="#/forum/${p.id}" class="forum-card__link">
            <h3>${App._escHtml(p.title)}</h3>
            <p class="forum-card__excerpt">${App._escHtml((p.content || '').slice(0, 120))}${(p.content || '').length > 120 ? '…' : ''}</p>
            <div class="forum-card__meta">
              <span><i class="fas fa-user"></i> ${App._escHtml(p.author_name)}${p.class_name ? ` · ${App._escHtml(p.class_name)}` : ''}</span>
              <span><i class="fas fa-comment"></i> ${p.reply_count || 0}</span>
              <span><i class="fas fa-eye"></i> ${p.view_count || 0}</span>
              <span>${App.formatDate(p.updated_at || p.created_at)}</span>
            </div>
          </a>
        </article>
      `).join('');

      const total = data.total || 0;
      const pages = Math.ceil(total / (data.limit || 15));
      const pag = document.getElementById('forum-pagination');
      if (pag && pages > 1) {
        pag.innerHTML = `<button class="btn btn-outline btn-sm" ${page <= 1 ? 'disabled' : ''} id="forum-prev">上一頁</button>
          <span class="text-sm text-muted mx-2">第 ${page} / ${pages} 頁</span>
          <button class="btn btn-outline btn-sm" ${page >= pages ? 'disabled' : ''} id="forum-next">下一頁</button>`;
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

      root.innerHTML = `
        <nav class="breadcrumb"><a href="#/forum">论坛</a> <span>/</span> <span>帖子詳情</span></nav>
        <article class="card">
          <div class="card-header">
            <h2 style="margin:0;font-size:1.25rem">${App._escHtml(post.title)}</h2>
            ${isAdmin ? `<button type="button" class="btn btn-danger btn-xs" id="forum-del-post">删除帖子</button>` : ''}
          </div>
          <div class="card-body">
            <p class="forum-card__meta mb-2">
              <span>${App._escHtml(post.author_name)}</span>
              <span>${App.formatDate(post.created_at)}</span>
              <span>${post.view_count || 0} 瀏覽</span>
            </p>
            <div class="detail-prose">${App._escHtml(post.content).replace(/\n/g, '<br>')}</div>
          </div>
        </article>
        <h3 class="mt-4 mb-2" style="font-size:1rem">回复 (${replies.length})</h3>
        <div id="forum-replies">${replies.length ? replies.map(r => `
          <div class="forum-reply card mb-2">
            <div class="card-body">
              <div class="forum-card__meta mb-1">
                <strong>${App._escHtml(r.author_name)}</strong>
                <span>${App.formatDate(r.created_at)}</span>
                ${isAdmin ? `<button type="button" class="btn btn-danger btn-xs forum-del-reply" data-id="${r.id}">删除</button>` : ''}
              </div>
              <p style="margin:0;line-height:1.7">${App._escHtml(r.content).replace(/\n/g, '<br>')}</p>
            </div>
          </div>
        `).join('') : '<p class="text-muted">暂无回复</p>'}</div>
        ${App.user ? `
          <div class="card mt-3">
            <div class="card-body">
              <div class="form-group"><label>發表回复</label><textarea id="forum-reply-text" class="form-input" rows="3" placeholder="輸入回复內容…"></textarea></div>
              <button type="button" class="btn btn-primary btn-sm" id="forum-reply-submit">提交回复</button>
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
        if (!content) return App.showToast('请输入回复內容', 'warning');
        const r = await API.forum.reply(id, content);
        if (r.success) { App.showToast(App.user?.role==='admin'?'回复成功':'回复已提交，待管理员审核', 'success'); this.renderPost(id); }
        else App.showToast(r.error || '回复失败', 'error');
      });
    } catch (e) {
      root.innerHTML = `<div class="empty-state"><p>${App._escHtml(e.message)}</p></div>`;
    }
  },

  _showNewPostForm() {
    if (!App.user) { window.location.hash = '#/login'; return; }
    App.showModal(`
      <div class="modal-header"><h3>發表帖子</h3><button type="button" class="modal-close" onclick="App.hideModal()">&times;</button></div>
      <div class="modal-body">
        <div class="form-group"><label>標題</label><input type="text" id="forum-post-title" class="form-input" maxlength="120"></div>
        <div class="form-group"><label>內容</label><textarea id="forum-post-content" class="form-input" rows="5"></textarea></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="App.hideModal()">取消</button>
        <button type="button" class="btn btn-primary" id="forum-post-submit">发布</button>
      </div>
    `);
    document.getElementById('forum-post-submit').addEventListener('click', async () => {
      const title = document.getElementById('forum-post-title')?.value?.trim();
      const content = document.getElementById('forum-post-content')?.value?.trim();
      if (!title || !content) return App.showToast('請填寫標題和內容', 'warning');
      const r = await API.forum.createPost({ title, content });
      if (r.success) {
        App.hideModal();
        App.showToast('发布成功', 'success');
        window.location.hash = `#/forum/${r.data?.id || ''}`;
        if (r.data?.id) this.renderPost(r.data.id);
        else this.renderList();
      } else App.showToast(r.error || '发布失败', 'error');
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
          <div class="ai-msg ai-msg-bot">你好！我是運動會助手「小濠」🏃<br>有什麼可以幫你的嗎？</div>
        </div>
        <div class="ai-chat-input">
          <input type="text" id="ai-chat-input" placeholder="輸入問題...">
          <button id="ai-chat-send"><i class="fas fa-paper-plane"></i></button>
        </div>
        ${App.user?.role==='admin'?`<div class="ai-chat-admin"><button class="btn-text" id="ai-key-btn">設定 API Key</button></div>`:''}
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
      <div class="modal-header"><h3>設定 DeepSeek API Key</h3><button class="modal-close" onclick="App.hideModal()">&times;</button></div>
      <div class="modal-body">
        <p class="text-sm text-muted mb-2">请输入您的 DeepSeek API Key，用於驅動 AI 助手</p>
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
