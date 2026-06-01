// ═══ 3D 鼠标跟踪卡片 ═══
(function() {
  'use strict';

  function track3D() {
    var cards = document.querySelectorAll('.stat-card, .event-mini-card, .parallax-section');
    
    cards.forEach(function(card) {
      if (card.dataset.track3d === 'true') return;
      card.dataset.track3d = 'true';
      
      card.addEventListener('mousemove', function(e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var rx = ((y - cy) / cy) * -8;
        var ry = ((x - cx) / cx) * 8;
        card.style.transform = 'perspective(800px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) scale3d(1.02,1.02,1.02)';
        card.style.transition = 'transform .1s ease-out';
      });
      
      card.addEventListener('mouseleave', function() {
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)';
        card.style.transition = 'transform .5s ease-out';
      });
    });
  }

  // 初始运行
  document.addEventListener('DOMContentLoaded', function() { setTimeout(track3D, 500); });
  window.addEventListener('hashchange', function() { setTimeout(track3D, 600); });
  
  // 持续扫描
  setInterval(track3D, 2000);
})();
