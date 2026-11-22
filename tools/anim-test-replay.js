// Проигрываем НАСТОЯЩУЮ запись тачпада пользователя (события колеса с их временем) на сайте. node drv.js p15.js [path]
const fs = require('fs'), path = require('path');
module.exports = async a => {
  const L = require('./anim-test-lib.js')(a); const W = 1102, H = 1004, url = process.argv[3] || '/';
  const log = fs.readFileSync(path.join(__dirname, 'trackpad-recording.txt'), 'utf8').trim().split(/\s+/).map(x => x.split(':').map(Number));
  await a.size(W, H, false, 2);
  await a.go('http://localhost:5178' + url + '?t=' + Date.now()); await L.ready(); await L.trackpad(true); await a.sleep(4300); await a.move(W / 2, 300, 4, 60);
  await a.js(`window.__tr=[];(function l(now){__tr.push([now,SHORO.s.P,SHORO.s.target]);requestAnimationFrame(l)})(performance.now());window.__w0=0;window.__pg=[];window.__ws=[];addEventListener('wheel',e=>{if(!__w0)__w0=performance.now();__ws.push([Math.round(e.timeStamp-__w0),e.deltaY,Math.round(performance.now()-__w0)])},{capture:true,passive:true});SHORO.on('page',d=>__pg.push([Math.round(performance.now()-__w0),d.to,d.why||'']));window.__dbg=[];SHORO.navDbg=o=>{__dbg.push([Math.round(o.t-__w0),o.a,+o.r.toFixed(1),o.fresh?1:0,o.used?1:0,Math.round(o.acc),+o.hi.toFixed(1),+o.low.toFixed(1),o.dec?1:0,o.rise])};0`);
  const t0 = Date.now() + 100;
  for (const [t, dy] of log) { const w = t0 + t - Date.now(); if (w > 0) await a.sleep(w); a.wheel(dy).catch(() => {}); }
  await a.sleep(3500);
  const tr = await a.js('__tr'), w0 = await a.js('__w0');
  // остановки: где страница стоит на целом экране дольше 200 мс
  const rests = []; let cur = null;
  for (const f of tr) { const t = f[0] - w0, p = f[2]; const k = Math.round(p); if (Math.abs(p - k) < .004) { if (!cur || cur.k !== k) { cur = { k, a: t, b: t }; rests.push(cur); } else cur.b = t; } else cur = null; }
  const seq = rests.filter(r => r.b - r.a > 200).map(r => `${r.k}[${(r.a / 1000).toFixed(1)}–${(r.b / 1000).toFixed(1)}с]`);
  console.log(url, 'остановки на экранах:', seq.join(' → '));
  console.log('   шаги (мс от первого события → экран):', (await a.js('JSON.stringify(window.__pg||[])')));
  { const ws = await a.js('__ws'); const odd = []; for (let i = 1; i < ws.length; i++) { const g = ws[i][0] - ws[i - 1][0], want = log[i] ? log[i][0] - log[i - 1][0] : 0; if (Math.abs(g - want) > 60) odd.push(`#${i} t=${ws[i][0]} пауза ${g} (в записи ${want})`); }
    console.log('   событий дошло:', ws.length, 'из', log.length, '| расхождения пауз >60мс:', odd.slice(0, 8).join('; ') || 'нет');
    const near = ws.filter(e => e[0] > 21600 && e[0] < 22100).map(e => e[0] + ':' + e[1] + (e[2] - e[0] > 25 ? '(обработано +' + (e[2] - e[0]) + ')' : '')); console.log('   события 21.6–22.1с:', near.join(' ')); }
  if (process.argv[4]) { const [d0, d1] = process.argv[4].split('-').map(Number); const dbg = await a.js('__dbg'); console.log('   отладка [t, a, r, fresh, used, acc, hi, low, dec, rise]:'); console.log('   ' + dbg.filter(e => e[0] >= d0 && e[0] <= d1).map(e => e.join(',')).join('  ')); }
  // сколько времени страница была «между экранами» и максимум разворотов
  let between = 0; for (let i = 1; i < tr.length; i++) { const p = tr[i][2]; if (Math.abs(p - Math.round(p)) > .004) between += tr[i][0] - tr[i - 1][0]; }
  const line = []; let nt = 0; for (const f of tr) { const t = f[0] - w0; if (t >= nt) { line.push(f[1].toFixed(1)); nt += 500; } }
  console.log('   в пути:', (between / 1000).toFixed(1) + 'с', '| P каждые 0.5с:', line.join(' '));
};
