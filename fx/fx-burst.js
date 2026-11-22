/* Вихрь на экране вкуса.
   Когда доходишь до экрана вкуса прокруткой, за большой бутылкой один раз проигрывается
   её анимация (колосья, молоко, ячмень, смесь). Нажатие на бутылку запускает её ещё раз. */
(() => {
  'use strict';
  const SH = window.SHORO; if (!SH) return;
  if (SH.reduced) return;
  const { els, FL, N } = SH;
  const v = els.burst2; if (!v) return;

  /* ---------- настройки ---------- */
  const CFG = {
    lead: 0.4,        // за сколько секунд до «интересного места» начинать
    rate: 1.25,       // скорость проигрывания
    away: 0.12,       // на сколько экранов нужно отъехать, чтобы вихрь погас
    rearm: 0.5,       // на сколько экранов нужно уйти, чтобы вихрь сыграл снова
  };

  // у вихря на экране вкуса сильнее растворён низ кадра — чтобы не было видно «пола» из ролика
  SH.css('fx-burst', `
    .burst.b2{-webkit-mask-image:linear-gradient(to right,transparent,#000 6%,#000 94%,transparent),linear-gradient(to bottom,transparent,#000 6%,#000 80%,transparent 91%);-webkit-mask-composite:source-in;
      mask-image:linear-gradient(to right,transparent,#000 6%,#000 94%,transparent),linear-gradient(to bottom,transparent,#000 6%,#000 80%,transparent 91%);mask-composite:intersect}
  `);

  let tok = 0, playing = -1, armed = [true, true, true, true], skip = -1, lastT = '', hideTimer = 0;
  SH.on('open:start', () => { stop(); });

  function place(s) {                                          // кадр вихря 1920x1200, бутылка по центру в том же масштабе
    const t = `translate3d(${(s.bx + s.bw / 2 - s.bh * 0.8).toFixed(1)}px,${s.by.toFixed(1)}px,0)`;
    if (t !== lastT) { lastT = t; v.style.transform = t; }
  }
  function size(s) { v.style.height = s.bh.toFixed(1) + 'px'; v.style.width = (s.bh * 1.6).toFixed(1) + 'px'; lastT = ''; place(s); }

  function stop() {
    tok++; playing = -1; v.classList.remove('on');
    clearTimeout(hideTimer); hideTimer = setTimeout(() => { try { v.pause(); } catch (e) {} }, 320);
  }
  const resting = (s, i) => Math.abs(s.P - i) < 0.05 && !s.busy && s.show;

  async function play(i) {
    const k = SH.s.sel || 0, F = FL[k]; if (!F) return;      // вихрь — выбранного вкуса
    const my = ++tok;
    try {
      const url = await SH.media.burstURL(k); if (my !== tok) return;
      await SH.media.setSrc(v, url); if (my !== tok || !resting(SH.s, i)) return;
      clearTimeout(hideTimer);
      size(SH.s);
      try { v.currentTime = Math.max(0, (F.b0 || 0) - CFG.lead); } catch (e) {}
      v.playbackRate = CFG.rate; playing = i;
      const p = v.play(); if (p && p.catch) p.catch(() => { if (my === tok) stop(); });
    } catch (e) { if (my === tok) stop(); }
  }
  v.addEventListener('playing', () => { if (playing > 0) v.classList.add('on'); });
  v.addEventListener('ended', () => { if (playing > 0) stop(); });

  SH.on('settle', e => {
    const i = e.i; if (i !== 2) return;                        // сам играет на втором экране («вкус»); на остальных — по нажатию на бутылку
    if (skip === i) { skip = -1; armed[i - 1] = false; return; }
    if (!armed[i - 1]) return;
    armed[i - 1] = false; play(i);
  });
  SH.on('tap', () => {
    const s = SH.s, i = Math.round(s.P);
    if (i >= 1 && i <= N && Math.abs(s.P - i) < 0.03 && !s.busy) play(i);
  });
  SH.on('resize', () => { if (playing > 0) size(SH.s); });

  SH.on('frame', s => {
    for (let k = 0; k < N; k++) if (!armed[k] && Math.abs(s.P - (k + 1)) > CFG.rearm) armed[k] = true;
    if (skip > 0 && Math.abs(s.P - skip) > CFG.rearm && !s.busy) skip = -1;
    if (playing < 0) return;
    if (Math.abs(s.P - playing) > CFG.away || s.busy || !s.show) { stop(); return; }
    place(s);
  });
})();
