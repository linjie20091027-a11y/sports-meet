// ═══════════════════════════════════════
// Aceternity UI 3D Card — 完整复刻
// ═══════════════════════════════════════
(function() {
  'use strict';

  // 初始化所有3D卡片
  function init3DCards() {
    var containers = document.querySelectorAll('.card-3d-container');
    containers.forEach(function(container) {
      // 跳过已初始化的
      if (container.dataset.init3d === 'true') return;
      container.dataset.init3d = 'true';

      var body = container.querySelector('.card-3d-body');
      if (!body) {
        body = document.createElement('div');
        body.className = 'card-3d-body';
        while (container.firstChild) body.appendChild(container.firstChild);
        container.appendChild(body);
      }

      // 拆分子元素为不同深度的card-item
      var children = body.children;
      var items = [];
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.classList.contains('card-3d-item')) continue;
        var wrapper = document.createElement('div');
        wrapper.className = 'card-3d-item';
        wrapper.style.transform = 'translateZ(' + (20 + i * 15) + 'px)';
        child.parentNode.insertBefore(wrapper, child);
        wrapper.appendChild(child);
        items.push(wrapper);
      }
    });

    // 添加hover light effect
    var bodies = document.querySelectorAll('.card-3d-body');
    bodies.forEach(function(body) {
      if (body.dataset.hasLight === 'true') return;
      body.dataset.hasLight = 'true';
      var light = document.createElement('div');
      light.className = 'card-3d-light';
      body.appendChild(light);
    });
  }

  // 鼠标跟踪
  var targetMap = new WeakMap();
  var currentMap = new WeakMap();

  document.addEventListener('mousemove', function(e) {
    var cards = document.querySelectorAll('.card-3d-container');
    cards.forEach(function(card) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      
      var cx = rect.width / 2, cy = rect.height / 2;
      var rx = ((y - cy) / cy) * -12;
      var ry = ((x - cx) / cx) * 12;
      targetMap.set(card, { rx: rx, ry: ry, x: x, y: y });
    });
  });

  // Hover light effect
  document.addEventListener('mousemove', function(e) {
    var lights = document.querySelectorAll('.card-3d-light');
    lights.forEach(function(light) {
      var container = light.closest('.card-3d-container');
      if (!container) return;
      var rect = container.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        light.style.opacity = '0';
        return;
      }
      light.style.opacity = '.15';
      light.style.background = 'radial-gradient(600px circle at ' + x + 'px ' + y + 'px, rgba(255,255,255,.4), transparent 40%)';
    });
  });

  document.addEventListener('mouseleave', function() {
    document.querySelectorAll('.card-3d-light').forEach(function(l) {
      l.style.opacity = '0';
    });
  });

  // 平滑动画循环
  function smooth(current, target, factor) {
    return current + (target - current) * factor;
  }

  function animate() {
    var bodies = document.querySelectorAll('.card-3d-body');
    bodies.forEach(function(body) {
      var container = body.closest('.card-3d-container');
      if (!container) return;
      
      var target = targetMap.get(container);
      var current = currentMap.get(container) || { rx: 0, ry: 0 };
      
      if (target) {
        current.rx = smooth(current.rx, target.rx, 0.12);
        current.ry = smooth(current.ry, target.ry, 0.12);
      } else {
        current.rx = smooth(current.rx, 0, 0.08);
        current.ry = smooth(current.ry, 0, 0.08);
      }
      
      currentMap.set(container, current);
      body.style.transform = 'rotateX(' + current.rx + 'deg) rotateY(' + current.ry + 'deg)';
    });
    requestAnimationFrame(animate);
  }

  // 启动
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(init3DCards, 500);
    setTimeout(init3DCards, 1500);
    requestAnimationFrame(animate);
  });

  // 路由变化后重新初始化
  window.addEventListener('hashchange', function() {
    setTimeout(init3DCards, 500);
  });

  // 暴露API
  window.init3DCards = init3DCards;
})();
