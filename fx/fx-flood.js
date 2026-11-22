/* Жидкая заливка.
   Цвет вкуса разливается по экрану не ровным кругом, а живой «каплей» с волнистым краем.
   При клике по бутылке от неё расходятся две тонкие волны. */
(() => {
  'use strict';
  const SH = window.SHORO; if (!SH) return;
  if (SH.reduced) return;                                   // без движения остаётся обычный круг
  const { clamp, smooth } = SH;

  /* ---------- настройки ---------- */
  const CFG = {
    points: 64, pointsMobile: 44,   // сколько точек у контура
    ampScroll: 0.075,               // «волнистость» края при прокрутке (доля радиуса)
    ampClick: 0.095,                // то же при клике
    ringMs: 1050,                   // длительность волны от клика
  };
  // несколько бегущих волн разной частоты: [частота, вес, скорость (рад/мс)]
  const WAVES = [[2, 0.46, 0.00055], [3, 0.30, -0.00085], [5, 0.16, 0.0013], [7, 0.08, -0.0019]];

  let n = 0, cosT = [], sinT = [], parts = [];
  const tables = count => {
    n = count; cosT = new Array(n); sinT = new Array(n); parts = new Array(n);
    for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; cosT[j] = Math.cos(a); sinT[j] = Math.sin(a); }
  };
  tables(SH.s.mobile ? CFG.pointsMobile : CFG.points);
  SH.on('resize', e => { const c = e.mobile ? CFG.pointsMobile : CFG.points; if (c !== n) tables(c); });

  SH.hooks.clip = (x, y, r, o) => {
    const R = o.R;
    if (r <= 0.5) return `circle(0px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
    if (r >= R - 1) return 'inset(0px)';                     // экран залит целиком — без щелей
    // край спокойный в самом начале и к концу, живой в середине
    const env = smooth(0, R * 0.14, r) * (1 - smooth(R * 0.66, R * 0.97, r));
    const amp = (o.kind === 'click' ? CFG.ampClick : CFG.ampScroll) * env;
    if (amp < 0.002) return `circle(${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
    const t = o.now * (o.kind === 'click' ? 1.7 : 1);
    for (let j = 0; j < n; j++) {
      const a = j / n * Math.PI * 2;
      let w = 0;
      for (let m = 0; m < WAVES.length; m++) w += WAVES[m][1] * Math.sin(WAVES[m][0] * a + t * WAVES[m][2] + m * 1.3);
      const rr = r * (1 + amp * w);
      parts[j] = (x + cosT[j] * rr).toFixed(1) + 'px ' + (y + sinT[j] * rr).toFixed(1) + 'px';
    }
    return 'polygon(' + parts.join(',') + ')';
  };

  /* ---------- волны от клика ---------- */
  SH.css('fx-flood', `
    .fxf-ring{position:fixed;left:var(--fxf-x);top:var(--fxf-y);width:24px;height:24px;border-radius:50%;pointer-events:none;z-index:8;box-sizing:border-box;
      transform:translate(-50%,-50%);border:1.5px solid var(--fxf-c,#121212);opacity:0;animation:fxf-ring var(--fxf-ms,1050ms) cubic-bezier(.16,1,.3,1) both}
    @keyframes fxf-ring{0%{width:24px;height:24px;opacity:.7}100%{width:var(--fxf-d);height:var(--fxf-d);opacity:0}}
  `);
  SH.on('open:flood', e => {
    const far = Math.hypot(Math.max(e.x, SH.s.W - e.x), Math.max(e.y, SH.s.H - e.y));
    for (let i = 0; i < 2; i++) {
      const ring = document.createElement('div'); ring.className = 'fxf-ring';
      ring.style.setProperty('--fxf-c', e.color); ring.style.setProperty('--fxf-x', e.x.toFixed(1) + 'px'); ring.style.setProperty('--fxf-y', e.y.toFixed(1) + 'px');
      ring.style.setProperty('--fxf-d', (far * 2 * (i ? 0.8 : 1.05)).toFixed(0) + 'px'); ring.style.setProperty('--fxf-ms', CFG.ringMs + 'ms');
      ring.style.animationDelay = (i * 150) + 'ms';
      (SH.els.flood && SH.els.flood.parentNode ? SH.els.flood.parentNode : document.body).insertBefore(ring, SH.els.flood ? SH.els.flood.nextSibling : null);
      const kill = () => ring.remove();
      ring.addEventListener('animationend', kill); setTimeout(kill, CFG.ringMs + 600);
    }
  });
})();
