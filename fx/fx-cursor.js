/*
  fx-cursor.js — свой курсор и «магнитные» кнопки.
  Что делает:
  • маленькая чёрная точка идёт точно за мышкой, вокруг неё — тонкое кольцо, которое мягко догоняет;
  • над бутылкой в ряду кольцо вырастает, заливается цветом вкуса и пишет «выбрать»;
  • над большой бутылкой — чёрный круг «тяни», пока крутишь — «360°»;
  • над ссылками, кнопками и карточками кольцо чуть увеличивается;
  • кнопки и ссылки в шапке слегка тянутся к курсору и пружинят обратно.
  Работает только с мышкой. На телефонах и при «уменьшении движения» модуль выключен.
  Обычный курсор прячется только над бутылками и только пока модуль жив (класс fxc-on на <html>).
*/
(function () {
  'use strict';
  const SH = window.SHORO; if (!SH) return;

  try {
    if (SH.reduced) return;
    const mq = window.matchMedia ? window.matchMedia('(hover:hover) and (pointer:fine)') : null;
    if (!mq || !mq.matches) return;

    /* ================= НАСТРОЙКИ ================= */
    const CFG = {
      DOT: 8,                 // диаметр точки, px
      BASE: 96,               // базовый диаметр диска (самое большое состояние), px
      BORDER: 1.5,            // толщина кольца, px
      SIZE: { def: 38, link: 58, slot: 96, hit: 86, drag: 70 },   // диаметр кольца по состояниям
      PRESS: 0.84,            // во сколько раз кольцо сжимается при нажатии
      FOLLOW: 16,             // скорость догоняния кольца (больше — плотнее к мышке)
      FOLLOW_BIG: 22,         // то же для больших состояний с подписью
      SIZE_K: 300, SIZE_C: 26,        // пружина размера кольца (жёсткость / затухание)
      INK: '#121212',
      TINT: 'rgba(18,18,18,.07)',     // лёгкая заливка над ссылками
      TINT_INV: 'rgba(255,255,255,.16)', // над тёмной плиткой
      MAG_MAX: 8,             // максимум смещения магнитной кнопки, px
      MAG_PULL: 0.32,         // доля расстояния до курсора
      MAG_MARGIN: 14,         // запас вокруг кнопки, px
      MAG_K: 210, MAG_C: 22,  // пружина магнита
      SLOT_MAX_P: 0.28,       // дальше этого прогресса ряд бутылок уже не кликается
      HIT_MIN_P: 0.9,         // с этого прогресса большую бутылку можно крутить
      STALL_MS: 1500,         // если кадры остановились — вернуть обычный курсор
      LABEL: { slot: 'выбрать', hit: 'тяни', drag: '360°' },
    };
    const CLS = 'fxc-on';
    const LINK_SEL = 'a,button,.btn,.tile,.good,[role="button"]';
    const MAG_SEL = '.btn,nav .links a';
    /* ============================================= */

    const B = CFG.BASE, HB = B / 2, HD = CFG.DOT / 2;
    SH.css('fx-cursor', `
      .fxc{position:fixed;left:0;top:0;width:0;height:0;z-index:200;pointer-events:none;opacity:0;transition:opacity .35s ease;-webkit-user-select:none;user-select:none}
      .fxc[data-v="1"]{opacity:1}
      .fxc-dot,.fxc-ring{position:absolute;left:0;top:0;width:0;height:0;will-change:transform}
      .fxc-dot i{position:absolute;left:-${HD}px;top:-${HD}px;width:${CFG.DOT}px;height:${CFG.DOT}px;border-radius:50%;background:${CFG.INK};transition:transform .45s cubic-bezier(.16,1,.3,1),opacity .22s ease}
      .fxc[data-d="1"] .fxc-dot i{transform:scale(.6)}
      .fxc:not([data-s="def"]) .fxc-dot i{transform:scale(0);opacity:0}
      .fxc-disc{position:absolute;left:-${HB}px;top:-${HB}px;width:${B}px;height:${B}px;border-radius:50%;background-color:transparent;
        box-shadow:inset 0 0 0 var(--fxc-bw,${CFG.BORDER}px) var(--fxc-bc,${CFG.INK});transform:scale(.02);transition:background-color .35s ease;will-change:transform}
      .fxc-lab{position:absolute;left:-70px;top:-8px;width:140px;height:16px;text-align:center;color:#fff;font-family:var(--sans);font-size:10.5px;line-height:16px;font-weight:800;
        letter-spacing:.14em;text-indent:.14em;text-transform:uppercase;white-space:nowrap;opacity:0;transform:scale(.6);transition:opacity .18s ease,transform .5s cubic-bezier(.16,1,.3,1)}
      .fxc[data-s="slot"] .fxc-l-slot,.fxc[data-s="hit"] .fxc-l-hit,.fxc[data-s="drag"] .fxc-l-drag{opacity:1;transform:none;transition:opacity .3s ease .06s,transform .7s cubic-bezier(.16,1,.3,1) .04s}
      html.${CLS} .hero .slot,html.${CLS} .stage .hit,html.${CLS} .stage .hit.grab{cursor:none}
    `);

    /* ---------- элементы ---------- */
    const mk = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
    const root = mk('div', 'fxc'); root.setAttribute('aria-hidden', 'true'); root.dataset.s = 'def'; root.dataset.v = '0';
    const ring = mk('div', 'fxc-ring', root);
    const disc = mk('div', 'fxc-disc', ring);
    ['slot', 'hit', 'drag'].forEach(n => { mk('div', 'fxc-lab fxc-l-' + n, ring).textContent = CFG.LABEL[n]; });
    const dot = mk('div', 'fxc-dot', root); mk('i', '', dot);
    SH.els.body.appendChild(root);

    const html = SH.els.root, hit = SH.els.hit;

    /* ---------- состояние ---------- */
    let active = false, vis = false, stalled = false, down = false, dragging = false;
    let mx = 0, my = 0, rx = 0, ry = 0, forceRing = false;
    let size = 2, sv = 0, sizeDrawn = -1;
    let st = 'def', sarg = null, lastFrame = 0, probeT = 0, scrollT = 0, scrolled = false;

    function apply() {
      const live = active && !stalled;
      html.classList.toggle(CLS, live && vis);          // свой курсор не виден — обычный возвращается
      const v = live && vis ? '1' : '0';
      if (root.dataset.v !== v) root.dataset.v = v;
    }

    function setState(name, arg) {
      if (arg === undefined) arg = null;
      if (st === name && sarg === arg) return;
      st = name; sarg = arg; root.dataset.s = name;
      let bg = 'transparent', bc = CFG.INK;
      if (name === 'slot') { bg = bc = (SH.FL[arg] && SH.FL[arg].color) || CFG.INK; }
      else if (name === 'hit' || name === 'drag') { bg = bc = CFG.INK; }
      else if (name === 'link') { if (arg) { bg = CFG.TINT_INV; bc = '#fff'; } else bg = CFG.TINT; }
      disc.style.backgroundColor = bg;
      disc.style.setProperty('--fxc-bc', bc);
    }

    // по элементу под мышкой решаем, как выглядит курсор
    function pick(t) {
      if (dragging) return;
      const s = SH.s;
      if (!t || !t.closest || s.busy) return setState('def');
      const sl = t.closest('button.slot');
      if (sl && s.ready) { const k = +sl.dataset.k; if (k >= 0 && k < SH.FL.length) return setState('slot', k); }
      if (t === hit) return setState('hit');
      const a = t.closest(LINK_SEL);
      if (a) return setState('link', a.closest('.tile') ? 1 : 0);
      setState('def');
    }
    function probe() {
      if (!active || !vis || dragging) return;
      let el = null; try { el = document.elementFromPoint(mx, my); } catch (e) {}
      pick(el);
    }
    function probeSoon(ms) { clearTimeout(probeT); probeT = setTimeout(probe, ms || 90); }

    /* ---------- магнитные кнопки ---------- */
    const mags = [], tpCache = new WeakMap();
    function engage(el) {
      const par = el.parentElement;
      if (par && par.classList.contains('reveal') && !par.classList.contains('in')) return;   // ещё не появилась — не трогаем
      let m = null;
      for (let i = 0; i < mags.length; i++) if (mags[i].el === el) { m = mags[i]; break; }
      const fixed = !!el.closest('nav');
      let w, hgt, ccx, ccy;
      if (fixed) {
        // шапка может в этот момент выезжать/уезжать (transform) — берём место по раскладке, без трансформаций
        let x = 0, y = 0, e = el; while (e) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
        w = el.offsetWidth; hgt = el.offsetHeight; ccx = x + w / 2; ccy = y + hgt / 2;
      } else {
        if (!m) {   // кнопка ещё доезжает после появления — не обрываем её движение
          try {
            const ct = getComputedStyle(el).transform;
            if (ct && ct !== 'none') {
              const n = ct.replace(/^[^(]*\(|\)$/g, '').split(',');
              const big = n.length === 16;
              if (Math.abs(+n[big ? 12 : 4]) > .5 || Math.abs(+n[big ? 13 : 5]) > .5) return;
            }
          } catch (err) {}
        }
        const r = el.getBoundingClientRect();
        w = r.width; hgt = r.height;
        ccx = r.left + w / 2 - (m ? m.x : 0); ccy = r.top + hgt / 2 - (m ? m.y : 0);
      }
      if (!w || !hgt) return;
      if (!m) {
        m = { el, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, drawn: '', patched: false };
        // у .btn в CSS есть transition на transform — на время магнита выключаем только его
        let tp = tpCache.get(el);
        if (tp === undefined) {
          tp = null;
          try { const c = getComputedStyle(el).transitionProperty || ''; if (/\btransform\b/.test(c)) tp = c.replace(/\btransform\b/g, 'fxc-off'); } catch (e) {}
          tpCache.set(el, tp);
        }
        if (tp) { el.style.transitionProperty = tp; m.patched = true; }
        mags.push(m);
      }
      m.on = true;
      m.cx = ccx; m.cy = ccy;
      m.hw = w / 2; m.hh = hgt / 2;
      m.fixed = fixed; m.sy = window.scrollY;
    }
    function release(m) {
      m.el.style.transform = '';
      if (m.patched) m.el.style.transitionProperty = '';
    }
    function stepMags(s) {
      const h = s.dt / 2, sy = window.scrollY;
      for (let i = mags.length - 1; i >= 0; i--) {
        const m = mags[i];
        if (m.on) {
          const px = mx - m.cx, py = my - (m.fixed ? m.cy : m.cy + m.sy - sy);
          if (s.busy || !vis || Math.abs(px) > m.hw + CFG.MAG_MARGIN || Math.abs(py) > m.hh + CFG.MAG_MARGIN) { m.on = false; m.tx = m.ty = 0; }
          else { m.tx = SH.clamp(px * CFG.MAG_PULL, -CFG.MAG_MAX, CFG.MAG_MAX); m.ty = SH.clamp(py * CFG.MAG_PULL, -CFG.MAG_MAX, CFG.MAG_MAX); }
        }
        for (let n = 0; n < 2; n++) {
          m.vx += ((m.tx - m.x) * CFG.MAG_K - m.vx * CFG.MAG_C) * h; m.x += m.vx * h;
          m.vy += ((m.ty - m.y) * CFG.MAG_K - m.vy * CFG.MAG_C) * h; m.y += m.vy * h;
        }
        if (!m.on && Math.abs(m.x) < .05 && Math.abs(m.y) < .05 && Math.abs(m.vx) < .5 && Math.abs(m.vy) < .5) {
          release(m); mags.splice(i, 1); continue;
        }
        const tr = `translate3d(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px,0)`;
        if (tr !== m.drawn) { m.drawn = tr; m.el.style.transform = tr; }
      }
    }
    function dropMags() { for (let i = 0; i < mags.length; i++) { mags[i].on = false; mags[i].tx = mags[i].ty = 0; } }

    /* ---------- мышь ---------- */
    const isMouse = e => e.pointerType === 'mouse';

    window.addEventListener('pointermove', e => {
      if (!isMouse(e)) return;
      mx = e.clientX; my = e.clientY;
      const now = performance.now();
      if (!active) { active = true; lastFrame = now; rx = mx; ry = my; forceRing = true; vis = true; pick(e.target); apply(); }
      else if (!vis) { vis = true; rx = mx; ry = my; forceRing = true; size = Math.min(size, 8); sv = 0; pick(e.target); apply(); }
      if (!stalled && !document.hidden && now - lastFrame > CFG.STALL_MS) { stalled = true; apply(); }   // кадры встали — отдать обычный курсор
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
    }, { passive: true });

    document.addEventListener('pointerover', e => {
      if (!isMouse(e)) return;
      const t = e.target;
      pick(t);
      if (active && !dragging && !SH.s.busy && t && t.closest) { const m = t.closest(MAG_SEL); if (m) engage(m); }
    }, { passive: true });

    const leave = () => { if (!vis) return; vis = false; down = false; root.dataset.d = '0'; apply(); };
    document.addEventListener('pointerout', e => { if (isMouse(e) && !e.relatedTarget && !dragging) leave(); }, { passive: true });
    document.addEventListener('mouseleave', () => { if (!dragging) leave(); });
    window.addEventListener('blur', () => { down = false; root.dataset.d = '0'; });

    window.addEventListener('pointerdown', e => {
      if (!isMouse(e)) { leave(); return; }          // пальцем — свой курсор не нужен
      down = true; root.dataset.d = '1';
    }, { capture: true, passive: true });
    const up = e => { if (e && e.pointerType && !isMouse(e)) return; down = false; root.dataset.d = '0'; };
    window.addEventListener('pointerup', up, { capture: true, passive: true });
    window.addEventListener('pointercancel', up, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => { lastFrame = performance.now(); });

    /* ---------- события ядра ---------- */
    SH.on('drag:start', () => { if (!active || !vis) return; dragging = true; setState('drag'); });
    SH.on('drag:end', () => {
      if (!dragging) return; dragging = false;
      if (mx < 0 || my < 0 || mx >= SH.s.W || my >= SH.s.H) { setState('def'); leave(); return; }   // отпустили за окном
      probe();
    });
    SH.on('open:start', () => { setState('def'); dropMags(); });
    SH.on('open:end', () => probeSoon(120));
    SH.on('settle', () => probeSoon(60));
    SH.on('section', () => probeSoon(160));
    SH.on('resize', () => { dropMags(); probeSoon(200); });

    /* ---------- кадр ---------- */
    SH.on('frame', s => {
      lastFrame = performance.now();
      if (stalled) { stalled = false; apply(); }
      if (!active) return;

      // состояние не должно «залипать», если страница уехала под неподвижной мышкой
      if (st === 'slot') { if (s.busy || s.P > CFG.SLOT_MAX_P) setState('def'); }
      else if (st === 'hit') { if (s.busy || !s.show || s.P < CFG.HIT_MIN_P) setState('def'); }
      else if (st === 'drag') { if (!dragging) setState('def'); }
      if (dragging && !s.dragging) { dragging = false; probeSoon(60); }   // ядро уже отпустило, а событие не дошло

      // страница едет под неподвижной мышкой: изредка (не в кадре) перепроверяем, что под курсором
      if (vis && !dragging) {
        if (Math.abs(s.vel) > 12) {
          scrolled = true;
          if (!scrollT) scrollT = setTimeout(() => { scrollT = 0; probe(); }, 140);
        } else if (scrolled) { scrolled = false; probeSoon(90); }
      }
      else if (st === 'link') { if (s.busy) setState('def'); }

      // кольцо мягко догоняет мышку
      const dx = mx - rx, dy = my - ry;
      if (forceRing || dx * dx + dy * dy > .0009) {
        if (forceRing) { rx = mx; ry = my; forceRing = false; }
        else {
          const k = 1 - Math.exp(-s.dt * (st === 'def' || st === 'link' ? CFG.FOLLOW : CFG.FOLLOW_BIG));
          rx += dx * k; ry += dy * k;
          if (Math.abs(mx - rx) < .04 && Math.abs(my - ry) < .04) { rx = mx; ry = my; }
        }
        ring.style.transform = `translate3d(${rx.toFixed(2)}px,${ry.toFixed(2)}px,0)`;
      }

      // размер кольца — пружина
      const tgt = CFG.SIZE[st] * (down && st !== 'drag' ? CFG.PRESS : 1);
      if (Math.abs(tgt - size) > .03 || Math.abs(sv) > .05) {
        const h = s.dt / 2;
        for (let n = 0; n < 2; n++) { sv += ((tgt - size) * CFG.SIZE_K - sv * CFG.SIZE_C) * h; size += sv * h; }
        if (size < 2) { size = 2; sv = 0; }
      } else if (size !== tgt) { size = tgt; sv = 0; }
      if (Math.abs(size - sizeDrawn) > .02) {
        sizeDrawn = size;
        disc.style.transform = `scale(${(size / B).toFixed(4)})`;
        disc.style.setProperty('--fxc-bw', Math.min(HB, CFG.BORDER * B / size).toFixed(2) + 'px');   // толщина линии не меняется при масштабе
      }

      if (mags.length) stepMags(s);
    });
  } catch (err) {
    try { document.documentElement.classList.remove('fxc-on'); } catch (e) {}
    console.error('[fx-cursor]', err);
  }
})();
