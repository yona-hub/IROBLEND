import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
const out = resolve('docs/reverse-recipes/ui-qa');
mkdirSync(out, { recursive: true });
const url = process.env.QA_URL ?? 'http://127.0.0.1:5180/';
const browser = spawn(process.env.QA_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
  '--remote-debugging-port=9239', '--user-data-dir=' + mkdtempSync(resolve(tmpdir(), 'iroblend-recipe-qa-')), 'about:blank',
], { stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws, sequence = 0;
const pending = new Map(), errors = [], results = [];
try {
  let endpoint;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { endpoint = await (await fetch('http://127.0.0.1:9239/json/new?about:blank', { method: 'PUT' })).json(); break; }
    catch { await sleep(100); }
  }
  if (!endpoint) throw new Error('Browser startup failed');
  ws = new WebSocket(endpoint.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const deferred = pending.get(message.id); pending.delete(message.id);
    if (message.error) deferred?.reject(new Error(message.error.message)); else deferred?.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const until = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await sleep(30);
    }
    throw new Error('UI wait timed out: ' + expression);
  };
  const clickText = (text, scope = 'document') => evaluate(
    "Array.from(" + scope + ".querySelectorAll('button')).find(button => button.textContent.trim() === " + JSON.stringify(text) + ")?.click()");
  const capture = async name => {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(resolve(out, name + '.png'), Buffer.from(shot.data, 'base64'));
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.qaLongTasks=[];new PerformanceObserver(list=>window.qaLongTasks.push(...list.getEntries().map(item=>item.duration))).observe({type:'longtask',buffered:true});" });
  for (const [width, height] of [[1920,900],[1536,760],[1376,1032],[1366,650],[1280,720],[1032,1376],[1024,768],[768,1024],[430,932],[390,844],[360,640],[320,568]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url });
    await until("!!document.querySelector('.mode-switch')");
    const header = await evaluate("(() => { const title=document.querySelector('.hero-copy__title').getBoundingClientRect();const about=document.querySelector('.about-link').getBoundingClientRect();return {titleTop:title.top,titleLeft:title.left,aboutTop:about.top,menu:!!document.querySelector('.menu-button'),overflow:document.documentElement.scrollWidth>innerWidth+1};})()");
    if (header.menu || header.overflow || header.titleTop > 70 || (width < 1280 && header.titleLeft > 45) || Math.abs(header.titleTop-header.aboutTop) > 24) throw new Error('Header layout failed at ' + width + ': ' + JSON.stringify(header));
    await capture('free-' + width);
    await clickText('つくり方をさがす');
    const begin = performance.now();
    if (width < 1280) {
      await evaluate("document.querySelector('.choose-button').click()");
      await until("document.querySelector('.drawer-shell--open') !== null");
    }
    const picker = width < 1280 ? "document.querySelector('.drawer')" : "document.querySelector('.sidebar')";
    await evaluate(picker + '.querySelector(\'[aria-label="ブラウンを目標にする"]\').click()');
    await until("!!document.querySelector('.recipe-options') && !document.querySelector('.mix-button').disabled");
    const readyMs = performance.now() - begin;
    const readyGeometry = await evaluate("(() => {const card=document.querySelector('.target-comparison').getBoundingClientRect();const pair=document.querySelector('.target-comparison__pair').getBoundingClientRect();const action=document.querySelector('.stage-actions').getBoundingClientRect();const panel=document.querySelector('.mix-side-panel').getBoundingClientRect();return {viewportWidth:document.documentElement.clientWidth,card:[card.left,card.right],pair:[pair.left,pair.right],action:[action.left,action.right,action.top,action.bottom],panel:[panel.left,panel.right]};})()");
    const edgesMatch = (a, b) => Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
    if (!edgesMatch(readyGeometry.card, readyGeometry.pair))
      throw new Error('Target cards do not span their container at ' + width + ': ' + JSON.stringify(readyGeometry));
    if (width < 1280 && (readyGeometry.action[0] > 1 || readyGeometry.action[1] < readyGeometry.viewportWidth - 1 || readyGeometry.action[2] < 0 || readyGeometry.action[3] > height + 1))
      throw new Error('Fixed actions do not span the viewport at ' + width + ': ' + JSON.stringify(readyGeometry));
    if (width >= 600 && width < 900 && !edgesMatch(readyGeometry.panel, readyGeometry.card))
      throw new Error('Portrait tablet panel and target cards do not align at ' + width + ': ' + JSON.stringify(readyGeometry));
    await capture('recipe-' + width);
    const predicted = await evaluate("document.querySelectorAll('.target-comparison figure>div')[1].style.backgroundColor");
    await clickText('この配合でためす');
    await until("document.querySelector('.recipe-experiment') !== null");
    const canvasGeometry = await evaluate("(() => {const canv=document.querySelector('.mix-canvas').getBoundingClientRect();const card=document.querySelector('.target-comparison').getBoundingClientRect();return {canvas:[canv.left,canv.right,canv.height],card:[card.left,card.right]};})()");
    if (!edgesMatch(canvasGeometry.canvas, canvasGeometry.card)) throw new Error('Target cards and canvas do not align at ' + width + ': ' + JSON.stringify(canvasGeometry));
    if (width >= 600 && width < 1280 && height > width && canvasGeometry.canvas[2] > 481)
      throw new Error('Portrait tablet canvas is too tall at ' + width + ': ' + JSON.stringify(canvasGeometry));
    const readyCanvasHeight = await evaluate("document.querySelector('.mix-canvas').getBoundingClientRect().height");
    if (width < 600 && (readyCanvasHeight < 179 || readyCanvasHeight > 261)) throw new Error('Mobile ready canvas size out of range');
    if (await evaluate("!!document.querySelector('.result-surface') || !!document.querySelector('.save-button')")) throw new Error('Recipe loaded as completed');
    await clickText('まぜる！');
    if (!(await evaluate("document.querySelectorAll('.mode-switch button')[0].disabled"))) throw new Error('Mode unlocked while mixing');
    await until("!!document.querySelector('.result-surface')");
    const actual = await evaluate("document.querySelector('.result-surface').style.backgroundColor");
    if (predicted !== actual) throw new Error('Prediction differs from actual mix');
    await evaluate("scrollTo(0,0)");
    await capture('mixed-' + width);
    const geometry = await evaluate("(() => { const action=document.querySelector('.stage-actions').getBoundingClientRect();const canv=document.querySelector('.mix-canvas').getBoundingClientRect();return {viewport:[innerWidth,innerHeight],bodyWidth:document.documentElement.scrollWidth,bodyHeight:document.documentElement.scrollHeight,action:[action.left,action.top,action.right,action.bottom],canvasHeight:canv.height,longTasks:window.qaLongTasks,selectedCount:document.querySelectorAll('.recipe-experiment .selected-row').length};})()");
    if (geometry.bodyWidth > width + 1) throw new Error('Horizontal overflow at ' + width);
    if (width < 1280 && (geometry.action[1] < 0 || geometry.action[3] > height + 1)) throw new Error('Main action outside viewport');
    if (geometry.canvasHeight !== 0) throw new Error('Completed canvas duplicates the comparison');
    if (width === 320) {
      await evaluate("scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");
      const beforeScroll = await evaluate('scrollY');
      await clickText('もういちど まぜる');
      await until("!!document.querySelector('.mix-animation')");
      const afterScroll = await evaluate("(() => {const c=document.querySelector('.mix-canvas').getBoundingClientRect();const bar=document.querySelector('.stage-actions').getBoundingClientRect();return {scrollY,visible:Math.max(0,Math.min(c.bottom,bar.top,innerHeight)-Math.max(c.top,0))/c.height};})()");
      if (afterScroll.scrollY >= beforeScroll || afterScroll.visible < .9)
        throw new Error('Recipe remix did not reveal its canvas before animating: ' + JSON.stringify({beforeScroll,afterScroll}));
      await capture('auto-scroll-recipe-remix-320');
    }
    results.push({ width, height, readyMs, readyCanvasHeight, readyGeometry, canvasGeometry, predicted, actual, ...geometry });
    console.log(JSON.stringify({width,height,readyMs:Math.round(readyMs),horizontalOverflow:false}));
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url }); await until("!!document.querySelector('.mode-switch')");
  await clickText('つくり方をさがす');
  await evaluate("document.querySelector('.sidebar .target-picker__group-trigger').click()");
  await until("!!document.querySelector('.sidebar .target-picker__group-option:nth-child(2)')");
  await evaluate("document.querySelector('.sidebar .target-picker__group-option:nth-child(2)').click()");
  await evaluate("const list=document.querySelector('.sidebar .target-picker__list');list.scrollTop=600;list.dispatchEvent(new Event('scroll',{bubbles:true}));");
  await sleep(80);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('.choose-button').click()");
  await until("document.querySelector('.drawer .target-picker__list').scrollTop >= 599");
  await sleep(260);
  if (!(await evaluate("document.querySelector('.drawer').getBoundingClientRect().left >= -1"))) throw new Error('Drawer remains offscreen');
  await capture('drawer-position-after-resize');

  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url }); await until("!!document.querySelector('.mode-switch')");
  for (const name of ['レッド','スカーレット','バーミリオン','クリムゾン','カーマイン']) {
    await evaluate("document.querySelector('.choose-button').click()");
    if (name === 'レッド') {
      await evaluate("document.querySelector('.drawer [aria-label=\"赤の色を見る\"]').click()");
      await sleep(270);
      if (!(await evaluate("!!document.querySelector('.drawer .nav-back svg')"))) throw new Error('Back button missing');
      await capture('color-back-button-320');
    }
    await evaluate('document.querySelector(\'.drawer [aria-label="' + name + 'を追加"]\').click()');
  }
  if ((await evaluate("document.querySelectorAll('.selection__list .selected-row').length")) !== 5) throw new Error('Five materials missing');
  await sleep(900);
  await evaluate("document.querySelector('.selection__list .selected-row:last-child').scrollIntoView({block:'center'})");
  const lastVisible = await evaluate("(() => {const row=document.querySelector('.selection__list .selected-row:last-child').getBoundingClientRect();const bar=document.querySelector('.stage-actions').getBoundingClientRect();return row.top>=0 && row.bottom<=bar.top;})()");
  if (!lastVisible) throw new Error('Fifth material hidden by fixed toolbar');
  await capture('five-materials-320');
  const freeBeforeScroll = await evaluate("(() => {const c=document.querySelector('.mix-canvas').getBoundingClientRect();const bar=document.querySelector('.stage-actions').getBoundingClientRect();return {scrollY,visible:Math.max(0,Math.min(c.bottom,bar.top,innerHeight)-Math.max(c.top,0))/c.height};})()");
  if (freeBeforeScroll.visible >= .5) throw new Error('Free-mix scroll setup did not hide most of the canvas');
  await clickText('まぜる！');
  await until("!!document.querySelector('.mix-animation')");
  const freeAfterScroll = await evaluate("(() => {const c=document.querySelector('.mix-canvas').getBoundingClientRect();const bar=document.querySelector('.stage-actions').getBoundingClientRect();return {scrollY,visible:Math.max(0,Math.min(c.bottom,bar.top,innerHeight)-Math.max(c.top,0))/c.height};})()");
  if (freeAfterScroll.scrollY >= freeBeforeScroll.scrollY || freeAfterScroll.visible < .9)
    throw new Error('Free mix did not reveal its canvas before animating: ' + JSON.stringify({freeBeforeScroll,freeAfterScroll}));
  await capture('auto-scroll-free-mix-320');

  await send('Emulation.setDeviceMetricsOverride', { width: 1032, height: 1376, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url }); await until("!!document.querySelector('.mode-switch')");
  for (const name of ['レッド','スカーレット','バーミリオン','クリムゾン','カーマイン']) {
    await evaluate("document.querySelector('.choose-button').click()");
    if (name === 'レッド') await evaluate("document.querySelector('.drawer [aria-label=\"赤の色を見る\"]').click()");
    await evaluate('document.querySelector(\'.drawer [aria-label="' + name + 'を追加"]\').click()');
  }
  await sleep(900);
  const tabletPanel = await evaluate("(() => {const canvas=document.querySelector('.mix-canvas').getBoundingClientRect();const panel=document.querySelector('.mix-side-panel').getBoundingClientRect();const cols=getComputedStyle(document.querySelector('.selection__list')).gridTemplateColumns.split(' ').length;return {canvas:[canvas.left,canvas.right,canvas.height],panel:[panel.left,panel.right],cols,count:document.querySelectorAll('.selection__list .selected-row').length,overflow:document.documentElement.scrollWidth>innerWidth+1};})()");
  if (tabletPanel.count !== 5 || tabletPanel.cols !== 2 || tabletPanel.overflow || Math.abs(tabletPanel.canvas[0]-tabletPanel.panel[0])>1 || Math.abs(tabletPanel.canvas[1]-tabletPanel.panel[1])>1)
    throw new Error('Five-color portrait tablet layout failed: ' + JSON.stringify(tabletPanel));
  await capture('five-materials-tablet-portrait');
  await send('Emulation.setDeviceMetricsOverride', { width: 1376, height: 1032, deviceScaleFactor: 1, mobile: false });
  await sleep(120);
  if (await evaluate("document.documentElement.scrollWidth>innerWidth+1")) throw new Error('Overflow after tablet rotation');
  await capture('five-materials-tablet-landscape');

  await send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: 2, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url }); await until("!!document.querySelector('.mode-switch')");
  await evaluate("document.querySelectorAll('.mode-switch button')[0].focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await until("document.querySelector('.app-shell--recipe') !== null");
  await evaluate("document.querySelector('.choose-button').click()");
  await until("document.activeElement.getAttribute('aria-label') === '色のメニューを閉じる'");
  await evaluate("const field=document.querySelector('.drawer input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'black');field.dispatchEvent(new Event('input',{bubbles:true}));");
  await until("Array.from(document.querySelector('.drawer').querySelectorAll('button')).some(button=>button.getAttribute('aria-label')==='ブラックを目標にする')");
  await evaluate("document.querySelector('.drawer [aria-label=\"ブラックを目標にする\"]').click()");
  await until("document.querySelector('.recipe-panel [role=\"status\"]') !== null");
  await capture('black-no-candidate-reflow');
  if (!(await evaluate("document.querySelector('.mix-button').disabled"))) throw new Error('No-candidate action enabled');
  if (errors.length) throw new Error('Browser exceptions: ' + errors.join(', '));
  writeFileSync(resolve(out, 'results.json'), JSON.stringify({ browser: 'Windows Chrome headless', results,
    extra: ['keyboard End mode switching','drawer initial focus','no candidate','reduced motion media','640×360 @2x reflow','picker position after viewport resize','five materials accessible at 320×568','five materials in two columns at 1032×1376','tablet rotation','target-card and canvas alignment','back button at 320×568','free mix and recipe remix reveal canvas before animation at 320×568'],
    limitations: ['No physical mobile devices','Actual browser 200% zoom and soft keyboard not tested','Edge Firefox iOS Safari Android Chrome not tested'], errors }, null, 2));
  console.log('UI QA passed');
} catch (error) {
  if (ws?.readyState === 1) {
    const id = ++sequence;
    const result = new Promise(resolve => pending.set(id, { resolve, reject: resolve }));
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: 'document.body.innerText', returnByValue: true } }));
    console.log(JSON.stringify({ diagnostic: (await result)?.result?.value }));
  }
  throw error;
} finally { ws?.close(); browser.kill(); }
