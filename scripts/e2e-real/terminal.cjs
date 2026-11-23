// Prueba en la app REAL (Tauri + WebKitGTK + PTY de verdad). Ver README.md de esta carpeta.
const { start, js, termText, waitTerm, By, Key } = require('./lib.cjs');
const ok = (name, cond, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) process.exitCode = 1; };

(async () => {
  const d = await start();
  try {
    await js(d, `document.querySelector('#terminal-empty-new-btn, #terminal-new-btn').click()`);
    await d.sleep(1800);
    ok('conectada', /Conectada/.test(await js(d, `return document.querySelector('.au-terminal-real__meta')?.textContent||''`)));
    ok('un solo aviso de conexión', ((await termText(d)).match(/conectada\./g) || []).length === 1);

    const ta = await d.findElement(By.css('.xterm-helper-textarea'));
    await ta.sendKeys('echo hola-$((20+22))', Key.ENTER);
    ok('echo + aritmética', /hola-42/.test(await waitTerm(d, /hola-42/)));
    await ta.sendKeys('pwd', Key.ENTER);
    ok('cwd = proyecto', /\/tmp\/proj/.test(await waitTerm(d, /\/tmp\/proj/)));
    await ta.sendKeys("printf 'a\\303\\241 \\346\\227\\245 ok\\n'", Key.ENTER);
    ok('UTF-8 íntegro', /aá 日 ok/.test(await waitTerm(d, /日 ok/)));
    await ta.sendKeys("printf '\\033[31mROJO\\033[0m\\n'", Key.ENTER);
    let red = false;
    for (let i = 0; i < 20 && !red; i++) {
      await d.sleep(150);
      red = await js(d, `return [...document.querySelectorAll('.xterm-rows span')].some(s=>/ROJO/.test(s.textContent)&&/xterm-fg-1/.test(s.className))`);
    }
    ok('colores ANSI', red);
    await ta.sendKeys('seq 1 20000', Key.ENTER);
    ok('20 000 líneas', /20000/.test(await waitTerm(d, /20000/, 20000)));
    await ta.sendKeys('sleep 60', Key.ENTER); await d.sleep(500);
    await ta.sendKeys(Key.chord(Key.CONTROL, 'c')); await d.sleep(500);
    await ta.sendKeys('echo vivo', Key.ENTER);
    ok('Ctrl+C interrumpe', /^vivo/m.test(await waitTerm(d, /^vivo/m)));

    // El orden de las teclas se conserva aunque se escriba muy rápido (regresión: invokes concurrentes).
    const payload = Array.from({ length: 10 }, (_, i) => 'k' + i + 'abcdefghij0123456789').join('');
    let bad = 0;
    for (let r = 0; r < 20; r++) {
      await ta.sendKeys('echo OUT' + r + ':' + payload, Key.ENTER);
      await d.sleep(450);
      const tx = (await termText(d)).replace(/\n/g, '');
      if (!tx.includes('OUT' + r + ':' + payload + 'root')) bad++;
    }
    ok('entrada rápida sin desorden', bad === 0, bad + '/20 rondas desordenadas');

    await ta.sendKeys('exit', Key.ENTER); await d.sleep(1200);
    ok('exit → Detenida', /Detenida/.test(await js(d, `return document.querySelector('.au-terminal-real__meta')?.textContent||''`)));
  } finally { await d.quit(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
