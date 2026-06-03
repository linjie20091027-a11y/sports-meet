// ═══ 轻量视差文本交互 ═══
(function() {
  'use strict';

  var canHover = typeof window.matchMedia !== 'function'
    || (window.matchMedia('(hover: hover)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!canHover) return;

  function bindParallax() {
    document.querySelectorAll('.parallax-section').forEach(function(card) {
      if (card.dataset.parallaxBound === 'true') return;
      card.dataset.parallaxBound = 'true';

      var text = card.querySelector('.parallax-text');
      if (!text) return;

      var frameId = 0;
      var pointerX = 0;
      var pointerY = 0;

      function render() {
        frameId = 0;
        var rect = card.getBoundingClientRect();
        var x = pointerX - rect.left;
        var y = pointerY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var rx = ((y - cy) / cy) * 4;
        var ry = -((x - cx) / cx) * 4;
        text.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateZ(12px)';
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
        text.style.transform = 'rotateX(0) rotateY(0) translateZ(0)';
      });
    });
  }

  function bindScrollProgress() {
    var bar = document.getElementById('scroll-progress');
    if (!bar) return;

    var ticking = false;

    function render() {
      ticking = false;
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      var docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );
      var viewport = window.innerHeight || document.documentElement.clientHeight || 0;
      var maxScroll = Math.max(1, docHeight - viewport);
      var progress = Math.max(0, Math.min(1, scrollTop / maxScroll));
      bar.style.transform = 'scaleX(' + progress + ')';
    }

    function requestRender() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(render);
    }

    window.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', requestRender);
    requestRender();
  }

  document.addEventListener('DOMContentLoaded', bindParallax);
  document.addEventListener('DOMContentLoaded', bindScrollProgress);
  window.addEventListener('hashchange', function() {
    window.setTimeout(bindParallax, 200);
    window.setTimeout(bindScrollProgress, 60);
  });
})();
