// ═══ 3D 透视卡片 (Aceternity UI 鼠标跟踪) ═══
(function() {
  document.addEventListener('mousemove', function(e) {
    var cards = document.querySelectorAll('.parallax-section');
    cards.forEach(function(card) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      var cx = rect.width / 2, cy = rect.height / 2;
      var rx = ((y - cy) / cy) * 5;
      var ry = -((x - cx) / cx) * 5;
      var text = card.querySelector('.parallax-text');
      if (text) text.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateZ(15px)';
    });
  });
  // 鼠标离开时复位
  document.addEventListener('mouseleave', function() {
    document.querySelectorAll('.parallax-text').forEach(function(t) {
      t.style.transform = 'rotateX(0) rotateY(0) translateZ(0)';
    });
  });
})();