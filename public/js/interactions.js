// ═══════════════════════════════════════
// 典藏级互动引擎 v3
// ScrollReveal + 自定义光标 + 进度条 + 涟漪
// ==========================
(function() {
  'use strict';

  // ═══ 1. ScrollReveal 初始化 ═══
  var sr = null;
  function initSR() {
    if (typeof ScrollReveal === 'undefined') {
      // 加载ScrollReveal
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/scrollreveal@4';
      script.onload = function() {
        sr = ScrollReveal({ 
          distance: '40px',
          duration: 800,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: 0,
          scale: 0.95,
          reset: false,
          viewFactor: 0.15,
          mobile: true
        });
        applyReveal();
      };
      document.head.appendChild(script);
    } else {
      sr = ScrollReveal({ 
        distance: '40px',
        duration: 800,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: 0,
        scale: 0.95,
        reset: false,
        viewFactor: 0.15,
        mobile: true
      });
      applyReveal();
    }
  }

  function applyReveal() {
    if (!sr) return;
    // 统计卡片 - 逐个浮现
    sr.reveal('.stat-card', { interval: 100, origin: 'bottom', distance: '50px', scale: 0.9 });
    // 赛事卡片
    sr.reveal('.event-mini-card', { interval: 60, origin: 'bottom', distance: '30px' });
    sr.reveal('.event-card', { interval: 80, origin: 'left', distance: '40px' });
    // 公告卡片
    sr.reveal('.announcement-card', { interval: 100, origin: 'right', distance: '30px' });
    // 论坛卡片
    sr.reveal('.forum-card', { interval: 120, origin: 'bottom', distance: '35px' });
    // 侧边栏
    sr.reveal('.sidebar-card', { interval: 80, origin: 'right', distance: '25px' });
    // 成绩卡片
    sr.reveal('.card', { interval: 60, origin: 'bottom', distance: '30px', scale: 0.98 });
    // 表格行
    sr.reveal('.table tbody tr', { interval: 30, origin: 'bottom', distance: '15px', scale: 1, duration: 500 });
  }

  // 路由变化时重新应用
  window.addEventListener('hashchange', function() {
    setTimeout(applyReveal, 500);
  });

  // 观察DOM变化
  var observer = new MutationObserver(function() {
    setTimeout(applyReveal, 400);
  });
  observer.observe(document.getElementById('app-main') || document.body, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initSR, 200);
  });
  setTimeout(initSR, 1000);

  // ═══ 2. 滚动进度指示器 ═══
  var progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  document.body.appendChild(progressBar);

  window.addEventListener('scroll', function() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.transform = 'scaleX(' + (progress / 100) + ')';
  }, { passive: true });

  // ═══ 3. 返回顶部 ═══
  function initBackToTop() {
    if (document.getElementById('back-to-top')) return;
    var btn = document.createElement('div');
    btn.id = 'back-to-top';
    btn.className = 'back-to-top';
    btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    btn.title = '返回顶部';
    btn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);
    window.addEventListener('scroll', function() {
      var scrollY = window.scrollY || document.documentElement.scrollTop;
      btn.classList.toggle('visible', scrollY > 400);
    }, { passive: true });
  }
  setTimeout(initBackToTop, 500);

  // ═══ 4. 数字计数 ═══
  function animateCounters() {
    document.querySelectorAll('.stat-num:not(.counted)').forEach(function(el) {
      el.classList.add('counted');
      var target = parseInt(el.textContent) || 0;
      if (target <= 0) return;
      var duration = 1500, startTime = null;
      function step(ts) {
        if (!startTime) startTime = ts;
        var p = Math.min((ts - startTime) / duration, 1);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(e * target);
        if (p < 1) requestAnimationFrame(step);
        else { el.textContent = target; el.classList.add('counted'); }
      }
      requestAnimationFrame(step);
    });
  }
  setTimeout(animateCounters, 800);
  setTimeout(animateCounters, 2500);

  // ═══ 5. 涟漪 ═══
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.btn,.btn--primary,.btn--secondary,.btn--success,.btn--danger,.btn--outline');
    if (!btn || btn.querySelector('.ripple-effect')) return;
    var ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', function() { ripple.remove(); });
  });

  // ═══ 6. 自定义光标 ═══
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    var cursorDot = document.createElement('div');
    cursorDot.className = 'custom-cursor-dot';
    document.body.appendChild(cursor);
    document.body.appendChild(cursorDot);
    var mx = 0, my = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', function(e) {
      mx = e.clientX; my = e.clientY;
      cursorDot.style.transform = 'translate(' + (mx - 4) + 'px,' + (my - 4) + 'px)';
    }, { passive: true });
    function anim() {
      cx += (mx - cx) * 0.12; cy += (my - cy) * 0.12;
      cursor.style.transform = 'translate(' + (cx - 16) + 'px,' + (cy - 16) + 'px)';
      requestAnimationFrame(anim);
    }
    anim();
    document.addEventListener('mouseover', function(e) {
      if (e.target.closest('.btn,.card,.nav-link,a,button,.stat-card,.event-mini-card')) {
        cursor.classList.add('cursor-hover');
        cursorDot.classList.add('cursor-hover');
      }
    });
    document.addEventListener('mouseout', function(e) {
      if (e.target.closest('.btn,.card,.nav-link,a,button,.stat-card,.event-mini-card')) {
        cursor.classList.remove('cursor-hover');
        cursorDot.classList.remove('cursor-hover');
      }
    });
  }

})();
