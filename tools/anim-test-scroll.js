// Точная имитация тачпада: события 60 Гц без ожидания ответа. Проверяем «один жест = один вкус» и форму движения.
// node drv.js p6.js [W] [H]
module.exports = async a => {
  const W = +(process.argv[3] || 1102), H = +(process.argv[4] || 1004);
  await a.size(W, H, false, 2);
  await a.go('http://localhost:5178/?t=' + Date.now());
  for (let i = 0; i < 150; i++) { if (await a.js('!!(window.SHORO && SHORO.s.ready)').catch(() => false)) break; await a.sleep(100); }
  await a.js(`window.__tr=[];(function l(now){__tr.push([now,SHORO.s.P,scrollY,SHORO.s.angle]);requestAnimationFrame(l)})(performance.now());
    window.__wt=[];addEventListener('wheel',e=>__wt.push(performance.now()),{passive:true,capture:true});window.__ev=[];['settle','section'].forEach(n=>SHORO.on(n,d=>__ev.push([n,Math.round(performance.now()),d.i])));window.__pg=[];SHORO.on('page',d=>__pg.push(d.to+':'+(d.why||'')));0`);
  await a.sleep(4300); await a.move(W / 2, 300, 4, 60);
  const pad = on => a.js(`SHORO.navCfg.NOTCH = ${on ? 'false' : 'true'}, 0`); await pad(true);
  const fire = d => { a.wheel(d).catch(() => {}); };
  const stream = async list => { const t0 = Date.now(); for (let i = 0; i < list.length; i++) { fire(list[i]); const w = t0 + (i + 1) * 16.67 - Date.now(); if (w > 0) await a.sleep(w); } };
  const swipe = (v0, finger = 180, r = 0.965, sign = 1, tailMin = 1) => { const n1 = Math.max(2, Math.round(finger / 16.67)), l = []; for (let k = 1; k <= n1; k++) l.push(sign * v0 * Math.sin(Math.PI / 2 * k / n1)); let d = v0; while (d >= tailMin) { d *= r; l.push(sign * d); } return l; };
  let fails = 0;
  const run = async (label, fn, expect, ms = 2600) => {
    await a.js('__tr.length=0;__wt.length=0;__ev.length=0;__pg.length=0'); const p0 = await a.js('SHORO.s.P');
    const tA = await a.js('performance.now()'); await fn(); await a.sleep(ms);
    const tr = await a.js('__tr'), wt = await a.js('__wt'), ev = await a.js('__ev');
    const t0 = tr[0][0]; const prof = []; let nt = 0;
    for (const f of tr) { if (f[0] - t0 >= nt) { prof.push(f[1].toFixed(2)); nt += 100; } }
    const v = []; for (let i = 1; i < tr.length; i++) v.push((tr[i][1] - tr[i - 1][1]) / Math.max(1, tr[i][0] - tr[i - 1][0]) * 1000);
    const sm = v.map((_, i) => { let s = 0, c = 0; for (let k = -2; k <= 2; k++) if (v[i + k] !== undefined) { s += v[i + k]; c++; } return s / c; });
    const peak = Math.max(...sm.map(Math.abs), 1e-6); let humps = 0, inH = false, rev = 0, lastSign = 0;
    sm.forEach(x => { const ax = Math.abs(x); if (!inH && ax > peak * .55) { inH = true; humps++; } if (inH && ax < peak * .3) inH = false; const sg = ax > .06 ? Math.sign(x) : 0; if (sg && lastSign && sg !== lastSign) rev++; if (sg) lastSign = sg; });
    let acc = 0; for (let i = 1; i < sm.length; i++) acc = Math.max(acc, Math.abs(sm[i] - sm[i - 1]) / Math.max(1, tr[i + 1][0] - tr[i][0]) * 1000);
    // угол: максимальный шаг поворота за кадр (в градусах)
    let dAng = 0; for (let i = 1; i < tr.length; i++) dAng = Math.max(dAng, Math.abs(tr[i][3] - tr[i - 1][3]) * 360);
    const last = tr[tr.length - 1]; let tStart = 0, tEnd = 0;
    for (let i = 1; i < tr.length; i++) if (Math.abs(tr[i][1] - p0) > .004) { tStart = tr[i][0]; break; }
    for (let i = tr.length - 1; i > 0; i--) if (Math.abs(tr[i][1] - last[1]) > .01) { tEnd = tr[i][0]; break; }
    const wgaps = []; for (let i = 1; i < wt.length; i++) wgaps.push(wt[i] - wt[i - 1]); wgaps.sort((x, y) => x - y);
    const settle = ev.filter(e => e[0] === 'settle').map(e => e[2] + '@' + (e[1] - Math.round(wt[0] || tA)) + 'мс').join(',');
    const ok = expect === undefined || Math.abs(last[1] - expect) < .02; if (!ok) fails++;
    console.log(`${ok ? 'OK ' : 'ERR'} ${label.padEnd(30)} P ${(+p0).toFixed(2)}→${last[1].toFixed(2)}${expect !== undefined ? ' (ждём ' + expect + ')' : ''} | старт через ${Math.round(tStart - (wt[0] || tA))}мс, 99% через ${Math.round(tEnd - (wt[0] || tA))}мс | пик ${peak.toFixed(2)} экр/с | горбов ${humps} разворотов ${rev} | макс.ускор ${acc.toFixed(1)} | поворот до ${dAng.toFixed(1)}°/кадр | колесо: ${wt.length} соб., медиана ${wgaps.length ? wgaps[Math.floor(wgaps.length / 2)].toFixed(0) : '-'}мс | settle ${settle || '-'}`);
    console.log('    ' + prof.slice(0, 26).join(' ') + '  | шаги: ' + (await a.js('__pg.join(", ")')));
  };
  await run('слабый свайп', () => stream(swipe(8, 220)), 1);
  await run('средний свайп', () => stream(swipe(30, 180)), 2);
  await run('сильный свайп', () => stream(swipe(80, 150)), 3, 3600);
  await run('очень сильный, длинная инерция', () => stream(swipe(120, 130, 0.975)), 4, 4600);
  await run('назад средний', () => stream(swipe(30, 180, 0.965, -1)), 3);
  await run('назад сильный', () => stream(swipe(80, 150, 0.965, -1)), 2, 3600);
  await run('медленно пальцами 300px', () => stream(Array(36).fill(8.3)), 3);
  await run('2 свайпа подряд (пауза 0.45с)', async () => { await stream(swipe(30, 160).slice(0, 27)); await stream(swipe(30, 160)); }, 4, 3600);
  await run('свайп и сразу разворот', async () => { await stream(swipe(30, 160).slice(0, 18)); await stream(swipe(30, 160, 0.965, -1)); }, 4, 3200);
  await run('вверх с 4 на 3', () => stream(swipe(30, 180, 0.965, -1)), 3);
  await run('крошечное движение 20px', () => stream([4, 6, 6, 4]), 3, 1500);
  await a.sleep(1200);
  await run('слабо, пауза 0.4с, ещё слабо (25+25px)', async () => { await stream([5, 8, 8, 4]); await a.sleep(400); await stream([5, 8, 8, 4]); }, 4, 2400);
  await run('обратно слабо один раз (25px) — стоим', () => stream([-5, -8, -8, -4]), 4, 1500);
  await pad(false);
  await run('мышь: 1 щелчок вверх', () => stream([-100]), 3);
  await run('колесо мыши: 1 щелчок', () => stream([100]), 4);
  await run('мышь на Маке: медленный щелчок 4px вверх', () => stream([-4]), 3);
  await run('мышь на Маке: 3 медленных щелчка по 4px (пауза 0.5с) вверх', async () => { fire(-4); await a.sleep(500); fire(-4); await a.sleep(500); fire(-4); }, 0, 3200);
  await run('мышь: 4 щелчка вниз с паузой 0.3с', async () => { for (let i = 0; i < 4; i++) { fire(100); await a.sleep(300); } }, 4, 3600);
  await run('мышь: 1 щелчок вверх (4→3)', () => stream([-100]), 3);
  await run('назад 3 быстрых щелчка', async () => { fire(-100); await a.sleep(70); fire(-100); await a.sleep(70); fire(-100); }, 2);
  await run('назад 2 щелчка с паузой 0.35с', async () => { fire(-100); await a.sleep(350); fire(-100); }, 0, 3200);
  await run('колесо без остановки 1.6с вниз', async () => { for (let i = 0; i < 20; i++) { fire(100); await a.sleep(80); } }, undefined, 3000);
  console.log(fails ? 'ПРОВАЛОВ: ' + fails : 'ВСЁ СОВПАЛО');
};
