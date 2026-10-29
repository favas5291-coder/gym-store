// Process-cold and activity-resume samples on an emulator, not physical-device
// or power-cycle launch timings. No credentials, orders or payments are used.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 30000 }).trim();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = process.argv[2];
if (!output) throw new Error('Pass an output JSON path');
const samples = [];
// Keep the paired sample short: software H.264 decoding in this emulator can
// stop responding after repeated process launches. Retain every completed sample.
for (let run = 1; run <= 2; run++) {
  adb('shell', 'am', 'force-stop', 'com.gymdrobe.app');
  const cold = adb('shell', 'am', 'start', '-W', '-n', 'com.gymdrobe.app/.MainActivity');
  let target;
  for (let attempt = 0; attempt < 80 && !target; attempt++) {
    try {
      const pid = adb('shell', 'pidof', '-s', 'com.gymdrobe.app');
      if (/^\d+$/.test(pid)) {
        adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`);
        const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
        target = pages.find(page => page.type === 'page' && page.webSocketDebuggerUrl);
      }
    } catch { /* WebView starts after Activity creation. */ }
    if (!target) await pause(200);
  }
  if (!target) throw new Error('WebView debug target unavailable');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebView connection timed out')), 10000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebView connection failed')); }, { once: true });
    });
    let id = 0;
    const evaluate = expression => new Promise((resolve, reject) => {
      const request = ++id;
      const timer = setTimeout(() => { socket.removeEventListener('message', read); reject(new Error('WebView evaluation timed out')); }, 10000);
      function read({ data }) {
        const response = JSON.parse(data);
        if (response.id !== request) return;
        clearTimeout(timer); socket.removeEventListener('message', read);
        if (response.error || response.result?.exceptionDetails) reject(new Error('WebView evaluation failed'));
        else resolve(response.result.result.value);
      }
      socket.addEventListener('message', read);
      socket.send(JSON.stringify({ id: request, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });
    let page;
    for (let attempt = 0; attempt < 80; attempt++) {
      page = await evaluate(`({ ready: !!document.querySelector('h1'), native: window.Capacitor?.isNativePlatform?.(), route: location.pathname,
        dcl: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd,
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime })`);
      if (page.ready && page.fcp > 0) break;
      await pause(200);
    }
    if (!page?.ready || !page.native || !(page.fcp > 0)) throw new Error('Native first paint was not observed');
    // Software video decoding can saturate this emulator. FCP is already
    // captured; pause before the HOME transition, as backgrounding does in use.
    await evaluate(`document.querySelector('video')?.pause(); true`);
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.HOME');
    const warm = adb('shell', 'am', 'start', '-W', '-n', 'com.gymdrobe.app/.MainActivity');
    const timing = value => Object.fromEntries([...value.matchAll(/^(ThisTime|TotalTime|WaitTime):\s*(\d+)/gm)].map(match => [match[1], Number(match[2])]));
    samples.push({ run, coldActivity: timing(cold), warmActivity: timing(warm), webview: page });
    console.log('ANDROID_STARTUP_SAMPLE', JSON.stringify(samples.at(-1)));
    await fs.writeFile(output, JSON.stringify({ complete: samples.length === 2, conditions: 'API 35 x86_64 emulator; two force-stop process-cold launches and HOME/activity resumes. WebView FCP excludes native startup; am start timings exclude full web rendering. Internet catalog not awaited. Not a physical-phone benchmark.', samples }, null, 2));
    await evaluate(`document.querySelector('video')?.pause(); true`);
  } finally { socket.close(); }
}
