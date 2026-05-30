// ═══════════════════════════════════════
// 典藏级滚动互动引擎
// ==========================

(function() {
  'use strict';

  // Intersection Observer — 滚动入场触发
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -20px 0px'
  });

  // 初始化观察
  function initReveal() {
    var elements = document.querySelectorAll('.reveal-up, .reveal-scale, .reveal-left, .reveal-right');
    elements.forEach(function(el) { observer.observe(el); });
  }

  // DOM变化后重新初始化
  var domObserver = new MutationObserver(function() {
    setTimeout(initReveal, 300);
  });

  domObserver.observe(document.getElementById('app-main') || document.body, {
    childList: true,
    subtree: true
  });

  // 初始运行
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initReveal, 500);
  });

  // 页面路由变化后重新初始化
  window.addEventListener('hashchange', function() {
    setTimeout(initReveal, 500);
  });

})();

// ═══ 包装App.renderHome以添加reveal类 ═══
(function patchHome() {
  var origInit = App.init;
  if (origInit) {
    App.init = function() {
      origInit.call(this);
      // 监听页面内容变化
      var observerFn = function() {
        setTimeout(function() {
          // 给统计卡片添加动画类
          var cards = document.querySelectorAll('.stat-card');
          cards.forEach(function(c, i) {
            c.classList.add('reveal-up');
            c.classList.add('stagger-' + (i + 1));
          });
          // 给首页卡片添加动画
          var hCards = document.querySelectorAll('#home-events .event-mini-card');
          hCards.forEach(function(c, i) {
            c.classList.add('reveal-scale');
            c.classList.add('stagger-' + ((i % 5) + 1));
          });
        }, 600);
      };
      setInterval(observerFn, 2000);
      observerFn();
    };
  }
})();
