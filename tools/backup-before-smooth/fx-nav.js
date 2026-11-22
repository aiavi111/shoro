/*
  fx-nav.js — навигация по вкусам.
  1) Рейка вкусов: четыре точки в цветах вкусов (справа на компьютере, внизу на телефоне).
     Активная точка вытягивается в «пилюлю», тонкая линия показывает, где мы сейчас. Нажатие — переход к вкусу.
  2) Доводка: когда человек перестал крутить страницу, она сама мягко доезжает до ближайшего экрана,
     чтобы бутылка всегда стояла этикеткой вперёд. Из последнего вкуса вниз (к «Где купить») — свободно.
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
    RAIL_TO: 4.6,
    RAIL_HYST: .05,           // запас, чтобы рейка не мигала на границе
    DOT_DUR: 1.4,             // сек: переход по нажатию на точку
    // доводка
    SNAP: true,               // выключить доводку целиком
    SNAP_TOUCH: true,         // доводка после прокрутки пальцем
    SNAP_IDLE_MS: 160,        // пауза после последнего движения колеса/клавиши
    SNAP_IDLE_TOUCH_MS: 260,  // то же после пальца (инерция телефона)
    SNAP_STILL_MS: 130,       // столько страница должна стоять на месте
    SNAP_VEL: 40,             // px/с: скорость, ниже которой считаем «остановился» (палец, смена размера окна)
    SNAP_VEL_WHEEL: 1500,     // px/с: после колеса доводка подхватывает страницу на ходу, если она едет не быстрее этого
    WHEEL_TAIL_PX: 5,         // движения колеса/тачпада мельче этого после рывка считаем затухающей инерцией
    SNAP_LOCK: true,          // пока идёт доводка, новые движения колеса не «перелистывают» ещё один вкус
    SNAP_MIN: .01,            // ближе этого к экрану — уже не доводим
    SNAP_FREE_FROM: 4.5,      // с этого P вниз не доводим никогда (свободный выход к «Где купить»)
    SNAP_COMMIT: .05,         // доля экрана, после которой едем дальше ПО направлению жеста (.5 = строго к ближайшему)
    SNAP_DUR_MIN: .7,         // сек: длительность доводки (короче для малых расстояний)
    SNAP_DUR_MAX: 1.05,
    SNAP_MAX_TALL: 1.06,      // если экран вкуса выше окна более чем в столько раз — доводка выключена (иначе текст не достать)
    SNAP_STUCK_MS: 900,       // если Lenis «завис» в состоянии прокрутки, а страница стоит — считаем, что стоит
    MOVE_EPS: .0004,          // изменение P, которое считается движением
    // клавиатура
    KEY_DUR: 1.2,             // сек: переход по клавише
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
  let lastInput = -1e9;       // когда человек последний раз что-то делал (колесо, палец, клавиша)
  let lastMoveT = -1e9;       // когда страница последний раз реально сдвинулась
  let prevT = NaN;            // прошлое значение target
  let dir = 0;                // направление последнего движения страницы
  let armed = false;          // доводка разрешена только после действия человека (защита от петель)
  let touching = false, touchMode = false;
  let snapping = false, snapEnd = 0;     // идёт моя доводка
  let prog = false, progEnd = 0;         // идёт мой переход (точка / клавиша)
  let keyDest = -1;
  let canSnap = false;
  let nearest = false;        // после смены размера окна доводим строго к ближайшему экрану (направление жеста тут ни при чём)

  const stopGlide = () => {              // оборвать мою анимацию прокрутки на месте
    const L = SH.lenis;
    if (L && (snapping || prog)){ try { L.scrollTo(window.scrollY, {immediate:true}); } catch (e) {} }
  };
  function userInput(kind){
    if (kind === 'wheel' && snapping && CFG.SNAP_LOCK) return;   // доводка уже везёт к вкусу — колесо подождёт
    lastInput = nowMs();
    touchMode = kind === 'touch';
    if (kind === 'touch' && (snapping || prog)) stopGlide();   // палец на экране — страница его
    snapping = false; prog = false; keyDest = -1;
    nearest = false;
    armed = canSnap;
  }
  function measure(){
    let ok = CFG.SNAP && !!SH.lenis && !SH.reduced;
    if (ok){
      const H = SH.s.H || window.innerHeight;
      for (let i = 0; i <= N; i++){ if (E.secs[i] && E.secs[i].offsetHeight > H * CFG.SNAP_MAX_TALL){ ok = false; break; } }
    }
    canSnap = ok; if (!ok) armed = false;
    tops = []; for (let i = 0; i <= N + 1; i++) tops.push(E.secs[i] ? E.secs[i].offsetTop : (tops[i - 1] || 0));
  }
  let tops = [];
  function progOf(y){                    // положение страницы (px) -> номер экрана с дробью, как P у ядра
    for (let i = 0; i <= N; i++){ const a = tops[i], b = tops[i + 1]; if (y < b && b > a) return i + Math.max(0, (y - a) / (b - a)); }
    return N + 1;
  }
  function glide(top, dur, isSnap){
    const until = nowMs() + dur * 1000 + 250;
    if (isSnap){ snapping = true; snapEnd = until; } else { prog = true; progEnd = SH.lenis ? until : nowMs() + 900; }
    armed = false;
    const o = {duration:dur, onComplete:() => { if (isSnap) snapping = false; else { prog = false; keyDest = -1; } }};
    if (isSnap){
      // доводка подхватывает страницу с той скоростью, с которой она уже едет (без остановки и без рывка),
      // а из покоя стартует мягко
      const io = (SH.ease && SH.ease.inOut) || (x => x), dist = top - window.scrollY;
      const k = dist ? clamp((SH.s.vel || 0) * dur / (2 * dist), 0, .6) : 0;
      o.easing = x => (1 - k) * io(x) + k * x * (2 - x);
      if (CFG.SNAP_LOCK) o.lock = true;
    }
    SH.goTo(top, o);
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
    SH.FL.forEach((F, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fxn-dot'; b.style.setProperty('--fxn-c', F.color);
      b.setAttribute('aria-label', F.name);
      const p = document.createElement('span'); p.className = 'fxn-pill';
      const l = document.createElement('span'); l.className = 'fxn-lab'; l.setAttribute('aria-hidden', 'true'); l.textContent = F.name;
      b.appendChild(p); b.appendChild(l);
      b.addEventListener('click', () => {
        const s = SH.s; if (s.busy || !s.ready || !railOn) return;
        const sc = E.scenes[k]; if (!sc) return;
        keyDest = k + 1;
        glide(sc.offsetTop, CFG.DOT_DUR, false);
      });
      rail.appendChild(b); dots.push(b);
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

  /* ---------- b) доводка до ближайшего экрана ---------- */
  function snapStep(s){
    if (!armed || !canSnap) return;
    if (!s.ready || s.busy || s.dragging || touching || snapping || prog) return;
    if (touchMode && !CFG.SNAP_TOUCH) return;
    const L = SH.lenis; if (!L || L.isStopped) return;
    const now = s.now;
    if (now - lastInput < (touchMode ? CFG.SNAP_IDLE_TOUCH_MS : CFG.SNAP_IDLE_MS)) return;
    let t = s.target;
    if (!touchMode && !nearest){
      // колесо: не ждём, пока страница докатится сама, — берём точку, куда она и так едет
      if (Math.abs(s.vel) > CFG.SNAP_VEL_WHEEL) return;
      const ty = +L.targetScroll;
      if (tops.length && ty === ty) t = progOf(ty);
    } else {
      if (now - lastMoveT < CFG.SNAP_STILL_MS) return;
      if (Math.abs(s.vel) > CFG.SNAP_VEL) return;
      if (L.isScrolling === 'smooth' && now - lastMoveT < CFG.SNAP_STUCK_MS) return;   // чужая плавная прокрутка ещё идёт
      if (Math.abs(s.P - t) > .02) return;
    }
    if (t >= CFG.SNAP_FREE_FROM){ armed = false; return; }                           // ниже последнего вкуса — свобода
    const base = Math.floor(t), f = t - base, c = clamp(CFG.SNAP_COMMIT, .001, .5);
    let n;
    if (nearest || !dir) n = Math.round(t);
    else if (dir > 0) n = f > c ? base + 1 : base;
    else n = f < 1 - c ? base : base + 1;
    if (n < 0 || n > N){ armed = false; return; }                                    // к «Где купить» не тянем — пусть едет сам
    const d = Math.abs(t - n);
    if (d < CFG.SNAP_MIN){ armed = false; return; }
    const sec = E.secs[n]; if (!sec){ armed = false; return; }
    glide(sec.offsetTop, clamp(CFG.SNAP_DUR_MIN + d * .5, CFG.SNAP_DUR_MIN, CFG.SNAP_DUR_MAX), true);
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
    const s = SH.s;
    if (!d || !s.ready){ userInput('key'); return; }
    if (s.busy){ e.preventDefault(); return; }                 // во время анимации выбора вкуса страницу не двигаем
    const secs = E.secs, last = secs.length - 1, t = s.target, now = nowMs();
    let n;
    if (keyDest >= 0 && prog && now < progEnd) n = keyDest + d;               // быстрые нажатия подряд — от точки назначения
    else n = d > 0 ? Math.floor(t + .02) + 1 : Math.ceil(t - .02) - 1;
    if (d < 0 && t >= last - .001 && !(prog && keyDest >= 0)){
      if (window.scrollY > secs[last].offsetTop + 2){ userInput('key'); return; }   // внутри «Где купить»/мерча — обычная прокрутка
      n = last - 1;
    }
    if (n > last || n < 0 || !secs[n]){ userInput('key'); return; }           // дальше — пусть листает браузер
    e.preventDefault();
    if (e.repeat) return;                                                      // зажатая клавиша не «пролистывает» всё подряд
    lastInput = now; touchMode = false; snapping = false;
    keyDest = n;
    glide(secs[n].offsetTop, CFG.KEY_DUR, false);
  }

  /* ---------- слушатели ---------- */
  let lastWheelT = 0, tail = false;
  window.addEventListener('wheel', e => {
    if (dead) return;
    const now = nowMs(); let dy = Math.abs(e.deltaY || 0);
    if (e.deltaMode === 1) dy *= 40; else if (e.deltaMode === 2) dy *= 800;
    if (now - lastWheelT > 200) tail = false;                              // началась новая серия движений
    lastWheelT = now;
    if (dy >= CFG.WHEEL_TAIL_PX){ tail = true; userInput('wheel'); }       // настоящее движение
    else if (!tail) userInput('wheel');                                    // медленная прокрутка без рывка
    else if (!snapping) armed = canSnap;                                   // «хвост» инерции тачпада: доводку не откладывает
  }, {passive:true});
  window.addEventListener('touchstart', () => { if (dead) return; touching = true; userInput('touch'); }, {passive:true});
  window.addEventListener('touchmove', () => { if (dead) return; lastInput = nowMs(); touchMode = true; }, {passive:true});
  const touchEnd = e => { if (dead) return; touching = !!(e.touches && e.touches.length); lastInput = nowMs(); touchMode = true; };
  window.addEventListener('touchend', touchEnd, {passive:true});
  window.addEventListener('touchcancel', touchEnd, {passive:true});
  window.addEventListener('keydown', onKey);

  SH.on('ready', measure);
  SH.on('resize', r => {
    if (dead) return;
    if (rail && r && r.mobile !== railM){ railM = !!r.mobile; rail.classList.toggle('fxn-m', railM); fillK = -1; }
    measure();
    if (canSnap && SH.s.ready && !SH.s.busy){ armed = true; nearest = true; lastInput = nowMs() + 250; }   // после смены размера — доехать, но не сразу
  });
  SH.on('open:start', () => { snapping = false; prog = false; keyDest = -1; armed = false; });
  SH.on('open:end', () => { armed = false; prevT = NaN; navAcc = 0; });

  SH.on('frame', s => {
    if (dead) return;
    try {
      const now = s.now, t = s.target;
      if (prevT === prevT){ const dT = t - prevT; if (Math.abs(dT) > CFG.MOVE_EPS){ lastMoveT = now; dir = dT > 0 ? 1 : -1; } }
      else lastMoveT = now;
      prevT = t;
      if (snapping && now > snapEnd) snapping = false;
      if (prog && now > progEnd){ prog = false; keyDest = -1; }
      railStep(s);
      navStep(s);
      snapStep(s);
    } catch (e) {
      dead = true;                                             // при любой ошибке модуль выключается, шапка остаётся на месте
      try { if (nav) nav.classList.remove('fxn-hide'); if (rail) rail.classList.remove('fxn-on'); } catch (e2) {}
      console.error('[fx-nav]', e);
    }
  });

  measure();
})();
