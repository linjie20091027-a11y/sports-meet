// ═══ 3D 鼠标跟踪卡片 ═══
(function() {
  'use strict';

  var canHover = typeof window.matchMedia !== 'function'
    || (window.matchMedia('(hover: hover)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function track3D() {
    if (!canHover) return;
    var cards = document.querySelectorAll('.stat-card, .event-mini-card');
    
    cards.forEach(function(card) {
      if (card.dataset.track3d === 'true') return;
      card.dataset.track3d = 'true';

      var frameId = 0;
      var pointerX = 0;
      var pointerY = 0;

      function render() {
        frameId = 0;
        var rect = card.getBoundingClientRect();
        var x = pointerX - rect.left;
        var y = pointerY - rect.top;
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var rx = ((y - cy) / cy) * -8;
        var ry = ((x - cx) / cx) * 8;
        card.style.transform = 'perspective(800px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) scale3d(1.02,1.02,1.02)';
        card.style.transition = 'transform .1s ease-out';
      }

      card.addEventListener('pointermove', function(e) {
        pointerX = e.clientX;
        pointerY = e.clientY;
        if (!frameId) frameId = window.requestAnimationFrame(render);
      }, { passive: true });

      card.addEventListener('pointerleave', function() {
        if (frameId) {
          window.cancelAnimationFrame(frameId);
          frameId = 0;
        }
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)';
        card.style.transition = 'transform .5s ease-out';
      });
    });
  }

  // 初始运行
  document.addEventListener('DOMContentLoaded', function() { setTimeout(track3D, 500); });
  window.addEventListener('hashchange', function() { setTimeout(track3D, 600); });
})();
