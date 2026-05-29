const Auth = {
  captchaToken: '',

  renderLogin() {
    document.getElementById('page-login').innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-header">
            <h2>登入系統</h2>
            <p>使用學校郵箱與密碼登入</p>
          </div>
          <form id="login-form" class="auth-form" novalidate>
            <div class="form-group">
              <label for="login-email">學校郵箱</label>
              <input type="email" id="login-email" class="form-input" placeholder="name@hkms.hktedu.com" required autofocus autocomplete="username">
            </div>
            <div class="form-group">
              <label for="login-password">密碼</label>
              <input type="password" id="login-password" class="form-input" placeholder="請輸入密碼" required autocomplete="current-password">
            </div>
            <div class="form-group">
              <label for="login-captcha">驗證碼</label>
              <div class="captcha-row">
                <input type="text" id="login-captcha" class="form-input" placeholder="圖中字符" required maxlength="4" autocomplete="off" inputmode="text">
                <div class="captcha-img" id="login-captcha-img" title="點擊刷新驗證碼" role="button" tabindex="0"></div>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">登入</button>
            <div class="auth-links">
              <a href="#/register">註冊新帳號</a>
              <a href="#" id="forgot-link">忘記密碼</a>
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
  },

  renderRegister() {
    document.getElementById('page-register').innerHTML = `
      <div class="auth-page">
        <div class="auth-card" style="max-width:480px">
          <div class="auth-header">
            <h2>註冊帳號</h2>
            <p>填寫真實資料以便賽務審核與聯絡</p>
          </div>
          <form id="register-form" class="auth-form" novalidate>
            <div class="form-group">
              <label for="reg-username">用戶名 <span class="text-muted">*</span></label>
              <input type="text" id="reg-username" class="form-input" placeholder="登入用，建議使用學號或拼音" required autocomplete="username">
            </div>
            <div class="form-group">
              <label for="reg-email">學校郵箱 <span class="text-muted">*</span></label>
              <input type="email" id="reg-email" class="form-input" placeholder="xxx@hkms.hktedu.com" required autocomplete="email">
              <span class="form-hint">須為 @hkms.hktedu.com 結尾之郵箱</span>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="reg-password">密碼 <span class="text-muted">*</span></label>
                <input type="password" id="reg-password" class="form-input" placeholder="至少 6 位" required minlength="6" autocomplete="new-password">
              </div>
              <div class="form-group">
                <label for="reg-confirm">確認密碼 <span class="text-muted">*</span></label>
                <input type="password" id="reg-confirm" class="form-input" placeholder="再次輸入" required autocomplete="new-password">
              </div>
            </div>
            <div class="form-group">
              <label for="reg-name">真實姓名 <span class="text-muted">*</span></label>
              <input type="text" id="reg-name" class="form-input" placeholder="與證件一致" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="reg-sid">學號</label>
                <input type="text" id="reg-sid" class="form-input" placeholder="建議填寫">
              </div>
              <div class="form-group">
                <label for="reg-class">班級</label>
                <input type="text" id="reg-class" class="form-input" placeholder="如：高一(1)班">
              </div>
            </div>
            <div class="form-group">
              <label for="reg-grade">年級</label>
              <select id="reg-grade" class="form-select">
                <option value="">請選擇</option>
                <option>初一</option><option>初二</option><option>初三</option>
                <option>高一</option><option>高二</option><option>高三</option>
              </select>
            </div>
            <div class="form-group">
              <label for="reg-captcha">驗證碼 <span class="text-muted">*</span></label>
              <div class="captcha-row">
                <input type="text" id="reg-captcha" class="form-input" placeholder="圖中字符" required maxlength="4" autocomplete="off">
                <div class="captcha-img" id="reg-captcha-img" title="點擊刷新" role="button" tabindex="0"></div>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">提交註冊</button>
            <div class="auth-links" style="justify-content:center">
              <a href="#/login">已有帳號？返回登入</a>
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
        el.innerHTML = '<span class="text-xs text-muted">載入失敗</span>';
      }
    } catch (_) {
      el.innerHTML = '<span class="text-xs text-muted">點擊重試</span>';
    }
  },

  async _doLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const captchaCode = document.getElementById('login-captcha')?.value?.trim();
    if (!email) return App.showToast('請輸入郵箱', 'warning');
    if (!password) return App.showToast('請輸入密碼', 'warning');
    if (!captchaCode) return App.showToast('請輸入驗證碼', 'warning');

    App.showLoading();
    try {
      const res = await API.auth.login({ email, password, captchaToken: this.captchaToken, captchaCode });
      if (res.success && res.data?.token) {
        API.setToken(res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        App.user = res.data.user;
        App.updateNav();
        App.showToast('登入成功', 'success');
        App.refreshUser().catch(() => {});
        const dest = res.data.user.role === 'admin' ? '#/admin' : '#/student/register';
        setTimeout(() => { window.location.hash = dest; }, 50);
      } else {
        App.showToast(res.error || '登入失敗', 'error');
        this._refreshCaptcha('login-captcha', 'login-captcha-img');
      }
    } catch (e) {
      App.showToast(e.message || '登入失敗', 'error');
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

    if (!username) return App.showToast('請輸入用戶名', 'warning');
    if (!email) return App.showToast('請輸入郵箱', 'warning');
    if (!/^[a-zA-Z0-9._%+-]+@hkms\.hktedu\.com$/i.test(email)) {
      return App.showToast('郵箱須為 @hkms.hktedu.com 結尾', 'warning');
    }
    if (!password || password.length < 6) return App.showToast('密碼至少 6 位', 'warning');
    if (password !== confirm) return App.showToast('兩次密碼不一致', 'warning');
    if (!name) return App.showToast('請輸入姓名', 'warning');
    if (!captchaCode) return App.showToast('請輸入驗證碼', 'warning');

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
        App.showToast('註冊成功，請登入', 'success');
        window.location.hash = '#/login';
      } else {
        App.showToast(res.error || '註冊失敗', 'error');
        this._refreshCaptcha('reg-captcha', 'reg-captcha-img');
      }
    } catch (e) {
      App.showToast(e.message || '註冊失敗', 'error');
      this._refreshCaptcha('reg-captcha', 'reg-captcha-img');
    } finally {
      App.hideLoading();
    }
  },

  _showForgotPassword() {
    App.showModal(`
      <div class="modal-header"><h3>找回密碼</h3><button type="button" class="modal-close" onclick="App.hideModal()" aria-label="關閉">&times;</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label for="forgot-email">註冊郵箱</label>
          <input type="email" id="forgot-email" class="form-input" placeholder="name@hkms.hktedu.com">
        </div>
        <p class="form-hint">系統將生成一次性重置令牌，請妥善保存。</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="App.hideModal()">取消</button>
        <button type="button" class="btn btn-primary" id="forgot-submit">取得重置令牌</button>
      </div>
    `);
    document.getElementById('forgot-submit').addEventListener('click', async () => {
      const email = document.getElementById('forgot-email')?.value?.trim();
      if (!email || !/^[a-zA-Z0-9._%+-]+@hkms\.hktedu\.com$/i.test(email)) {
        return App.showToast('請輸入正確的學校郵箱', 'warning');
      }
      App.showLoading();
      try {
        const res = await API.auth.forgotPassword(email);
        App.hideLoading();
        if (res.success && res.data?.token) {
          App.showModal(`
            <div class="modal-header"><h3>重置密碼</h3><button type="button" class="modal-close" onclick="App.hideModal()">&times;</button></div>
            <div class="modal-body">
              <p class="mb-2 text-sm" style="color:var(--text-secondary)">重置令牌：<code style="background:var(--surface-3);padding:2px 8px;border-radius:4px;font-size:0.8125rem">${res.data.token}</code></p>
              <div class="form-group"><label for="reset-pwd">新密碼</label><input type="password" id="reset-pwd" class="form-input" minlength="6"></div>
              <div class="form-group"><label for="reset-confirm">確認密碼</label><input type="password" id="reset-confirm" class="form-input"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.hideModal()">取消</button>
              <button type="button" class="btn btn-primary" id="reset-submit">確認重置</button>
            </div>
          `);
          document.getElementById('reset-submit').addEventListener('click', async () => {
            const pwd = document.getElementById('reset-pwd')?.value;
            const conf = document.getElementById('reset-confirm')?.value;
            if (!pwd || pwd.length < 6) return App.showToast('密碼至少 6 位', 'warning');
            if (pwd !== conf) return App.showToast('兩次密碼不一致', 'warning');
            App.showLoading();
            try {
              const r2 = await API.post('/auth/reset-password', { token: res.data.token, newPassword: pwd });
              App.hideLoading();
              if (r2.success) {
                App.showToast('密碼已重置', 'success');
                App.hideModal();
                window.location.hash = '#/login';
              } else {
                App.showToast(r2.error || '重置失敗', 'error');
              }
            } catch (e) {
              App.hideLoading();
              App.showToast(e.message, 'error');
            }
          });
        } else {
          App.showToast(res.error || '操作失敗', 'error');
        }
      } catch (e) {
        App.hideLoading();
        App.showToast(e.message, 'error');
      }
    });
  },
};
