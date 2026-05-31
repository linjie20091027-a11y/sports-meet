  // ═══ 照片墙 ═══
  function initPhotoGallery() {
    var grid = document.getElementById('photo-grid');
    if (!grid || grid.children.length > 0) return;
    var imgs = ['0004586eaa50d954336ab68301ce5e40_1000X1000.jpg','002327a10861834c31972579540361b1_1000X1000.jpg','00d7247112096fd0cc0a5f0be2e4535f_1000X1000.jpg','04ab21e9bfe342cb2e577b4114899fc9_1000X1000.jpg','073fced8b4c334c60ac9c3e0575fe709_1000X1000.jpg','08cdc1479f4817482d2db2903af8985f_1000X1000.jpg','09b494cbde6b08bc587ebf3a56357676_1000X1000.jpg','09be5444eeec785c24b5a557998c1cb9_1000X1000.JPG','0a654df58e13a13492249840dd9c1b51_1000X1000.jpg','0a6c7096b72f99190a87954674dc41fa_1000X1000.jpg','0ae7cdb8eff0c44a04516e628233cb91_1000X1000.jpg','0b2701d31354bbc317d63b677a202c7e_1000X1000.jpg','0bc169e31f4c251f7ca4c80b5f54ea97_1000X1000.jpg','0c23b8cd223dda660162eb3d43618fc5_1000X1000.jpg','0e9dd006e52ae6033ee8d7c464f0a37d_1000X1000.jpg','07fec7138eee60f994b88ad0d35c4029_1000X1000.jpg','015e3a6dd3fd45e4a79e66e6e468de10_1000X1000.jpg','0b440164cb85ce273442117132bdc90e.png'];
    var html = '';
    imgs.forEach(function(img) {
      html += '<a href="/images/'+img+'" target="_blank"><img src="/images/'+img+'" alt="" loading="lazy"></a>';
    });
    grid.innerHTML = html;
  }
  setTimeout(initPhotoGallery, 1000);