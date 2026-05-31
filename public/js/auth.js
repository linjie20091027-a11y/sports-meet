const Auth = {
  captchaToken: '',

  renderLogin() {
    document.getElementById('page-login').innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-header">
            <h2>登录系统</h2>
            <p>使用學校邮箱與密码登录</p>
          </div>
          <form id="login-form" class="auth-form" novalidate>
            <div class="form-group">
              <label for="login-email">學校邮箱</label>
              <input type="email" id="login-email" class="form-input" placeholder="name@hkms.hktedu.com" required autofocus autocomplete="username">
            </div>
            <div class="form-group">
              <label for="login-password">密码</label>
              <input type="password" id="login-password" class="form-input" placeholder="请输入密码" required autocomplete="current-password">
            </div>
            <div class="form-group">
              <label for="login-captcha">验证码</label>
              <div class="captcha-row">
                <input type="text" id="login-captcha" class="form-input" placeholder="圖中字符" required maxlength="4" autocomplete="off" inputmode="text">
                <div class="captcha-img" id="login-captcha-img" title="点击刷新验证码" role="button" tabindex="0"></div>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">登录</button>
            <div style="text-align:center;margin:12px 0;color:var(--text3);font-size:.75rem">——— 或 ———</div>
            <button type="button" class="btn btn-block" style="background:#fff;color:#444;border:1px solid #ddd;font-weight:500" id="google-login-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right:8px"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              使用 Google 账号登录
            </button>
            <button type="button" class="btn btn-block btn-sm mt-1" style="background:#f0f1f3;color:var(--text2)" id="quick-login-btn">快速体验（管理员）</button>
            <div class="auth-links">
              <a href="#/register">注册新帳號</a>
              <a href="#" id="forgot-link">忘記密码</a>
            </div>
          </form>
        </div>
      </div>
    `;
    this.loadCaptcha('login-captcha-img');
    document.getElementById('login-form').addEventListener('submit', async (e) => { e.preventDefault(); await this._doLogin(); });
    const cap = document.getElementById('login-captcha-img');
    cap.addEventListener('click', () => this._refreshCaptcha('login-captcha', 'login-captcha-img'));
    cap.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._refreshCaptcha('login-captcha', 'login-captcha-img'); } });
    document.getElementById('forgot-link').addEventListener('click', (e) => { e.preventDefault(); this._showForgotPassword(); });
    const loginEmail = document.getElementById('login-email');
    loginEmail.addEventListener('blur', () => {
      let val = loginEmail.value.trim();
      if (val && !val.includes('@')) {
        loginEmail.value = val + '@hkms.hktedu.com';
      }
    });
    // Google 登录按钮
    document.getElementById('google-login-btn')?.addEventListener('click', () => this._googleLogin());
    // 快速体验
    document.getElementById('quick-login-btn')?.addEventListener('click', () => this._quickLogin());
  },

  async _googleLogin() {
    // Google OAuth 登录
    // 需要：在 https://console.cloud.google.com 创建 OAuth 2.0 客户端
    // 获取 Client ID 后替换下方 YOUR_CLIENT_ID
    var clientId = localStorage.getItem('google_client_id') || '';
    
    if (!clientId) {
      // 未配置时：弹窗让用户输入 Client ID 或使用快速登录
      App.showModal(`
        <div class="modal-header"><h3>Google 登录配置</h3><button class="modal-close" onclick="App.hideModal()"><i class="fas fa-times"></i></button></div>
        <div class="modal-body">
          <p class="mb-2" style="font-size:.85rem">Google 登录需要配置 OAuth 客户端 ID。</p>
          <div class="form-group"><label>Google Client ID</label><input type="text" id="g-client-id" class="form-input" placeholder="粘贴你的 Google Client ID"></div>
          <p class="text-sm text-muted">如果没有，可以 <a href="https://console.cloud.google.com/apis/credentials" target="_blank">点击这里创建</a></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" onclick="App.hideModal()">取消</button>
          <button class="btn btn-primary btn-sm" id="save-g-id">保存并登录</button>
          <button class="btn btn-outline btn-sm" id="use-quick">快速登录</button>
        </div>
      `);
      document.getElementById('save-g-id').addEventListener('click', function() {
        var cid = document.getElementById('g-client-id').value.trim();
        if (cid) { localStorage.setItem('google_client_id', cid); App.showToast('已保存', 'success'); }
        App.hideModal();
        Auth._googleLogin();
      });
      document.getElementById('use-quick').addEventListener('click', function() {
        App.hideModal();
        Auth._quickLogin();
      });
      return;
    }
    
    // 使用 Google Identity Services 登录
    if (typeof google === 'undefined' || !google.accounts) {
      // 动态加载 Google GIS
      var script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = function() {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: Auth._handleGoogleResponse
        });
        google.accounts.id.prompt();
      };
      document.head.appendChild(script);
    } else {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: Auth._handleGoogleResponse
      });
      google.accounts.id.prompt();
    }
  },

  _handleGoogleResponse(response) {
    // 发送 Google token 到后端验证
    App.showLoading();
    API.post('/auth/google-login', { credential: response.credential })
      .then(function(res) {
        App.hideLoading();
        if (res.success && res.data) {
          API.setToken(res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          App.showToast('Google 登录成功', 'success');
          App.updateNav();
          window.location.hash = '#/';
        } else {
          App.showToast(res.error || '登录失败', 'error');
        }
      })
      .catch(function(e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      });
  },

  async _quickLogin() {
    // 快速管理员登录（跳过验证码）
    try {
      App.showLoading();
      // 通过 API 生成临时token
      var res = await API.post('/auth/quick-login', { email: 'admin@hkms.hktedu.com', password: 'admin123' });
      App.hideLoading();
      if (res.success && res.data) {
        API.setToken(res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        App.showToast('登录成功', 'success');
        App.updateNav();
        window.location.hash = '#/admin';
      }
    } catch(e) {
      App.hideLoading();
      App.showToast('快速登录失败，请使用表单登录', 'error');
    }
  },

  renderRegister() {
    document.getElementById('page-register').innerHTML = `
      <div class="auth-page">
        <div class="auth-card" style="max-width:480px">
          <div class="auth-header">
            <h2>注册帳號</h2>
            <p>填寫真實資料以便賽務审核與聯絡</p>
          </div>
          <form id="register-form" class="auth-form" novalidate>
            <div class="form-group">
              <label for="reg-username">用户名 <span class="text-muted">*</span></label>
              <input type="text" id="reg-username" class="form-input" placeholder="登录用，建議使用学号或拼音" required autocomplete="username">
            </div>
            <div class="form-group">
              <label for="reg-email">學校邮箱 <span class="text-muted">*</span></label>
              <input type="email" id="reg-email" class="form-input" placeholder="xxx@hkms.hktedu.com" required autocomplete="email">
              <span class="form-hint">須為 @hkms.hktedu.com 結尾之邮箱</span>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="reg-password">密码 <span class="text-muted">*</span></label>
                <input type="password" id="reg-password" class="form-input" placeholder="至少 6 位" required minlength="6" autocomplete="new-password">
              </div>
              <div class="form-group">
                <label for="reg-confirm">确认密码 <span class="text-muted">*</span></label>
                <input type="password" id="reg-confirm" class="form-input" placeholder="再次輸入" required autocomplete="new-password">
              </div>
            </div>
            <div class="form-group">
              <label for="reg-name">真實姓名 <span class="text-muted">*</span></label>
              <input type="text" id="reg-name" class="form-input" placeholder="與證件一致" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="reg-sid">学号</label>
                <input type="text" id="reg-sid" class="form-input" placeholder="建議填寫">
              </div>
              <div class="form-group">
                <label for="reg-class">班级</label>
                <input type="text" id="reg-class" class="form-input" placeholder="如：高一(1)班">
              </div>
            </div>
            <div class="form-group">
              <label for="reg-grade">年级</label>
              <select id="reg-grade" class="form-select">
                <option value="">請选择</option>
                <option>初一</option><option>初二</option><option>初三</option>
                <option>高一</option><option>高二</option><option>高三</option>
              </select>
            </div>
            <div class="form-group">
              <label for="reg-captcha">验证码 <span class="text-muted">*</span></label>
              <div class="captcha-row">
                <input type="text" id="reg-captcha" class="form-input" placeholder="圖中字符" required maxlength="4" autocomplete="off">
                <div class="captcha-img" id="reg-captcha-img" title="点击刷新" role="button" tabindex="0"></div>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">提交注册</button>
            <div class="auth-links" style="justify-content:center">
              <a href="#/login">已有帳號？返回登录</a>
            </div>
          </form>
        </div>
      </div>
    `;
    this.loadCaptcha('reg-captcha-img');
    document.getElementById('register-form').addEventListener('submit', async (e) => { e.preventDefault(); await this._doRegister(); });
    const cap = document.getElementById('reg-captcha-img');
    cap.addEventListener('click', () => this._refreshCaptcha('reg-captcha', 'reg-captcha-img'));
    cap.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._refreshCaptcha('reg-captcha', 'reg-captcha-img'); } });
    const regEmail = document.getElementById('reg-email');
    regEmail.addEventListener('blur', () => {
      let val = regEmail.value.trim();
      if (val && !val.includes('@')) {
        regEmail.value = val + '@hkms.hktedu.com';
      }
    });
  },

  _refreshCaptcha(inputId, imgId) {
    const input = document.getElementById(inputId);
    if (input) input.value = '';
    this.loadCaptcha(imgId);
  },

  async loadCaptcha(elemId) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.innerHTML = '<div class="spinner" style="width:24px;height:24px;border-width:2px"></div>';
    try {
      const res = await API.auth.getCaptcha();
      if (res.success && res.data) {
        this.captchaToken = res.data.token;
        el.innerHTML = res.data.svg;
      } else {
        el.innerHTML = '<span class="text-xs text-muted">加载失败</span>';
      }
    } catch (_) {
      el.innerHTML = '<span class="text-xs text-muted">点击重試</span>';
    }
  },

  async _doLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const captchaCode = document.getElementById('login-captcha')?.value?.trim();
    if (!email) return App.showToast('请输入邮箱', 'warning');
    if (!password) return App.showToast('请输入密码', 'warning');
    if (!captchaCode) return App.showToast('请输入验证码', 'warning');

    App.showLoading();
    try {
      const res = await API.auth.login({ email, password, captchaToken: this.captchaToken, captchaCode });
      if (res.success && res.data?.token) {
        API.setToken(res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        App.user = res.data.user;
        App.updateNav();
        App.showToast('登录成功', 'success');
        App.refreshUser().catch(() => {});
        const dest = res.data.user.role === 'admin' ? '#/admin' : '#/student/register';
        setTimeout(() => { window.location.hash = dest; }, 50);
      } else {
        App.showToast(res.error || '登录失败', 'error');
        this._refreshCaptcha('login-captcha', 'login-captcha-img');
      }
    } catch (e) {
      App.showToast(e.message || '登录失败', 'error');
      this._refreshCaptcha('login-captcha', 'login-captcha-img');
    } finally {
      App.hideLoading();
    }
  },

  async _doRegister() {
    const username = document.getElementById('reg-username')?.value?.trim();
    const email = document.getElementById('reg-email')?.value?.trim();
    const password = document.getElementById('reg-password')?.value;
    const confirm = document.getElementById('reg-confirm')?.value;
    const name = document.getElementById('reg-name')?.value?.trim();
    const sid = document.getElementById('reg-sid')?.value?.trim();
    const cls = document.getElementById('reg-class')?.value?.trim();
    const grade = document.getElementById('reg-grade')?.value;
    const captchaCode = document.getElementById('reg-captcha')?.value?.trim();

    if (!username) return App.showToast('请输入用户名', 'warning');
    if (!email) return App.showToast('请输入邮箱', 'warning');
    if (!/^[a-zA-Z0-9._%+-]+@hkms\.hktedu\.com$/i.test(email)) {
      return App.showToast('邮箱須為 @hkms.hktedu.com 結尾', 'warning');
    }
    if (!password || password.length < 6) return App.showToast('密码至少 6 位', 'warning');
    if (password !== confirm) return App.showToast('兩次密码不一致', 'warning');
    if (!name) return App.showToast('请输入姓名', 'warning');
    if (!captchaCode) return App.showToast('请输入验证码', 'warning');

    App.showLoading();
    try {
      const res = await API.auth.register({
        username, email, password, name,
        student_id: sid,
        class_name: cls,
        grade,
        captchaToken: this.captchaToken,
        captchaCode
      });
      if (res.success) {
        App.showToast('注册成功，請登录', 'success');
        window.location.hash = '#/login';
      } else {
        App.showToast(res.error || '注册失败', 'error');
        this._refreshCaptcha('reg-captcha', 'reg-captcha-img');
      }
    } catch (e) {
      App.showToast(e.message || '注册失败', 'error');
      this._refreshCaptcha('reg-captcha', 'reg-captcha-img');
    } finally {
      App.hideLoading();
    }
  },

  _showForgotPassword() {
    App.showModal(`
      <div class="modal-header"><h3>找回密码</h3><button type="button" class="modal-close" onclick="App.hideModal()" aria-label="关闭">&times;</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label for="forgot-email">注册邮箱</label>
          <input type="email" id="forgot-email" class="form-input" placeholder="name@hkms.hktedu.com">
        </div>
        <p class="form-hint">系统將生成一次性重置令牌，請妥善保存。</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="App.hideModal()">取消</button>
        <button type="button" class="btn btn-primary" id="forgot-submit">取得重置令牌</button>
      </div>
    `);
    const forgotEmail = document.getElementById('forgot-email');
    forgotEmail.addEventListener('blur', () => {
      let val = forgotEmail.value.trim();
      if (val && !val.includes('@')) {
        forgotEmail.value = val + '@hkms.hktedu.com';
      }
    });
    document.getElementById('forgot-submit').addEventListener('click', async () => {
      const email = document.getElementById('forgot-email')?.value?.trim();
      if (!email || !/^[a-zA-Z0-9._%+-]+@hkms\.hktedu\.com$/i.test(email)) {
        return App.showToast('请输入正確的學校邮箱', 'warning');
      }
      App.showLoading();
      try {
        const res = await API.auth.forgotPassword(email);
        App.hideLoading();
        if (res.success && res.data?.token) {
          App.showModal(`
            <div class="modal-header"><h3>重置密码</h3><button type="button" class="modal-close" onclick="App.hideModal()">&times;</button></div>
            <div class="modal-body">
              <p class="mb-2 text-sm" style="color:var(--text-secondary)">重置令牌：<code style="background:var(--surface-3);padding:2px 8px;border-radius:4px;font-size:0.8125rem">${res.data.token}</code></p>
              <div class="form-group"><label for="reset-pwd">新密码</label><input type="password" id="reset-pwd" class="form-input" minlength="6"></div>
              <div class="form-group"><label for="reset-confirm">确认密码</label><input type="password" id="reset-confirm" class="form-input"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.hideModal()">取消</button>
              <button type="button" class="btn btn-primary" id="reset-submit">确认重置</button>
            </div>
          `);
          document.getElementById('reset-submit').addEventListener('click', async () => {
            const pwd = document.getElementById('reset-pwd')?.value;
            const conf = document.getElementById('reset-confirm')?.value;
            if (!pwd || pwd.length < 6) return App.showToast('密码至少 6 位', 'warning');
            if (pwd !== conf) return App.showToast('兩次密码不一致', 'warning');
            App.showLoading();
            try {
              const r2 = await API.post('/auth/reset-password', { token: res.data.token, newPassword: pwd });
              App.hideLoading();
              if (r2.success) {
                App.showToast('密码已重置', 'success');
                App.hideModal();
                window.location.hash = '#/login';
              } else {
                App.showToast(r2.error || '重置失败', 'error');
              }
            } catch (e) {
              App.hideLoading();
              App.showToast(e.message, 'error');
            }
          });
        } else {
          App.showToast(res.error || '操作失败', 'error');
        }
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      }
    });
  },
};
