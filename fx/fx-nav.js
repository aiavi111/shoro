/*
  fx-nav.js — навигация по вкусам.
  1) Рейка вкусов: четыре точки в цветах вкусов (справа на компьютере, внизу на телефоне).
     Активная точка вытягивается в «пилюлю», тонкая линия показывает, где мы сейчас. Нажатие — переход к вкусу.
  2) Листание: на экранах вкусов один жест (свайп по тачпаду, щелчок колеса, клавиша) = один вкус.
     Страницу везёт «мягкий доводчик»: трогается плавно, едет без рывков и длинно, мягко останавливается.
     Хвост инерции тачпада после жеста проглатывается и не утаскивает страницу дальше.
     Из последнего вкуса вниз (к «Где купить») и ниже — обычная свободная прокрутка.
     На телефоне палец двигает страницу сам; когда она остановилась между экранами, доводчик мягко довозит её до ближайшего.
  3) Клавиатура: стрелки, PageUp/PageDown и пробел листают экраны.
  4) Шапка прячется при прокрутке вниз и возвращается при прокрутке вверх или в покое.
*/
(() => {
  'use strict';
  const SH = window.SHORO; if (!SH) return;

  /* ---------- НАСТРОЙКИ (всё, что можно крутить, — здесь) ---------- */
  const CFG = {
    // рейка
    RAIL_FROM: .6,            // рейка видна, пока P между RAIL_FROM и RAIL_TO
    RAIL_TO: SH.N + .6,
    RAIL_HYST: .05,           // запас, чтобы рейка не мигала на границе
    // листание
    SNAP: true,               // выключить листание целиком (останется обычная прокрутка)
    SNAP_TOUCH: true,         // доводить после прокрутки пальцем
    PAGE_W: 7.2,              // «жёсткость» доводчика, 1/с: больше — быстрее доезжает (7.2 ≈ экран за 1.2 секунды)
    PAGE_W_FAR: .45,          // на сколько мягче ехать за каждый лишний экран пути (точки рейки, быстрые нажатия)
    PAGE_W_MAX: 16,           // предел жёсткости, когда страницу подхватываем на большой скорости
    PAGE_KICK: .25,           // 0 — совсем мягкий старт, 1 — резкий: какая доля хода начинается сразу
    STEP_PX: 40,              // столько пикселей жеста нужно, чтобы перелистнуть
    GEST_GAP_MS: 170,         // пауза между событиями колеса, после которой начинается новый жест
    RESWIPE_MS: 280,          // раньше этого повторный свайп не засчитывается (защита от двойного срабатывания)
    KEEP_MS: 900,             // слабые движения подряд (с паузами короче этого) складываются в один жест
    NOTCH: true,              // щелчок колеса обычной мыши сразу считать полным жестом (на Маке он всего несколько пикселей)
    ROLL_MS: 550,             // колесо мыши крутят не переставая: следующий шаг не раньше, чем через столько
    ROLL_KEEP: .8,            // ...и только если сила событий держится не ниже этой доли от пиковой (инерция тачпада затухает — она не пройдёт)
    ROLL_NEAR: .12,           // ...и когда до экрана осталась меньше этой доли пути
    FAR_MAX: 1.6,             // дальше этого (в экранах) от страницы цель не убегает при жестах
    FAR_MAX_KEY: 2.4,         // то же для клавиш (два быстрых нажатия = два экрана)
    MAGNET_MS: 240,           // пауза покоя, после которой страница, стоящая между экранами, доезжает до ближайшего
    SNAP_IDLE_TOUCH_MS: 260,  // то же после пальца (инерция телефона)
    SNAP_STILL_MS: 130,       // столько страница должна стоять на месте
    SNAP_VEL: 40,             // px/с: скорость, ниже которой считаем «остановился»
    SNAP_FREE_FROM: SH.N + .5,  // с этого P вниз не доводим никогда (свободный выход к «Где купить»)
    SNAP_COMMIT: .05,         // доля экрана, после которой едем дальше ПО направлению движения (.5 = строго к ближайшему)
    SNAP_MAX_TALL: 1.06,      // если экран вкуса выше окна более чем в столько раз — листание выключено (иначе текст не достать)
    SNAP_STUCK_MS: 900,       // если Lenis «завис» в состоянии прокрутки, а страница стоит — считаем, что стоит
    MOVE_EPS: .0004,          // изменение P, которое считается движением
    // клавиатура
    KEY_DUR: 1.2,             // сек: переход по клавише к «Где купить» (между вкусами везёт доводчик)
    // шапка
    NAV_FROM: .5,             // прятать шапку только при P выше этого
    NAV_DOWN_PX: 28,          // столько пикселей вниз — и шапка уезжает
    NAV_UP_PX: 10,            // столько вверх — возвращается
    NAV_MOVE_VEL: 50,         // px/с: быстрее — считаем прокруткой
    NAV_REST_VEL: 10,         // px/с: медленнее — считаем покоем
    NAV_REST_S: .4,           // сек покоя возле экрана — шапка возвращается
    NAV_REST_FAR_S: 1.2       // сек покоя где угодно (между экранами) — шапка тоже возвращается, чтобы не пропала насовсем
  };

  const E = SH.els, N = SH.N, clamp = SH.clamp;
  SH.navCfg = CFG;            // настройки видны снаружи: их можно подкрутить из консоли и из проверок
  const nowMs = () => performance.now();
  let dead = false;

  /* ---------- стили ---------- */
  SH.css('fx-nav', `
    #nav.fxn-nav{transition:background .4s,box-shadow .4s,padding .4s,transform .8s var(--ease)}
    #nav.fxn-nav.fxn-hide{transform:translate3d(0,-110%,0)}

    .fxn-rail{--fxn-step:34px;position:fixed;z-index:15;right:calc(var(--pad)/2 - 14px);top:50%;margin-top:calc(var(--fxn-step)*-${N / 2});
      display:flex;flex-direction:column;pointer-events:none;opacity:0;visibility:hidden;transform:translate3d(16px,0,0);
      transition:opacity .5s ease,transform .9s var(--ease),visibility 0s linear .5s}
    .fxn-rail.fxn-on{opacity:1;visibility:visible;transform:none;transition-delay:0s,0s,0s}
    .fxn-track{position:absolute;left:50%;width:2px;margin-left:-1px;top:calc(var(--fxn-step)/2);bottom:calc(var(--fxn-step)/2);background:rgba(18,18,18,.13);border-radius:1px;overflow:hidden}
    .fxn-fill{position:absolute;inset:0;display:block;background:rgba(18,18,18,.62);transform-origin:50% 0;transform:scaleY(0)}
    .fxn-dot{position:relative;display:block;flex:none;width:28px;height:var(--fxn-step);padding:0;-webkit-tap-highlight-color:transparent;outline:none}
    .fxn-rail.fxn-on .fxn-dot{pointer-events:auto}
    .fxn-pill{position:absolute;left:50%;top:50%;width:8px;height:26px;margin:-13px 0 0 -4px;background:var(--fxn-c);
      -webkit-clip-path:inset(9px 0 round 4px);clip-path:inset(9px 0 round 4px);
      transition:clip-path .8s var(--ease),-webkit-clip-path .8s var(--ease),transform .6s var(--ease)}
    .fxn-dot.fxn-act .fxn-pill{-webkit-clip-path:inset(0 0 round 4px);clip-path:inset(0 0 round 4px)}
    .fxn-lab{position:absolute;right:100%;top:50%;margin:1px 5px 0 0;font-family:var(--disp);font-weight:800;font-size:21px;line-height:1;letter-spacing:.03em;
      text-transform:uppercase;white-space:nowrap;color:var(--ink);pointer-events:none;opacity:0;transform:translate3d(10px,-50%,0);
      transition:opacity .35s ease,transform .7s var(--ease)}
    .fxn-dot.fxn-act .fxn-lab{opacity:1;transform:translate3d(0,-50%,0)}
    .fxn-dot:focus-visible{outline:2px solid var(--ink);outline-offset:-3px;border-radius:9px}
    .fxn-dot:focus-visible .fxn-lab{opacity:1;transform:translate3d(0,-50%,0)}
    @media (hover:hover) and (pointer:fine){
      .fxn-dot:not(.fxn-act):hover .fxn-pill{transform:scale(1.3)}
      .fxn-dot:not(.fxn-act):hover .fxn-lab{opacity:.5;transform:translate3d(0,-50%,0)}
    }

    .fxn-rail.fxn-m{--fxn-step:34px;right:auto;left:50%;top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 1px);margin:0 0 0 calc(var(--fxn-step)*-${N / 2});
      flex-direction:row;transform:translate3d(0,12px,0)}
    .fxn-rail.fxn-m.fxn-on{transform:none}
    .fxn-m .fxn-track{left:calc(var(--fxn-step)/2);right:calc(var(--fxn-step)/2);top:50%;bottom:auto;width:auto;height:2px;margin:-1px 0 0}
    .fxn-m .fxn-fill{transform-origin:0 50%;transform:scaleX(0)}
    .fxn-m .fxn-dot{width:var(--fxn-step);height:22px}
    .fxn-m .fxn-pill{width:20px;height:6px;margin:-3px 0 0 -10px;-webkit-clip-path:inset(0 7px round 3px);clip-path:inset(0 7px round 3px)}
    .fxn-m .fxn-dot.fxn-act .fxn-pill{-webkit-clip-path:inset(0 0 round 3px);clip-path:inset(0 0 round 3px)}
    .fxn-m .fxn-lab{display:none}
    ${SH.reduced ? '.fxn-rail,.fxn-pill,.fxn-lab,#nav.fxn-nav{transition:none!important}.fxn-rail{transform:none!important}' : ''}
  `);

  /* ---------- общее состояние ---------- */
  let lastMoveT = -1e9;       // когда страница последний раз реально сдвинулась
  let prevT = NaN;            // прошлое значение target
  let dir = 0;                // направление последнего движения страницы
  let touching = false, lastTouchT = -1e9, lastKeyT = -1e9;
  let prog = false, progEnd = 0;         // идёт программная прокрутка ядра (ссылки шапки, «наверх», клавиша к «Где купить»)
  let keyDest = -1;
  let canSnap = false;
  let nearest = false;        // после смены размера окна доводим строго к ближайшему экрану (направление тут ни при чём)
  let lastFrameT = nowMs();   // когда последний раз отработал кадр (чтобы отличать подвисание страницы от паузы человека)
  let stallT = -1e9, stallLen = 0;       // когда закончилось последнее подвисание и сколько оно длилось
  let armed = false;          // «магнит» работает только после действия человека (колесо, палец, клавиша, смена размера) — с полосой прокрутки не спорит
  let vy = 0;                 // скорость страницы, px/с (слегка сглаженная)
  let tops = [];              // верх каждого экрана: первый, вкусы, «Где купить»

  function measure(){
    let ok = CFG.SNAP && !!SH.lenis && !SH.reduced;
    if (ok){
      const H = SH.s.H || window.innerHeight;
      for (let i = 0; i <= N; i++){ if (E.secs[i] && E.secs[i].offsetHeight > H * CFG.SNAP_MAX_TALL){ ok = false; break; } }
    }
    canSnap = ok;
    tops = []; for (let i = 0; i <= N + 1; i++) tops.push(E.secs[i] ? E.secs[i].offsetTop : (tops[i - 1] || 0));
    if (pg.on){ if (ok) pg.Y = tops[pg.idx]; else pg.on = false; }
  }
  function progOf(y){                    // положение страницы (px) -> номер экрана с дробью, как P у ядра
    for (let i = 0; i <= N; i++){ const a = tops[i], b = tops[i + 1]; if (y < b && b > a) return i + Math.max(0, (y - a) / (b - a)); }
    return N + 1;
  }
  const pagerOK = () => canSnap && !dead && !!SH.s.ready && !!SH.lenis;

  /* ---------- b) мягкий доводчик ----------
     Три одинаковых «сглаживателя» подряд: цель -> y1 -> y2 -> y3, на экран идёт y3.
     У такой цепочки не скачут ни скорость, ни ускорение: старт с нуля мягкий, остановка длинная и без отскока,
     а цель можно поменять на ходу (второй свайп, разворот) — страница просто плавно поедет к новой. */
  const pg = {on:false, idx:0, Y:0, w:CFG.PAGE_W, y1:0, y2:0, y3:0, wrote:NaN};
  const pvel = () => pg.w * (pg.y2 - pg.y3);                                   // скорость, px/с
  const pacc = () => pg.w * (pg.w * (pg.y1 - pg.y2) - pvel());                 // ускорение
  const prime = (y, v, a, w) => { pg.w = w; pg.y3 = y; pg.y2 = y + v / w; pg.y1 = pg.y2 + (a / w + v) / w; };
  const wFor = screens => CFG.PAGE_W / (1 + CFG.PAGE_W_FAR * Math.max(0, screens - 1));
  function setY(y){                                                            // поставить страницу (дробные пиксели — движение без «ступенек»)
    const L = SH.lenis;
    if (L){ y = clamp(y, 0, L.limit > 0 ? L.limit : 1e9); L.animatedScroll = L.targetScroll = y; L.setScroll(y); L.preventNextNativeScrollEvent(); }
    else window.scrollTo(0, y);
    pg.wrote = y;
  }
  function stopPager(){ pg.on = false; }
  function pageTo(n, v0, why){                                                      // везти страницу к экрану n (0 — первый, 1..N — вкусы)
    if (!tops.length) measure();
    n = clamp(Math.round(n), 0, N);
    const Y = tops[n], H = SH.s.H || window.innerHeight;
    if (!(Y === Y)) return;
    if (pg.on){                                                                // уже едем: меняем цель на ходу, скорость и ускорение сохраняются
      if (n === pg.idx) return;
      const v = pvel(), a = pacc();
      pg.idx = n; pg.Y = Y; prime(pg.y3, v, a, wFor(Math.abs(Y - pg.y3) / H));
      SH.emit('page', {to:n, moving:true, why});
      return;
    }
    const y = window.scrollY, dist = Y - y;
    if (Math.abs(dist) < .5) return;
    const L = SH.lenis; if (L && L.reset){ try { L.reset(); } catch (e) {} }   // свою прокрутку Lenis бросает — дальше везу я
    let v = v0 == null ? vy : v0, w = wFor(Math.abs(dist) / H);
    if (v * dist < 0) v = clamp(v, -900, 900);                                 // ехали прочь от цели — плавно развернёмся
    else if (v){                                                               // ехали к цели: подхватываем на той же скорости, без перелёта
      const need = 2 * Math.abs(v) / Math.abs(dist);
      if (need > w) w = Math.min(need, CFG.PAGE_W_MAX);
      if (2 * Math.abs(v) / w > Math.abs(dist)) v = Math.sign(v) * Math.abs(dist) * w / 2;
    }
    pg.on = true; pg.idx = n; pg.Y = Y; pg.wrote = NaN; prime(y, v, 0, w);
    pg.y1 += (Y - pg.y1) * clamp(CFG.PAGE_KICK, 0, 1);
    prog = false; keyDest = -1;
    SH.emit('page', {to:n, moving:false, why});                                    // для других модулей и проверок: страница поехала к экрану n
  }
  function pagerStep(s){
    if (!pg.on) return;
    if (s.busy || !SH.lenis){ pg.on = false; return; }
    // страницу сдвинул кто-то другой (полоса прокрутки, сам браузер) — уступаю, а не тяну обратно
    if (pg.wrote === pg.wrote && Math.abs(s.sy - pg.wrote) > 3){ pg.on = false; lastKeyT = nowMs(); return; }
    const x = pg.w * s.dt, e = Math.exp(-x), d1 = pg.y1 - pg.Y, d2 = pg.y2 - pg.Y, d3 = pg.y3 - pg.Y;
    pg.y1 = pg.Y + d1 * e; pg.y2 = pg.Y + (d2 + x * d1) * e; pg.y3 = pg.Y + (d3 + x * d2 + x * x / 2 * d1) * e;   // точное решение, не зависит от частоты кадров
    if (Math.abs(pg.y3 - pg.Y) < .3 && Math.abs(pvel()) < 6){ pg.y3 = pg.Y; pg.on = false; }
    setY(pg.y3);
  }

  /* ---------- a) рейка вкусов ---------- */
  let rail = null, fill = null, dots = [], railOn = false, railAct = -1, fillK = -1, railM = false;
  try {
    rail = document.createElement('div');
    rail.className = 'fxn-rail';
    rail.setAttribute('role', 'navigation');
    rail.setAttribute('aria-label', 'Вкусы');
    const track = document.createElement('div'); track.className = 'fxn-track'; track.setAttribute('aria-hidden', 'true');
    fill = document.createElement('i'); fill.className = 'fxn-fill'; track.appendChild(fill);
    rail.appendChild(track);
    for (let k = 0; k < N; k++){                               // точки — экраны выбранного вкуса
      const F = SH.FL[SH.s.sel || 0], nm = k === 0 ? F.name : k === 1 ? 'Вкус' : 'Когда';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fxn-dot'; b.style.setProperty('--fxn-c', F.color);
      b.setAttribute('aria-label', nm);
      const p = document.createElement('span'); p.className = 'fxn-pill';
      const l = document.createElement('span'); l.className = 'fxn-lab'; l.setAttribute('aria-hidden', 'true'); l.textContent = nm;
      b.appendChild(p); b.appendChild(l);
      b.addEventListener('click', () => {
        const s = SH.s; if (s.busy || !s.ready || !railOn) return;
        if (!E.scenes[k]) return;
        if (pagerOK()) pageTo(k + 1); else SH.goTo(E.scenes[k].offsetTop, {duration:1.4});
      });
      rail.appendChild(b); dots.push(b);
    }
    SH.on('flavor', e => {                                     // выбрали другой вкус — рейка в его цвете
      const F = SH.FL[e.k]; if (!F) return;
      dots.forEach((b, i) => { b.style.setProperty('--fxn-c', F.color); if (!i){ b.setAttribute('aria-label', F.name); const l = b.querySelector('.fxn-lab'); if (l) l.textContent = F.name; } });
    });
    railM = !!SH.s.mobile; rail.classList.toggle('fxn-m', railM);
    document.body.appendChild(rail);
  } catch (e) { rail = null; }

  function railStep(s){
    if (!rail) return;
    const lo = CFG.RAIL_FROM - (railOn ? CFG.RAIL_HYST : 0), hi = CFG.RAIL_TO + (railOn ? CFG.RAIL_HYST : 0);
    const on = s.ready && !s.busy && s.P > lo && s.P < hi;
    if (on !== railOn){ railOn = on; rail.classList.toggle('fxn-on', on); }
    if (!on) return;
    const a = clamp(Math.round(s.P) - 1, 0, N - 1);
    if (a !== railAct){
      railAct = a;
      for (let i = 0; i < dots.length; i++){
        dots[i].classList.toggle('fxn-act', i === a);
        if (i === a) dots[i].setAttribute('aria-current', 'true'); else dots[i].removeAttribute('aria-current');
      }
    }
    const k = Math.round(clamp((s.P - 1) / (N - 1), 0, 1) * 1000) / 1000;
    if (k !== fillK){ fillK = k; fill.style.transform = railM ? `scaleX(${k})` : `scaleY(${k})`; }
  }

  /* ---------- d) шапка прячется ---------- */
  const nav = E.nav, canHide = !!nav && !SH.reduced;
  let navHidden = false, navAcc = 0, navRest = 0, navFocus = false;
  if (nav){
    nav.classList.add('fxn-nav');
    nav.addEventListener('focusin', () => { navFocus = true; });
    nav.addEventListener('focusout', () => { navFocus = false; });
  }
  function setNav(hide){ if (hide !== navHidden){ navHidden = hide; nav.classList.toggle('fxn-hide', hide); } }
  function navStep(s){
    if (!canHide) return;
    let hide = navHidden;
    if (s.busy || !s.ready || navFocus || s.P <= CFG.NAV_FROM){ hide = false; navAcc = 0; navRest = 0; }
    else {
      const v = s.vel, av = Math.abs(v);
      if (av < CFG.NAV_REST_VEL){
        navAcc = 0; navRest += s.dt;
        if (navRest > CFG.NAV_REST_S && (navRest > CFG.NAV_REST_FAR_S || Math.abs(s.target - Math.round(s.target)) < .03)) hide = false;
      } else {
        navRest = 0;
        if (av > CFG.NAV_MOVE_VEL){
          if ((v > 0) !== (navAcc > 0)) navAcc = 0;
          navAcc += v * s.dt;
          if (navAcc > CFG.NAV_DOWN_PX) hide = true; else if (navAcc < -CFG.NAV_UP_PX) hide = false;
        }
      }
    }
    setNav(hide);
  }

  /* ---------- жесты колеса и тачпада ---------- */
  // один жест = непрерывная серия событий колеса. Тачпад после свайпа ещё секунду-две шлёт затухающую инерцию —
  // это всё тот же жест, второй раз он страницу не листает.
  const G = {t:-1e9, acc:0, peak:0, hi:0, low:0, dec:false, rise:0, dir:0, used:false, free:false, notch:false, stepT:-1e9, q:[], why:''};
  const med5 = q => { const m = q.slice().sort((x, y) => x - y); return m[m.length >> 1]; };
  const newGesture = keepAcc => { if (!keepAcc) G.acc = 0; G.peak = 0; G.hi = 0; G.low = 0; G.dec = false; G.rise = 0; G.used = false; G.free = false; G.notch = false; };
  function step(d, why){
    const y = window.scrollY, H = SH.s.H || window.innerHeight;
    let base;
    if (pg.on) base = pg.idx;
    else { const p = progOf(y); base = Math.abs(p - Math.round(p)) < .02 ? Math.round(p) : (d > 0 ? Math.floor(p) : Math.ceil(p)); }
    const n = clamp(base + d, 0, N);
    if (pg.on && Math.abs(tops[n] - pg.y3) / H > (G.notch ? CFG.FAR_MAX_KEY : CFG.FAR_MAX)) return;   // цель и так далеко — дальше не убегаем
    pageTo(n, null, why);
  }
  function wheelFilter(d){                                   // true — событие идёт в обычную прокрутку; false — я его забрал
    const e = d && d.event;
    if (!e || e.type !== 'wheel' || !pagerOK() || SH.s.busy) return true;
    if (e.ctrlKey || e.metaKey) return true;                 // масштаб жестом — не наше
    armed = true;
    const dy = +d.deltaY || 0, a = Math.abs(dy), sg = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    // время берём у самого события (когда его создала система), а не «когда дошли руки»: если страница на миг подвисла,
    // события приходят пачкой, и по времени обработки один свайп выглядел бы как два
    const now = e.timeStamp > 0 ? e.timeStamp : nowMs();
    const gap = now - G.t;
    // щелчок колеса обычной мыши (не тачпад): прокрутка идёт «строками», либо шаг колеса кратен 120 и не равен утроенной прокрутке.
    // У мыши на Маке медленный щелчок — всего несколько пикселей, поэтому один щелчок сразу считаем полным жестом.
    const wd = +e.wheelDeltaY || 0;
    const notch = CFG.NOTCH && (e.deltaMode === 1 || (Math.abs(wd) >= 120 && wd % 120 === 0 && Math.abs(wd + (+e.deltaY || 0) * 3) > 2));
    // если страница сама подвисла (кадры не шли), события за это время не могли дойти: такую паузу жестом не считаем
    const wall = nowMs();
    const blocked = Math.max(0, wall - lastFrameT - 40, wall - stallT < 150 ? stallLen : 0);
    let fresh = gap - blocked > CFG.GEST_GAP_MS, flip = false;                                      // была пауза — новый жест
    if (!fresh && sg && G.dir && sg !== G.dir && a > 4){ fresh = true; flip = true; }               // развернулись — новый жест
    // слабые движения в ту же сторону с короткими паузами складываются (иначе осторожная прокрутка «не срабатывает»)
    if (fresh){
      newGesture(!flip && !G.used && !G.free && sg !== 0 && sg === G.dir && gap < CFG.KEEP_MS); G.q.length = 0; G.why = flip ? 'разворот' : 'жест';
      if (!flip) G.dir = 0;                                  // после паузы направление определяем заново (иначе первый же заметный сдвиг выглядел бы «разворотом»)
    }
    // «сила» события в пикселях за кадр; берём середину из пяти последних — тачпад иногда шлёт события пачкой или рвано,
    // и одиночный выброс не должен выглядеть как новый рывок
    G.q.push(a * 16.7 / (fresh ? 16.7 : clamp(gap, 8, 400))); if (G.q.length > 5) G.q.shift();
    const r = med5(G.q);
    // новый свайп поверх затухающей инерции: сила сначала упала в разы, а потом два события подряд явно выше
    if (!fresh && G.used){
      if (G.dec && r > Math.max(G.low * 2 + 3, 6)) G.rise++; else G.rise = 0;
      if (G.rise >= 2 && now - G.stepT > CFG.RESWIPE_MS){ newGesture(false); G.why = 'новый свайп'; }
    }
    G.t = now; if (sg && (a > 4 || !G.dir)) G.dir = sg;
    if (notch) G.notch = true;
    if (r > G.peak) G.peak = r;
    // спад подтверждают два слабых события подряд (r2), а не середина из пяти: быстрый повторный свайп даёт короткий провал
    const qn = G.q.length, r2 = qn > 1 ? Math.max(G.q[qn - 1], G.q[qn - 2]) : r;
    if (!G.dec){ if (r > G.hi){ G.hi = r; G.low = r; } else if (r2 < G.low){ G.low = r2; if (r2 < G.hi * .4) G.dec = true; } }
    else if (r2 < G.low) G.low = r2;
    if (SH.navDbg) SH.navDbg({t:now, a:dy, r, fresh, flip, used:G.used, acc:G.acc, hi:G.hi, low:G.low, dec:G.dec, rise:G.rise, why:G.why, notch, on:pg.on, idx:pg.idx});
    // жест уже отпущен в свободную прокрутку; но если страницу тем временем повёз доводчик (клавиша, точка) — хвост жеста не мешает
    if (G.free){ if (!pg.on) return true; e.preventDefault(); return false; }
    const y = window.scrollY, H = SH.s.H || window.innerHeight, last = tops[N];
    if (!pg.on && y > last + 1.5) return true;               // ниже последнего вкуса — обычная прокрутка
    // с последнего вкуса новым жестом вниз — к «Где купить», свободно
    if (sg > 0 && !G.used && (pg.on ? pg.idx === N && Math.abs(pg.Y - pg.y3) < H * .2 : y >= last - 1.5)){
      stopPager(); G.free = true; return true;
    }
    if (Math.abs(+d.deltaX || 0) > a * 1.5){ if (dy) e.preventDefault(); return false; }   // жест вбок — не листаем (и «назад» в браузере не ломаем)
    e.preventDefault();
    G.acc += notch ? sg * Math.max(a, CFG.STEP_PX) : dy;
    if (!G.used){
      if (Math.abs(G.acc) >= CFG.STEP_PX){ G.used = true; G.stepT = now; step(G.acc > 0 ? 1 : -1, G.why || 'жест'); }
    } else if ((G.notch || r >= Math.max(G.peak * CFG.ROLL_KEEP, 24)) && now - G.stepT > CFG.ROLL_MS && (!pg.on || Math.abs(pg.Y - pg.y3) < H * CFG.ROLL_NEAR)){
      // колесо мыши крутят не переставая: сила событий не падает (у инерции тачпада к этому моменту она уже заметно упала)
      if (sg > 0 && !pg.on && y >= last - 1.5){ G.free = true; return true; }
      G.stepT = now; step(sg, 'колесо без остановки');
    }
    return false;
  }
  (() => {
    const L = SH.lenis; if (!L || !L.options) return;
    const prev = L.options.virtualScroll;
    L.options.virtualScroll = d => {
      let pass = true;
      try { pass = wheelFilter(d); } catch (e) { dead = true; console.error('[fx-nav]', e); }
      if (pass === false) return false;
      return typeof prev === 'function' ? prev(d) : true;
    };
  })();

  // прокрутка снизу (из «Где купить») въезжает на последний вкус: дальше мягко довожу сам, жест считается использованным
  function takeoverStep(s){
    const L = SH.lenis;
    if (!pagerOK() || s.busy || prog || touching || L.isScrolling !== 'smooth') return;
    if (s.now - G.t > 320 || G.dir >= 0) return;
    const last = tops[N];
    if (+L.targetScroll < last - .5 && s.sy > last - (s.H || window.innerHeight) * .35){ G.used = true; G.free = false; G.stepT = s.now; pageTo(N, null, 'подхват снизу'); }
  }
  // страница стоит между экранами (после пальца, смены размера окна, клавиш Home/End) — довезти до экрана
  function magnetStep(s){
    if (!armed || !pagerOK() || s.busy || s.dragging || touching || prog) return;
    const now = s.now, L = SH.lenis;
    if (now - G.t < CFG.MAGNET_MS || now - lastKeyT < CFG.MAGNET_MS || now - lastTouchT < CFG.SNAP_IDLE_TOUCH_MS) return;
    if (now - lastMoveT < CFG.SNAP_STILL_MS || Math.abs(s.iv) > CFG.SNAP_VEL) return;
    if (L.isScrolling && now - lastMoveT < CFG.SNAP_STUCK_MS) return;                 // Lenis ещё что-то везёт
    if (!CFG.SNAP_TOUCH && now - lastTouchT < 4000) return;
    const y = s.sy, p = progOf(y);
    if (p >= CFG.SNAP_FREE_FROM) return;                                              // ниже последнего вкуса — свобода
    if (dir > 0 && !nearest && y > tops[N] + 1.5) return;                             // ушли вниз с последнего вкуса — обратно не тянем
    const base = Math.floor(p), f = p - base, c = clamp(CFG.SNAP_COMMIT, .001, .5);
    let n;
    if (nearest || !dir) n = Math.round(p);
    else if (dir > 0) n = f > c ? base + 1 : base;
    else n = f < 1 - c ? base : base + 1;
    nearest = false; armed = false;
    if (n < 0 || n > N || Math.abs(y - tops[n]) < 1) return;                          // к «Где купить» не тянем; уже на месте — тоже
    pageTo(n, null, 'магнит');
  }

  /* ---------- c) клавиатура ---------- */
  const SCROLL_KEYS = {ArrowDown:1, ArrowUp:1, PageDown:1, PageUp:1, ' ':1, Spacebar:1, Home:1, End:1};
  function onKey(e){
    if (dead || e.defaultPrevented) return;
    const key = e.key;
    if (!SCROLL_KEYS[key]) return;
    const el = e.target, tag = el && el.tagName ? el.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
    const isSpace = key === ' ' || key === 'Spacebar';
    // пробел на кнопке/ссылке — это нажатие, его не трогаем; стрелки листают и с фокусом на кнопке (иначе после клика по бутылке клавиши бы «умирали»)
    if (isSpace && el && el.closest && el.closest('button,a,summary,[role="button"]')) return;
    const mod = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;
    let d = 0;
    if (!mod){ if (key === 'ArrowDown' || key === 'PageDown' || isSpace) d = 1; else if (key === 'ArrowUp' || key === 'PageUp') d = -1; }
    const s = SH.s, now = nowMs();
    const native = () => { lastKeyT = now; armed = true; stopPager(); prog = false; keyDest = -1; nearest = false; };   // дальше листает сам браузер
    if (!d || !s.ready){ native(); return; }
    if (s.busy){ e.preventDefault(); return; }                 // во время анимации выбора вкуса страницу не двигаем
    const secs = E.secs, last = secs.length - 1, t = s.target;
    let n;
    if (pg.on) n = pg.idx + d;                                                 // быстрые нажатия подряд — от точки назначения
    else if (keyDest >= 0 && prog && now < progEnd) n = keyDest + d;
    else n = d > 0 ? Math.floor(t + .02) + 1 : Math.ceil(t - .02) - 1;
    if (d < 0 && t >= last - .001 && !pg.on && !(prog && keyDest >= 0)){
      if (window.scrollY > secs[last].offsetTop + 2){ native(); return; }     // внутри «Где купить»/мерча — обычная прокрутка
      n = last - 1;
    }
    if (n > last || n < 0 || !secs[n]){ native(); return; }                   // дальше — пусть листает браузер
    e.preventDefault();
    if (e.repeat) return;                                                      // зажатая клавиша не «пролистывает» всё подряд
    lastKeyT = now; nearest = false;
    if (n <= N && pagerOK()){
      if (pg.on && Math.abs(tops[n] - pg.y3) / (s.H || window.innerHeight) > CFG.FAR_MAX_KEY) return;
      pageTo(n);
    } else {
      stopPager(); keyDest = n;
      SH.goTo(secs[n].offsetTop, {duration:CFG.KEY_DUR});      // ядро сообщит о программной прокрутке событием goto
    }
  }

  /* ---------- слушатели ---------- */
  window.addEventListener('touchstart', () => { if (dead) return; touching = true; armed = true; lastTouchT = nowMs(); stopPager(); prog = false; keyDest = -1; nearest = false; }, {passive:true});
  window.addEventListener('touchmove', () => { if (dead) return; lastTouchT = nowMs(); }, {passive:true});
  const touchEnd = e => { if (dead) return; touching = !!(e.touches && e.touches.length); lastTouchT = nowMs(); };
  window.addEventListener('touchend', touchEnd, {passive:true});
  window.addEventListener('touchcancel', touchEnd, {passive:true});
  window.addEventListener('keydown', onKey);

  SH.on('ready', measure);
  SH.on('resize', r => {
    if (dead) return;
    if (rail && r && r.mobile !== railM){ railM = !!r.mobile; rail.classList.toggle('fxn-m', railM); fillK = -1; }
    // окно поменяло размер: если стояли на экране вкуса — остаёмся на нём же (высота экранов изменилась, а прокрутка в пикселях — нет)
    const was = tops.length && !pg.on ? progOf(window.scrollY) : NaN;
    measure();
    if (!canSnap || !SH.s.ready || SH.s.busy) return;
    const k = Math.round(was);
    if (was === was && k <= N && Math.abs(was - k) < .03 && !touching && nowMs() - lastTouchT > 600){
      if (Math.abs(window.scrollY - tops[k]) > .5) setY(tops[k]);
    } else { nearest = true; armed = true; lastKeyT = nowMs() + 250; }      // иначе — доехать до ближайшего, но не сразу
  });
  SH.on('goto', g => {                                         // ядро везёт страницу само (ссылки шапки, «наверх») — не мешаю
    if (dead) return;
    stopPager();
    const o = (g && g.o) || {};
    prog = true; progEnd = nowMs() + (o.immediate ? 0 : (+o.duration || 1.6) * 1000) + 300;
  });
  SH.on('open:start', () => { stopPager(); prog = false; keyDest = -1; });
  SH.on('open:end', () => { prevT = NaN; navAcc = 0; });

  SH.on('frame', s => {
    if (dead) return;
    try {
      const now = s.now, t = s.target;
      { const w = nowMs(); if (w - lastFrameT > 100){ stallT = w; stallLen = w - lastFrameT; } lastFrameT = w; }
      if (prevT === prevT){ const dT = t - prevT; if (Math.abs(dT) > CFG.MOVE_EPS){ lastMoveT = now; dir = dT > 0 ? 1 : -1; } }
      else lastMoveT = now;
      prevT = t;
      vy += ((s.iv || 0) - vy) * (1 - Math.exp(-s.dt / .04));
      if (prog && now > progEnd){ prog = false; keyDest = -1; }
      railStep(s);
      navStep(s);
      pagerStep(s);
      if (!pg.on){ takeoverStep(s); if (!pg.on) magnetStep(s); }
    } catch (e) {
      dead = true;                                             // при любой ошибке модуль выключается, шапка остаётся на месте, прокрутка — обычная
      try { if (nav) nav.classList.remove('fxn-hide'); if (rail) rail.classList.remove('fxn-on'); } catch (e2) {}
      console.error('[fx-nav]', e);
    }
  });

  measure();
})();
