/* qrdurian shared grid behaviours (muller-brockmann-grid skill).
   Linked by the marketing pages (404/about/looks). Safe no-op if a page has
   no .guides / no display elements. */
(function () {
  // ---- grid overlay toggle: button + 'G' key ----
  var btn = document.getElementById('gridToggle');
  function setGrid(on) {
    document.body.classList.toggle('grid-on', on);
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var l = btn.querySelector('.lbl'); if (l) l.textContent = on ? 'Hide grid' : 'Show grid';
    }
  }
  if (btn) btn.addEventListener('click', function () { setGrid(!document.body.classList.contains('grid-on')); });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'g' || e.key === 'G') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      setGrid(!document.body.classList.contains('grid-on'));
    }
  });

  // ---- populate every overlay's numbered column fields ----
  document.querySelectorAll('.guides .cols').forEach(function (h) {
    if (h.childElementCount) return;
    var n = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cols').trim() || '12', 10);
    for (var i = 1; i <= n; i++) {
      var c = document.createElement('div'); c.className = 'col';
      var s = document.createElement('span'); s.textContent = i; c.appendChild(s); h.appendChild(c);
    }
  });

  // ---- OPTICAL ALIGNMENT: shift display type so its INK (not its box) lands
  //      on the column line. Uses the actually-loaded font; re-runs on resize. ----
  var cvs = document.createElement('canvas'), ctx = cvs.getContext('2d');
  var SEL = '.masthead, .numeral, .h-display, .h-section';
  function align() {
    document.querySelectorAll(SEL).forEach(function (el) {
      el.style.marginLeft = '0px';
      var cs = getComputedStyle(el), ch = (el.textContent || '').trim().charAt(0); if (!ch) return;
      if (cs.textTransform === 'uppercase') ch = ch.toUpperCase();
      ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      ctx.textAlign = 'left';
      var abl = ctx.measureText(ch).actualBoundingBoxLeft;
      if (isFinite(abl)) el.style.marginLeft = abl.toFixed(2) + 'px';
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(align);
  align();
  var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(align, 120); });
})();
