// Мини-драйвер для невидимого Chrome (CDP): node drv.js <scenario.js>
const fs = require('fs'), path = require('path');
const PORT = 9333, OUT = path.join(__dirname, 'shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0; const pend = new Map(), logs = [], evh = {};
  const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  let t = tabs.find(x => x.type === 'page');
  if (!t) t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(JSON.stringify(m.error))) : p.r(m.result); return; }
    if (m.method && evh[m.method]) { try { evh[m.method](m.params); } catch (e) {} }
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && /error|warning/.test(m.params.type)) logs.push(m.params.type.toUpperCase() + ' ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 300));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('LOG ' + m.params.entry.text.slice(0, 200) + ' ' + (m.params.entry.url || ''));
  };
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  let mx = 0, my = 0, pressed = 0;
  const api = {
    sleep, logs, send, on(method, fn) { evh[method] = fn; },
    async size(w, h, mobile = false, dpr = 1) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
      await send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
      if (mobile) await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }); else await send('Emulation.setEmitTouchEventsForMouse', { enabled: false });
    },
    async reduced(on) { await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: on ? 'reduce' : 'no-preference' }] }); },
    async go(url) { await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(50); try { const r = await send('Runtime.evaluate', { expression: `location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`, returnByValue: true }); if (r.result && r.result.value === true) break; } catch (e) {} } },
    async js(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; },
    async move(x, y, steps = 12, ms = 180) { const x0 = mx, y0 = my; for (let i = 1; i <= steps; i++) { mx = x0 + (x - x0) * i / steps; my = y0 + (y - y0) * i / steps; await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx, y: my, pointerType: 'mouse', buttons: pressed, button: pressed ? 'left' : 'none' }); await sleep(ms / steps); } },
    async down(x = mx, y = my) { pressed = 1; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }); },
    async up(x = mx, y = my) { pressed = 0; await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }); },
    async click(x, y) { await api.move(x, y, 6, 90); await api.down(x, y); await sleep(40); await api.up(x, y); },
    async wheel(dy, x = mx, y = my) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }); },
    async tap(x, y) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(50); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    async swipe(x, y0, y1, ms = 300) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] }); const n = 12; for (let i = 1; i <= n; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * i / n }] }); await sleep(ms / n); } await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    async key(key, code, vk) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk }); },
    async shot(name, q = 62) { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: q }); fs.writeFileSync(path.join(OUT, name + '.jpg'), Buffer.from(r.data, 'base64')); return name; },
    async burstShots(prefix, times) { const t0 = Date.now(); for (const tt of times) { const w = tt - (Date.now() - t0); if (w > 0) await sleep(w); await api.shot(prefix + '_' + String(tt).padStart(5, '0')); } },
  };
  try { await require(path.resolve(process.argv[2]))(api); } catch (e) { console.log('SCENARIO ERROR', e.message); }
  console.log('--- page logs (' + logs.length + ')'); [...new Set(logs)].slice(0, 25).forEach(l => console.log(l));
  ws.close(); process.exit(0);
})();
