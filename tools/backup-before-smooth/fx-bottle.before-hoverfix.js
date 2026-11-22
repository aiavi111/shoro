/* Физика бутылки.
   Большая бутылка: наклоняется за мышкой, «отстаёт» при движении, пружинит при посадке,
   по ней один раз пробегает световой блик. Сама по себе она НЕ крутится.
   Ряд бутылок на первом экране: лёгкое покачивание, сдвиг за мышкой и одна «волна» поворотов при открытии. */
(() => {
  'use strict';
  const SH = window.SHORO; if (!SH) return;
  if (SH.reduced) return;
  const { els, clamp } = SH;
  const fx = els.fx; if (!fx) return;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------- настройки ---------- */
  const CFG = {
    tiltY: 7, tiltX: 4,        // наклон за мышкой, градусы
    leanMax: 6,                // наклон от движения, градусы
    pop: 0.74,                 // сила «подпрыгивания» при посадке
    floatPx: 5,                // покачивание бутылок в ряду, px
    floatSpeed: 0.00105,       // скорость покачивания
    parPx: 5,                  // сдвиг ряда за мышкой, px
    waveDelay: 1900,           // через сколько мс после открытия идёт «волна»
    waveGap: 170,              // пауза между бутылками в волне, мс
    waveRate: 7,               // скорость поворота в волне
  };

  SH.css('fx-bottle', `
    .fxb-sheen{position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:soft-light;
      -webkit-mask-image:url(matte.svg);mask-image:url(matte.svg);-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
      background:linear-gradient(105deg,rgba(255,255,255,0) 38%,rgba(255,255,255,.95) 50%,rgba(255,255,255,0) 62%) no-repeat;background-size:260% 100%;background-position:160% 0}
    .fxb-sheen.go{animation:fxb-sheen 1.15s cubic-bezier(.3,.1,.2,1) 1}
    @keyframes fxb-sheen{0%{opacity:0;background-position:160% 0}15%{opacity:1}85%{opacity:1}100%{opacity:0;background-position:-60% 0}}
  `);
  const sheen = document.createElement('div'); sheen.className = 'fxb-sheen'; fx.appendChild(sheen);
  const sdw = fx.querySelector('.sdw');
  const runSheen = () => { sheen.classList.remove('go'); void sheen.offsetWidth; sheen.classList.add('go'); };

  /* ---------- пружины ---------- */
  const mk = () => ({ x: 0, v: 0 });
  const step = (o, target, k, c, dt) => { o.v += (-k * (o.x - target) - c * o.v) * dt; o.x += o.v * dt; };
  const ry = mk(), rx = mk(), rz = mk(), sq = mk(), pop = mk();
  let mx = 0, my = 0, hasMouse = false, lbx = null, lby = null, lastT = '', lastS = '';
  let carryX = 0, carryY = 0;                                  // перенос покачивания с бутылки ряда на большую
  if (fine) addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; hasMouse = true; } }, { passive: true });

  const land = () => { pop.v += CFG.pop; runSheen(); };
  SH.on('open:end', land);
  SH.on('settle', e => { if (e.i >= 1 && e.i <= SH.N) land(); });
  SH.on('tap', () => { rz.v += 55; pop.v += CFG.pop * 0.6; });
  SH.on('drag:end', e => { rz.v += clamp((e && e.vel || 0) * 26, -90, 90); });

  /* ---------- ряд бутылок на первом экране ---------- */
  // двигаем саму картинку бутылки (.shot) свойством translate: у неё режим наложения multiply,
  // и если двигать её «коробку», вокруг бутылки появляется белый прямоугольник
  const boxes = els.slots.map(s => s.el.querySelector('.shot') || s.box), offX = [0, 0, 0, 0], offY = [0, 0, 0, 0], lastB = ['', '', '', ''];
  let started = false, frozen = false, amp = 0, par = 0, wasHero = true, touched = false;
  SH.on('ready', () => { setTimeout(() => { started = true; }, 1800); setTimeout(wave, CFG.waveDelay); });
  SH.on('slot:enter', () => { touched = true; });
  SH.on('open:start', () => { touched = true; frozen = true; });
  SH.on('open:end', () => { frozen = false; amp = 0; });

  async function wave() {                                      // бутылки по очереди делают один быстрый оборот
    for (let k = 0; k < els.slots.length; k++) {
      if (touched || SH.s.busy || SH.s.P > 0.01) return;
      const v = els.slots[k].vid;
      try {
        await SH.media.setSrc(v, await SH.media.spinURL(k));
        if (touched || SH.s.busy || SH.s.P > 0.01) return;
        v.currentTime = 0; v.playbackRate = 1.5;
        const p = v.play(); if (p && p.catch) p.catch(() => {});
        if (SH.media.spinTo) SH.media.spinTo(v, CFG.waveRate); else v.playbackRate = CFG.waveRate;   // плавный разгон и торможение у этикетки
      } catch (e) { return; }
      await new Promise(r => setTimeout(r, CFG.waveGap));
    }
  }

  /* ---------- кадр ---------- */
  SH.on('frame', s => {
    const dt = s.dt;

    // ряд на первом экране: покачивание и сдвиг за мышкой
    const hero = s.P <= 0.003;
    if (!frozen) {
      const active = started && hero && !s.busy;
      amp += ((active ? 1 : 0) - amp) * (1 - Math.pow(active ? 0.2 : 0.004, dt));
      if (amp < 0.002) amp = 0;
      par += (((hasMouse ? mx / s.W - 0.5 : 0)) - par) * (1 - Math.pow(0.03, dt));
      if (wasHero && !hero && !s.busy) { carryX = offX[0]; carryY = offY[0]; }     // большая бутылка подхватывает положение первой
      for (let k = 0; k < boxes.length; k++) {
        offY[k] = Math.sin(s.now * CFG.floatSpeed + k * 1.7) * CFG.floatPx * amp;
        offX[k] = -par * (k - 1.5) * CFG.parPx * amp;
        const key = amp === 0 ? '' : `${offX[k].toFixed(1)}px ${offY[k].toFixed(1)}px`;
        if (lastB[k] !== key) { lastB[k] = key; boxes[k].style.translate = key; }
      }
    }
    wasHero = hero;

    // большая бутылка
    if (!s.show) { lbx = null; return; }
    let vx = 0, vy = 0;
    if (lbx !== null) {
      const dx = s.bx - lbx, dy = s.by - lby;
      if (Math.abs(dx) < s.W * 0.4 && Math.abs(dy) < s.H * 0.4) { vx = dx / Math.max(dt, 0.004); vy = dy / Math.max(dt, 0.004); }
    }
    lbx = s.bx; lby = s.by;
    const calm = s.dragging || s.busy || !fine || !hasMouse || s.P < 0.9 || s.P > SH.N + 0.4;
    const tx = calm ? 0 : clamp((mx - (s.bx + s.bw / 2)) / s.W * 22, -CFG.tiltY, CFG.tiltY);
    const ty = calm ? 0 : clamp(-(my - (s.by + s.bh / 2)) / s.H * 12, -CFG.tiltX, CFG.tiltX);
    step(ry, tx, 90, 17, dt); step(rx, ty, 90, 17, dt);
    step(rz, clamp(-vx / s.W * 15, -CFG.leanMax, CFG.leanMax), 140, 15, dt);
    step(sq, clamp(vy / s.H * 0.04, -0.04, 0.04), 160, 20, dt);
    step(pop, 0, 260, 22, dt);                                // один мягкий «вдох» без повторного качания
    carryX *= Math.pow(0.004, dt); carryY *= Math.pow(0.004, dt);
    if (Math.abs(carryX) < 0.05) carryX = 0; if (Math.abs(carryY) < 0.05) carryY = 0;
    const sc = 1 + clamp(pop.x, -0.05, 0.06), st = Math.abs(sq.x);
    const t = `translate3d(${(carryX / s.h).toFixed(1)}px,${(carryY / s.h).toFixed(1)}px,0) perspective(1200px) rotateX(${rx.x.toFixed(2)}deg) rotateY(${ry.x.toFixed(2)}deg) rotateZ(${rz.x.toFixed(2)}deg) scale(${(sc * (1 - st * 0.6)).toFixed(4)},${(sc * (1 + st)).toFixed(4)})`;
    if (t !== lastT) { lastT = t; fx.style.transform = t; }
    if (sdw) { const k = (1 + clamp(pop.x, -0.05, 0.06) * 2.2).toFixed(3); if (k !== lastS) { lastS = k; sdw.style.transform = `scale(${k},1)`; } }
  });
})();
