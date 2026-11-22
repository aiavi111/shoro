/*
  fx-sections.js — блоки «Где купить» и «Мерч» (префикс fxs)
  Что делает модуль:
  1) бегущая строка с названиями вкусов в начале блока «Где купить»: едет сама,
     а при прокрутке ускоряется и меняет направление вслед за скроллом;
  2) плитки «Где купить»: наклон за курсором и мягкий светлый блик, появление «шторкой»;
  3) карточки мерча: фото чуть отстаёт от страницы при прокрутке (параллакс),
     при наведении приближается и слегка наклоняется за курсором;
  4) кнопка «наверх ↑» в подвале.
  На телефонах наклон отключён (параллакс остаётся). При «уменьшении движения» всё статично.
*/
(function () {
  'use strict';
  const SH = window.SHORO; if (!SH) return;

  /* ================= НАСТРОЙКИ (можно менять) ================= */
  const CFG = {
    MQ_BASE: 46,          // бегущая строка: базовая скорость, px/с (влево)
    MQ_BASE_MOBILE: 30,   // то же на телефоне
    MQ_VEL: 0.32,         // сколько скорости скролла добавляется к строке
    MQ_MAX: 900,          // предел добавки от скролла, px/с
    MQ_EASE: 3.2,         // как быстро строка возвращается к базовой скорости (больше = быстрее)
    TILT_MAX: 6,          // плитки: максимальный наклон, градусы
    TILT_EASE: 7,         // плитки: плавность следования за курсором
    TILT_PERSP: 900,      // плитки: перспектива, px
    TILT_SHIFT: 6,        // плитки: сдвиг текста внутри, px (глубина)
    TILT_LIFT: 0.012,     // плитки: лёгкое увеличение при наведении
    GLOW_SIZE: 1.35,      // блик: диаметр относительно большей стороны плитки
    GLOW_ALPHA: 0.16,     // блик: прозрачность белого в центре
    PAR: 4,               // мерч: параллакс фото, % высоты (в каждую сторону)
    IMG_BASE: 1.10,       // мерч: базовый масштаб фото (запас под параллакс)
    IMG_ZOOM: 0.08,       // мерч: приближение при наведении
    IMG_LEAN: 2,          // мерч: наклон фото за курсором, градусы
    IMG_SHIFT: 1,         // мерч: сдвиг фото за курсором, %
    IMG_INTRO: 0.08,      // мерч: дополнительный масштаб при появлении (плавно уходит)
    IMG_EASE: 5,          // мерч: плавность наведения
    TOP_DURATION: 1.8     // кнопка «наверх»: длительность прокрутки, с
  };
  /* ============================================================ */

  const doc = document;
  const buy = doc.getElementById('buy');
  const merch = doc.getElementById('merch');
  const footer = doc.querySelector('footer');
  const motion = !SH.reduced;
  const fineMq = window.matchMedia ? window.matchMedia('(hover:hover) and (pointer:fine)') : { matches: false };
  const hasIO = 'IntersectionObserver' in window;
  const clamp = SH.clamp;

  SH.css('fx-fxs', `
    .fxs-mq{position:relative;overflow:hidden;margin:-5vh calc(var(--pad)*-1) 7vh;padding:.07em 0 .03em;font-size:clamp(56px,11vw,170px);pointer-events:none;user-select:none;-webkit-user-select:none;contain:layout paint;transition:opacity 1s ease,transform 1.3s var(--ease)}
    .fxs-mq.fxs-wait{opacity:0;transform:translateY(24px)}
    .fxs-mq-track{display:flex;width:max-content;will-change:transform}
    .fxs-mq-unit{display:flex;align-items:center;flex:none}
    .fxs-mq-w{font-family:var(--disp);font-weight:800;text-transform:uppercase;line-height:.9;white-space:nowrap;color:rgba(18,18,18,.11)}
    .fxs-mq-w.fxs-o{color:#fff;-webkit-text-stroke:3px rgba(18,18,18,.22);paint-order:stroke fill}
    .fxs-mq-d{flex:none;width:.085em;height:.085em;border-radius:50%;margin:0 .27em}
    .fxs-tw{display:flex;min-width:0}
    .fxs-tw>.tile{flex:1 1 auto;width:100%;min-width:0;isolation:isolate;backface-visibility:hidden;-webkit-backface-visibility:hidden;clip-path:inset(0 0 0 0 round 24px);transition:background .5s,color .5s,clip-path 1.25s var(--ease) calc(var(--i,0)*110ms + .12s)}
    .fxs-tw>.tile.fxs-pre{clip-path:inset(100% 0 0 0 round 24px)}
    .fxs-tw>.tile.fxs-done{clip-path:none;transition:background .5s,color .5s}
    .fxs-glow{position:absolute;left:0;top:0;width:10px;height:10px;z-index:-1;border-radius:50%;pointer-events:none;opacity:0;background:radial-gradient(closest-side,rgba(255,255,255,${CFG.GLOW_ALPHA}),rgba(255,255,255,0));will-change:transform,opacity}
    .fxs-in{will-change:transform}
    .good.fxs-good .ph img{transition:none;will-change:transform;transform:scale(${CFG.IMG_BASE})}
    .fxs-top{margin-left:auto;display:inline-flex;align-items:center;gap:.55em;padding:8px 0;margin-top:-8px;margin-bottom:-8px;color:var(--muted);transition:color .35s}
    .fxs-top i{font-style:normal;letter-spacing:0;display:inline-block;transition:transform .6s var(--ease)}
    .fxs-top:focus-visible{outline:1.5px solid var(--ink);outline-offset:4px;border-radius:4px}
    @media (hover:hover) and (pointer:fine){
      .fxs-top:hover{color:var(--ink)}
      .fxs-top:hover i{transform:translateY(-4px)}
    }
    @media (max-width:759px){
      .fxs-mq{margin:-3vh -18px 5vh}
      .fxs-tw>.tile{clip-path:inset(0 0 0 0 round 20px)}
      .fxs-tw>.tile.fxs-pre{clip-path:inset(100% 0 0 0 round 20px)}
    }
    @media (prefers-reduced-motion:reduce){
      .fxs-mq,.fxs-top i{transition:none}
    }
  `);

  /* ---------- a) бегущая строка ---------- */
  const mq = { el: null, track: null, units: [], unitW: 0, x: 0, v: CFG.MQ_BASE, vis: !hasIO, wait: false };

  function makeUnit() {
    const u = doc.createElement('div'); u.className = 'fxs-mq-unit';
    SH.FL.forEach((F, i) => {
      const w = doc.createElement('span'); w.className = 'fxs-mq-w' + (i % 2 === 0 ? ' fxs-o' : ''); w.textContent = F.name;
      const d = doc.createElement('span'); d.className = 'fxs-mq-d'; d.style.background = F.color;
      u.appendChild(w); u.appendChild(d);
    });
    return u;
  }
  function setUnits(n) {
    while (mq.units.length < n) { const u = makeUnit(); mq.track.appendChild(u); mq.units.push(u); }
    while (mq.units.length > n) { mq.track.removeChild(mq.units.pop()); }
  }
  function buildMarquee() {
    if (!buy) return;
    const el = doc.createElement('div'); el.className = 'fxs-mq'; el.setAttribute('aria-hidden', 'true');
    const track = doc.createElement('div'); track.className = 'fxs-mq-track';
    el.appendChild(track);
    mq.el = el; mq.track = track;
    setUnits(3);
    buy.insertBefore(el, buy.firstChild);
    if (motion && hasIO) {
      el.classList.add('fxs-wait'); mq.wait = true;
      const io = new IntersectionObserver(es => {
        for (let i = 0; i < es.length; i++) {
          mq.vis = es[i].isIntersecting;
          if (mq.vis) showMarquee();
        }
      }, { threshold: 0 });
      io.observe(el);
    }
  }
  function showMarquee() { if (mq.wait) { mq.wait = false; mq.el.classList.remove('fxs-wait'); } }
  function measureMarquee() {
    if (!mq.track || mq.units.length < 2) return;
    const w = mq.units[1].offsetLeft - mq.units[0].offsetLeft;
    if (!(w > 10)) return;
    mq.unitW = w;
    const vw = SH.s.W || doc.documentElement.clientWidth || 1200;
    setUnits(clamp(Math.ceil(vw / w) + 1, 2, 12));
    mq.x = -(((-mq.x) % w + w) % w);
    mq.track.style.transform = 'translate3d(' + mq.x.toFixed(2) + 'px,0,0)';
  }

  /* ---------- b) плитки ---------- */
  const tiles = [];
  let tilesBox = null, tilesPre = false;

  function buildTiles() {
    if (!buy || !motion) return;
    tilesBox = buy.querySelector('.tiles'); if (!tilesBox) return;
    const list = Array.prototype.slice.call(tilesBox.querySelectorAll('.tile'));
    list.forEach((el, i) => {
      // обёртка забирает на себя появление от ядра (.reveal>*), сама плитка остаётся свободной для наклона
      const wrap = doc.createElement('div'); wrap.className = 'fxs-tw'; wrap.style.setProperty('--i', i);
      el.parentNode.insertBefore(wrap, el); wrap.appendChild(el);
      el.style.setProperty('--i', i);
      const glow = doc.createElement('span'); glow.className = 'fxs-glow'; glow.setAttribute('aria-hidden', 'true');
      el.insertBefore(glow, el.firstChild);
      const inner = el.querySelector(':scope > div'); if (inner) inner.classList.add('fxs-in');
      const t = { el, wrap, glow, inner, left: 0, pageTop: 0, w: 1, h: 1, g: 10, tx: 0, ty: 0, x: 0, y: 0, ta: 0, a: 0, live: false, on: false };
      tiles.push(t);
      // слушаем обёртку, а не саму плитку: у наклонённой плитки край уходит из-под курсора, и наклон начинал бы дрожать
      wrap.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse' || !fineMq.matches || SH.s.busy) return;
        const r = wrap.getBoundingClientRect();
        t.left = r.left; t.pageTop = r.top + window.scrollY; t.w = Math.max(1, r.width); t.h = Math.max(1, r.height);
        const g = Math.round(Math.max(t.w, t.h) * CFG.GLOW_SIZE);
        if (g !== t.g) { t.g = g; glow.style.width = g + 'px'; glow.style.height = g + 'px'; }
        t.on = true; t.ta = 1; t.live = true; point(t, e);
      });
      wrap.addEventListener('pointermove', e => { if (t.on) point(t, e); });
      const leave = () => { t.on = false; t.ta = 0; t.tx = 0; t.ty = 0; };
      wrap.addEventListener('pointerleave', leave);
      wrap.addEventListener('pointercancel', leave);
    });
    if (tiles.length) { tiles.forEach(t => t.el.classList.add('fxs-pre')); tilesPre = true; }
  }
  function point(t, e) {
    t.tx = clamp(((e.clientX - t.left) / t.w) * 2 - 1, -1, 1);
    t.ty = clamp(((e.clientY - (t.pageTop - window.scrollY)) / t.h) * 2 - 1, -1, 1);
  }
  function revealTiles() {
    if (!tilesPre) return; tilesPre = false;
    tiles.forEach(t => t.el.classList.remove('fxs-pre'));
    setTimeout(() => tiles.forEach(t => t.el.classList.add('fxs-done')), 2400);
  }
  function frameTiles(dt) {
    const k = 1 - Math.exp(-dt * CFG.TILT_EASE);
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i]; if (!t.live) continue;
      t.x += (t.tx - t.x) * k; t.y += (t.ty - t.y) * k; t.a += (t.ta - t.a) * k;
      if (!t.on && Math.abs(t.x) < .003 && Math.abs(t.y) < .003 && t.a < .004) {
        t.x = t.y = t.a = 0; t.live = false;
        t.el.style.transform = ''; t.glow.style.opacity = '0';
        if (t.inner) t.inner.style.transform = '';
        continue;
      }
      t.el.style.transform = 'perspective(' + CFG.TILT_PERSP + 'px) rotateX(' + (-t.y * CFG.TILT_MAX).toFixed(3) + 'deg) rotateY(' + (t.x * CFG.TILT_MAX).toFixed(3) + 'deg) scale(' + (1 + CFG.TILT_LIFT * t.a).toFixed(4) + ')';
      const gx = (t.x * .5 + .5) * t.w - t.g / 2, gy = (t.y * .5 + .5) * t.h - t.g / 2;
      t.glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      t.glow.style.opacity = t.a.toFixed(3);
      if (t.inner) t.inner.style.transform = 'translate3d(' + (t.x * CFG.TILT_SHIFT).toFixed(2) + 'px,' + (t.y * CFG.TILT_SHIFT).toFixed(2) + 'px,0)';
    }
  }

  /* ---------- c) мерч ---------- */
  const goods = [];
  let goodsBox = null, goodsVis = !hasIO, introOn = false;

  function buildGoods() {
    if (!merch || !motion) return;
    goodsBox = merch.querySelector('.goods'); if (!goodsBox) return;
    Array.prototype.forEach.call(goodsBox.querySelectorAll('.good'), (el, i) => {
      const ph = el.querySelector('.ph'), img = ph && ph.querySelector('img'); if (!img) return;
      el.classList.add('fxs-good');
      const g = { el, ph, img, i, cy: 0, h: 1, left: 0, w: 1, on: false, ta: 0, a: 0, tx: 0, x: 0, intro: 1, at: 0, last: '' };
      goods.push(g);
      el.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse' || !fineMq.matches) return;
        const r = el.getBoundingClientRect(); g.left = r.left; g.w = Math.max(1, r.width);
        g.on = true; g.ta = 1; g.tx = clamp(((e.clientX - g.left) / g.w) * 2 - 1, -1, 1);
      });
      el.addEventListener('pointermove', e => { if (g.on) g.tx = clamp(((e.clientX - g.left) / g.w) * 2 - 1, -1, 1); });
      const leave = () => { g.on = false; g.ta = 0; g.tx = 0; };
      el.addEventListener('pointerleave', leave);
      el.addEventListener('pointercancel', leave);
    });
    if (hasIO && goods.length) {
      const io = new IntersectionObserver(es => { for (let i = 0; i < es.length; i++) goodsVis = es[i].isIntersecting; }, { rootMargin: '30% 0px 30% 0px', threshold: 0 });
      io.observe(goodsBox);
    }
  }
  function measureGoods() {
    for (let i = 0; i < goods.length; i++) {
      const g = goods[i]; let y = 0, e = g.ph;
      while (e) { y += e.offsetTop; e = e.offsetParent; }      // позиция на странице без учёта анимаций
      g.h = Math.max(1, g.ph.offsetHeight); g.cy = y + g.h / 2;
    }
  }
  function frameGoods(s) {
    if (!introOn && (goodsBox.classList.contains('in') || (goodsVis && s.P > 4.98))) {
      introOn = true;
      for (let i = 0; i < goods.length; i++) goods[i].at = s.now + 120 + goods[i].i * 110;
    }
    if (!goodsVis) return;
    const sy = window.scrollY, H = s.H || window.innerHeight, k = 1 - Math.exp(-s.dt * CFG.IMG_EASE), ki = 1 - Math.exp(-s.dt * 2.4);
    for (let i = 0; i < goods.length; i++) {
      const g = goods[i];
      g.a += (g.ta - g.a) * k; g.x += (g.tx - g.x) * k;
      if (introOn && s.now >= g.at && g.intro > 0) { g.intro += (0 - g.intro) * ki; if (g.intro < .002) g.intro = 0; }
      const d = clamp((g.cy - (sy + H / 2)) / (H * .5 + g.h * .5), -1, 1);
      const sc = CFG.IMG_BASE + CFG.IMG_ZOOM * g.a + CFG.IMG_INTRO * g.intro;
      const str = 'translate3d(' + (g.x * g.a * CFG.IMG_SHIFT).toFixed(2) + '%,' + (-d * CFG.PAR).toFixed(2) + '%,0) rotate(' + (g.x * g.a * CFG.IMG_LEAN).toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
      if (str !== g.last) { g.last = str; g.img.style.transform = str; }
    }
  }

  /* ---------- d) кнопка «наверх» ---------- */
  function buildTop() {
    if (!footer) return;
    const b = doc.createElement('button'); b.type = 'button'; b.className = 'cap fxs-top';
    b.setAttribute('aria-label', 'Наверх');
    b.innerHTML = 'наверх <i aria-hidden="true">↑</i>';
    b.addEventListener('click', () => { if (SH.s.busy) return; SH.goTo(0, { duration: CFG.TOP_DURATION }); });
    footer.appendChild(b);
  }

  /* ---------- сборка ---------- */
  const safe = (fn, undo) => { try { fn(); } catch (e) { console.error('[fx-sections]', e); if (undo) { try { undo(); } catch (e2) {} } } };
  safe(buildMarquee, () => { if (mq.el) mq.el.classList.remove('fxs-wait'); mq.wait = false; });
  safe(buildTiles, () => { tilesPre = false; tiles.forEach(t => t.el.classList.remove('fxs-pre')); });
  safe(buildGoods);
  safe(buildTop);

  function measure() { safe(measureMarquee); safe(measureGoods); }
  let mT = 0;
  const measureSoon = () => { clearTimeout(mT); mT = setTimeout(measure, 160); };
  measure();
  SH.on('ready', () => { measure(); setTimeout(measure, 2600); });
  SH.on('resize', measureSoon);
  if ('ResizeObserver' in window) { try { new ResizeObserver(measureSoon).observe(doc.body); } catch (e) {} }   // высота страницы изменилась — позиции карточек тоже

  if (motion) {
    SH.on('frame', s => {
      const dt = s.dt || 0;
      // запасной выход: контент не должен остаться скрытым
      if (tilesPre && (tilesBox.classList.contains('in') || s.P > 4.9)) revealTiles();
      if (mq.wait && s.P > 4.9) showMarquee();

      if (mq.vis && mq.unitW > 0 && dt > 0) {
        const base = s.mobile ? CFG.MQ_BASE_MOBILE : CFG.MQ_BASE;
        const boost = s.busy ? 0 : clamp(s.vel * CFG.MQ_VEL, -CFG.MQ_MAX, CFG.MQ_MAX);
        mq.v += (base + boost - mq.v) * (1 - Math.exp(-dt * CFG.MQ_EASE));
        mq.x -= mq.v * dt;
        if (mq.x <= -mq.unitW) mq.x += mq.unitW; else if (mq.x > 0) mq.x -= mq.unitW;
        if (mq.x <= -mq.unitW || mq.x > 0) mq.x = 0;
        mq.track.style.transform = 'translate3d(' + mq.x.toFixed(2) + 'px,0,0)';
      }
      if (tiles.length) frameTiles(dt);
      if (goods.length) frameGoods(s);
    });
  }
})();
