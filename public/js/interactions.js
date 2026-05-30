// ═══════════════════════════════════════
// 典藏级互动引擎 v2
// Apple叙事 · Stripe质感 · Linear静默
// ==========================
(function() {
  'use strict';

  // ═══ 1. 滚动进度指示器 ═══
  var progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  document.body.appendChild(progressBar);

  window.addEventListener('scroll', function() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.transform = 'scaleX(' + (progress / 100) + ')';
  }, { passive: true });

  // ═══ 2. 自定义光标 ═══
  var cursor = document.createElement('div');
  cursor.className = 'custom-cursor';
  var cursorDot = document.createElement('div');
  cursorDot.className = 'custom-cursor-dot';
  document.body.appendChild(cursor);
  document.body.appendChild(cursorDot);

  var mouseX = 0, mouseY = 0;
  var cursorX = 0, cursorY = 0;

  document.addEventListener('mousemove', function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorDot.style.transform = 'translate(' + (mouseX - 4) + 'px,' + (mouseY - 4) + 'px)';
  }, { passive: true });

  function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.15;
    cursorY += (mouseY - cursorY) * 0.15;
    cursor.style.transform = 'translate(' + (cursorX - 16) + 'px,' + (cursorY - 16) + 'px)';
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Magnetic elements
  document.addEventListener('mouseover', function(e) {
    var target = e.target.closest('.btn, .card, .nav-link, a, button, .stat-card, .event-mini-card');
    if (target) {
      cursor.classList.add('cursor-hover');
      cursorDot.classList.add('cursor-hover');
    }
  });
  document.addEventListener('mouseout', function(e) {
    var target = e.target.closest('.btn, .card, .nav-link, a, button, .stat-card, .event-mini-card');
    if (target) {
      cursor.classList.remove('cursor-hover');
      cursorDot.classList.remove('cursor-hover');
    }
  });

  // ═══ 3. 3D Tilt 卡片 ═══
  document.addEventListener('mousemove', function(e) {
    var cards = document.querySelectorAll('.card-3d');
    cards.forEach(function(card) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var centerX = rect.width / 2;
      var centerY = rect.height / 2;
      var rotateX = ((y - centerY) / centerY) * -5;
      var rotateY = ((x - centerX) / centerX) * 5;
      card.style.transform = 'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) scale3d(1.02,1.02,1.02)';
    });
  }, { passive: true });

  document.addEventListener('mouseleave', function(e) {
    var cards = document.querySelectorAll('.card-3d');
    cards.forEach(function(card) {
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)';
    });
  });

  // ═══ 4. 首屏入场序列增强 ═══
  function initHeroSequence() {
    var hero = document.querySelector('.hero-banner');
    if (!hero) return;
    
    // 添加stagger类
    var countdownItems = hero.querySelectorAll('.countdown-item');
    countdownItems.forEach(function(item, i) {
      item.style.animationDelay = (0.6 + i * 0.12) + 's';
      item.classList.add('hero-stagger-item');
    });
  }

  // ═══ 5. 滚动视差增强 ═══
  function initParallax() {
    var parallaxSections = document.querySelectorAll('.parallax-section');
    parallaxSections.forEach(function(section) {
      var speed = 0.3;
      var y = window.scrollY * speed;
      // Use CSS variable for performance
      section.style.setProperty('--parallax-y', y + 'px');
    });
  }

  window.addEventListener('scroll', function() {
    initParallax();
  }, { passive: true });

  // ═══ 6. Intersection Observer — 滚动揭幕 ═══
  var revealObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  function observeReveal() {
    setTimeout(function() {
      document.querySelectorAll('.reveal-up, .reveal-scale, .reveal-left, .reveal-right').forEach(function(el) {
        revealObserver.observe(el);
      });
      
      // 自动给卡片添加reveal类
      document.querySelectorAll('.card:not(.reveal-up):not(.no-reveal)').forEach(function(el, i) {
        el.classList.add('reveal-up', 'stagger-' + ((i % 5) + 1));
        revealObserver.observe(el);
      });
    }, 300);
  }

  // 监听DOM变化
  var domObserver = new MutationObserver(function() { observeReveal(); });
  domObserver.observe(document.getElementById('app-main') || document.body, { childList: true, subtree: true });

  // 初始化和路由变化
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initHeroSequence, 100);
    setTimeout(observeReveal, 500);
  });
  window.addEventListener('hashchange', function() {
    setTimeout(initHeroSequence, 200);
    setTimeout(observeReveal, 500);
  });

  // ═══ 7. 给统计卡片添加3D类 ═══
  setInterval(function() {
    document.querySelectorAll('.stat-card').forEach(function(c) {
      if (!c.classList.contains('card-3d')) c.classList.add('card-3d');
    });
  }, 2000);

})();
