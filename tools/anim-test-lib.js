// общие помощники сценариев
module.exports = a => {
  const fire = d => { a.wheel(d).catch(() => {}); };
  const stream = async list => { const t0 = Date.now(); for (let i = 0; i < list.length; i++) { fire(list[i]); const w = t0 + (i + 1) * 16.67 - Date.now(); if (w > 0) await a.sleep(w); } };
  const swipe = (v0, finger = 180, r = 0.965, sign = 1, tailMin = 1) => { const n1 = Math.max(2, Math.round(finger / 16.67)), l = []; for (let k = 1; k <= n1; k++) l.push(sign * v0 * Math.sin(Math.PI / 2 * k / n1)); let d = v0; while (d >= tailMin) { d *= r; l.push(sign * d); } return l; };
  const ready = async () => { for (let i = 0; i < 200; i++) { if (await a.js('!!(window.SHORO && SHORO.s.ready)').catch(() => false)) return true; await a.sleep(100); } return false; };
  const P = () => a.js('+SHORO.s.P.toFixed(3)');
  // невидимый Chrome шлёт события колеса «как мышь»; для имитации тачпада выключаем правило «щелчок = жест»
  const trackpad = on => a.js(`SHORO.navCfg && (SHORO.navCfg.NOTCH = ${on ? 'false' : 'true'}), 0`);
  const st = () => a.js(`(()=>{const s=SHORO.s;return {P:+s.P.toFixed(3),y:Math.round(scrollY),busy:s.busy,ang:+s.angle.toFixed(3)}})()`);
  let fails = 0;
  const check = (label, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK  ' : 'ERR ') + label + (info ? ' — ' + info : '')); };
  const near = (x, y, e = .02) => Math.abs(x - y) < e;
  // запись движения: профиль P по 100 мс + пик скорости + максимальный шаг поворота за кадр
  const rec = async (fn, ms) => {
    await a.js(`window.__tr=[];window.__on=1;if(!window.__lp){window.__lp=1;(function l(now){if(window.__on)__tr.push([now,SHORO.s.P,SHORO.s.angle,scrollY]);requestAnimationFrame(l)})(performance.now())}`);
    await fn(); await a.sleep(ms);
    const tr = await a.js('__tr'); if (tr.length < 3) return { prof: '', peak: 0, dAng: 0, rev: 0, end: 0 };
    const t0 = tr[0][0], prof = []; let nt = 0; for (const f of tr) { if (f[0] - t0 >= nt) { prof.push(f[1].toFixed(2)); nt += 100; } }
    const v = []; for (let i = 1; i < tr.length; i++) v.push((tr[i][1] - tr[i - 1][1]) / Math.max(1, tr[i][0] - tr[i - 1][0]) * 1000);
    const sm = v.map((_, i) => { let s = 0, c = 0; for (let k = -2; k <= 2; k++) if (v[i + k] !== undefined) { s += v[i + k]; c++; } return s / c; });
    let rev = 0, ls = 0, dAng = 0, dA2 = 0; sm.forEach(x => { const sg = Math.abs(x) > .06 ? Math.sign(x) : 0; if (sg && ls && sg !== ls) rev++; if (sg) ls = sg; });
    const da = []; for (let i = 1; i < tr.length; i++) { const d = (tr[i][2] - tr[i - 1][2]) * 360; da.push(d); dAng = Math.max(dAng, Math.abs(d)); }
    for (let i = 1; i < da.length; i++) dA2 = Math.max(dA2, Math.abs(da[i] - da[i - 1]));
    return { prof: prof.slice(0, 30).join(' '), peak: +Math.max(...sm.map(Math.abs)).toFixed(2), dAng: +dAng.toFixed(1), dA2: +dA2.toFixed(1), rev, end: tr[tr.length - 1][1], n: tr.length };
  };
  return { fire, stream, swipe, ready, P, st, check, near, rec, trackpad, fails: () => fails };
};
