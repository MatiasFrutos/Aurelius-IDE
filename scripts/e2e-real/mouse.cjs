// Clics reales del sistema (xdotool) sobre el editor con la escala del WebView al 90 %: el cursor debe caer en la columna exacta.
const { start, js } = require('./lib.cjs');
const { execSync } = require('child_process');
(async () => {
  process.env.DISPLAY = ':99';
  const d = await start();
  try {
    await js(d, `document.querySelector('.au-tree__row[title="/tmp/proj/a.js"]').click()`); await d.sleep(1200);
    const wid = execSync('xdotool search --onlyvisible --name "Aurelius IDE" | head -1').toString().trim();
    const geo = execSync(`xdotool getwindowgeometry --shell ${wid}`).toString(); const g = Object.fromEntries(geo.trim().split('\n').map(l => l.split('=')));
    const z = await js(d, 'return devicePixelRatio');
    const r = await js(d, `const l=document.querySelectorAll('.cm-line')[1].getBoundingClientRect(); return {x:l.left,y:l.top,w:l.width,h:l.height,sx:window.screenX,sy:window.screenY,outer:[outerWidth,outerHeight]}`);
    console.log('zoom', z, 'window', g.X, g.Y, g.WIDTH, g.HEIGHT, 'line2 rect', JSON.stringify(r));
    // texto de la línea 2: "function hola(a, b) {" (21 caracteres); clic justo tras el último carácter
    const textEnd = await js(d, `const line=document.querySelectorAll('.cm-line')[1]; const range=document.createRange(); range.selectNodeContents(line); const rr=range.getBoundingClientRect(); return {right:rr.right, top:rr.top, h:rr.height}`);
    const px = Math.round(Number(g.X) + (textEnd.right + 2) * z), py = Math.round(Number(g.Y) + (textEnd.top + textEnd.h / 2) * z);
    execSync(`xdotool mousemove ${px} ${py} click 1`); await d.sleep(500);
    console.log('status after real mouse click:', await js(d, `return [...document.querySelectorAll('.au-statusbar *')].map(e=>e.textContent.trim()).filter(t=>/^Ln \\d+/.test(t))[0]`));
    // clic en el medio de "hola" (línea 2, ~col 12)
    const mid = await js(d, `const line=document.querySelectorAll('.cm-line')[1]; const tn=line.firstChild; let node=line; const w=document.createTreeWalker(line,NodeFilter.SHOW_TEXT); const t=[]; let n; while(n=w.nextNode()) t.push(n); const full=line.textContent; const idx=full.indexOf('hola')+2; let acc=0; for(const x of t){ if(idx<=acc+x.length){ const rg=document.createRange(); rg.setStart(x, idx-acc); rg.setEnd(x, idx-acc+1); const b=rg.getBoundingClientRect(); return {x:b.left, y:b.top+b.height/2, idx}; } acc+=x.length;} return null`);
    execSync(`xdotool mousemove ${Math.round(Number(g.X) + mid.x * z)} ${Math.round(Number(g.Y) + mid.y * z)} click 1`); await d.sleep(500);
    console.log('expected Ln 2, Col', mid.idx + 1, '→', await js(d, `return [...document.querySelectorAll('.au-statusbar *')].map(e=>e.textContent.trim()).filter(t=>/^Ln \\d+/.test(t))[0]`));
  } finally { await d.quit(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
