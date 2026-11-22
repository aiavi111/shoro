/* Буквы.
   1) Огромные названия вкусов въезжают по одной букве, пока листаешь страницу, и так же уезжают.
   2) Слово в заголовке первого экрана («вкус» → «Максым») перекатывается побуквенно.
   3) Заголовки нижних блоков появляются буква за буквой. */
(() => {
  'use strict';
  const SH = window.SHORO; if (!SH) return;
  if (SH.reduced) return;                                   // без движения — оставляем обычный текст
  const { els, clamp, FL, N } = SH;

  /* ---------- настройки ---------- */
  const CFG = {
    rise: 64,          // с какой высоты въезжает буква, % её роста
    rot: 7,            // наклон буквы в начале, градусы
    gap: 0.16,         // задержка между соседними буквами (доля пути)
    leanK: 0.0045,     // насколько буквы «ложатся» от скорости прокрутки
    leanMax: 8,        // предел наклона, градусы
    arriveMs: 760,     // длительность выезда букв после клика по бутылке
    arriveGap: 75,     // задержка между буквами после клика, мс
    wordGap: 26,       // задержка между буквами слова в заголовке, мс
  };
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3), easeInCubic = x => x * x * x;
  const easeOutBack = x => { const c1 = 1.35, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const esc = ch => ch === ' ' ? '&nbsp;' : ch.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  SH.css('fx-type', `
    .gname .fxt-w{display:inline-block;white-space:nowrap;will-change:transform}
    .gname .fxt-l{display:inline-block;will-change:transform,opacity;transform-origin:50% 80%}
    #hword .fxt-c{display:inline-block;font-weight:inherit;transition:transform .55s cubic-bezier(.16,1,.3,1),opacity .3s ease;transition-delay:calc(var(--i)*${CFG.wordGap}ms)}
    #hword .fxt-c.pre{transform:translateY(108%);transition:none}
    #hword .fxt-c.out{transform:translateY(-108%);opacity:0;transition:transform .2s cubic-bezier(.7,0,.84,0),opacity .18s;transition-delay:calc(var(--i)*14ms)}
    .fxt-h{display:inline-block;overflow:hidden;vertical-align:top;padding-top:.16em;margin-top:-.16em}
    .fxt-h>span{display:inline-block;transition:transform 1.1s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--i)*38ms)}
    .fxt-pre .fxt-h>span{transform:translateY(114%)}
  `);

  /* ---------- 1. огромные названия вкусов ---------- */
  const wraps = [], letters = [], lastL = [], lastW = [];
  const buildNames = () => els.gnames.forEach((g, n) => {
    const text = g.dataset.t || g.textContent.trim();
    g.innerHTML = `<span class="fxt-w">${[...text].map(ch => `<span class="fxt-l">${esc(ch)}</span>`).join('')}</span>`;
    wraps[n] = g.firstElementChild; letters[n] = [...g.querySelectorAll('.fxt-l')]; lastL[n] = []; lastW[n] = '';
  });
  buildNames();
  SH.on('flavor', buildNames);                               // выбрали другой вкус — слова на экранах другие
  let lean = 0, arrive = null;                               // arrive: буквы выезжают по времени после клика
  SH.on('open:arrive', e => { arrive = { k: e.k, t0: performance.now() }; });

  SH.on('frame', s => {
    lean += (clamp(-s.vel * CFG.leanK, -CFG.leanMax, CFG.leanMax) - lean) * (1 - Math.pow(0.002, s.dt));
    for (let n = 0; n < N; n++) {
      const d = s.P - (n + 1);
      if (d < -1.08 || d > 1.08) continue;                   // экран далеко — не трогаем
      const L = letters[n], cnt = L.length, span = 1 + CFG.gap * (cnt - 1);
      const byTime = arrive && arrive.k === n;
      for (let i = 0; i < cnt; i++) {
        let y, r, o;
        if (byTime) {
          const u = clamp((s.now - arrive.t0 - i * CFG.arriveGap) / CFG.arriveMs, 0, 1), e = easeOutBack(u);
          y = (1 - e) * 88; r = (1 - e) * 10; o = clamp(u * 2.4, 0, 1);
        } else if (d <= 0) {                                 // экран подъезжает: буквы поднимаются снизу по очереди
          const u = clamp((1 + d - 0.22) / 0.78, 0, 1), ui = clamp(u * span - CFG.gap * i, 0, 1), e = easeOutCubic(ui);
          y = (1 - e) * CFG.rise; r = (1 - e) * CFG.rot; o = clamp(ui * 1.7, 0, 1);
        } else {                                             // экран уезжает: буквы уходят вверх в обратном порядке
          const v = clamp(d / 0.78, 0, 1), vi = clamp(v * span - CFG.gap * (cnt - 1 - i), 0, 1), e = easeInCubic(vi);
          y = -e * CFG.rise; r = -e * CFG.rot; o = 1 - clamp(vi * 1.4, 0, 1);
        }
        const key = y.toFixed(1) + '|' + r.toFixed(1) + '|' + o.toFixed(2);
        if (lastL[n][i] !== key) {
          lastL[n][i] = key;
          const st = L[i].style; st.transform = `translate3d(0,${y.toFixed(1)}%,0) rotate(${r.toFixed(1)}deg)`; st.opacity = o.toFixed(2);
        }
      }
      const lk = lean.toFixed(1);
      if (lastW[n] !== lk) { lastW[n] = lk; wraps[n].style.transform = `skewX(${lk}deg)`; }
    }
    if (arrive && s.now - arrive.t0 > CFG.arriveMs + CFG.arriveGap * 8 + 80) arrive = null;
  });

  /* ---------- 2. слово в заголовке первого экрана ---------- */
  const hw = els.hword;
  if (hw) {
    let cur = (hw.textContent || '').trim(), pending = null, phase = 'idle', tok = 0;
    const build = (text, cls) => [...text].map((ch, i) => `<b class="fxt-c ${cls}" style="--i:${i}">${esc(ch)}</b>`).join('');
    const swap = (text, color) => {
      hw.style.color = color || '';
      if (phase === 'idle' && text.toLowerCase() === cur.toLowerCase()) return;
      pending = text;
      if (phase === 'out') return;                           // уже уходим — просто меняем цель
      const my = ++tok; phase = 'out';
      if (!hw.querySelector('.fxt-c')) hw.innerHTML = build(cur, '');
      hw.querySelectorAll('.fxt-c').forEach(el => el.classList.add('out'));
      setTimeout(() => {
        if (my !== tok) return;
        cur = pending == null ? cur : pending; pending = null;
        hw.innerHTML = build(cur, 'pre');
        void hw.offsetWidth;                                 // один раз фиксируем начальное положение
        hw.querySelectorAll('.fxt-c').forEach(el => el.classList.remove('pre'));
        phase = 'idle';
      }, 190 + cur.length * 14);
    };
    SH.hooks.word = (text, color) => { try { swap(String(text), color); return true; } catch (e) { return false; } };
  }

  /* ---------- 3. заголовки нижних блоков ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.remove('fxt-pre'); io.unobserve(en.target); }
    }), { threshold: 0.35 });
    document.querySelectorAll('.block h2').forEach(h => {
      const text = h.textContent.trim(); if (!text) return;
      let i = 0;
      h.setAttribute('aria-label', text);
      h.innerHTML = text.split(' ').map(w => `<span class="fxt-h" aria-hidden="true">${[...w].map(ch => `<span style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`).join(' ');
      h.classList.add('fxt-pre'); io.observe(h);
    });
  }
})();
