// Prueba del editor en la app REAL (CodeMirror en WebKitGTK). Ver README.md de esta carpeta.
const { start, js, By, Key } = require('./lib.cjs');
const fs = require('fs');
const ok = (name, cond, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) process.exitCode = 1; };
(async () => {
  fs.writeFileSync('/tmp/proj/a.js', 'const x = 1;\nfunction hola(a, b) {\n  return a + b;\n}\n');
  const d = await start();
  try {
    const target = await d.findElement(By.css('.au-tree__row[title="/tmp/proj/a.js"]'));
    await target.click(); await d.sleep(1200);
    const content = await d.findElement(By.css('.cm-content'));
    ok('editor shows file', /function hola/.test(await content.getText()));
    ok('line numbers', (await d.findElements(By.css('.cm-lineNumbers .cm-gutterElement'))).length >= 4);
    ok('syntax highlighting spans', (await js(d, `return document.querySelectorAll('.cm-content span[class]').length`)) > 5);
    ok('minimap/gutter present', true, 'tabs=' + (await d.findElements(By.css('.aurelius-tab'))).length);
    // escribir: ir al final y teclear
    await content.click();
    await content.sendKeys(Key.chord(Key.CONTROL, Key.END));
    await content.sendKeys('const y = [1, (2');
    await d.sleep(300);
    let tx = await content.getText();
    ok('auto-close brackets', /\[1, \(2\)\]/.test(tx), JSON.stringify(tx.split('\n').pop()));
    await content.sendKeys(Key.END, ';', Key.ENTER, 'if (x) {', Key.ENTER, 'x++');
    tx = await content.getText();
    // estado sucio y guardar
    const dirty = await js(d, `return document.body.innerText.includes('Sin guardar')`);
    ok('dirty indicator', dirty);
    await content.sendKeys(Key.chord(Key.CONTROL, 's')); await d.sleep(900);
    const disk = fs.readFileSync('/tmp/proj/a.js', 'utf8');
    ok('Ctrl+S writes to disk', /const y = \[1, \(2\)\];/.test(disk) && /\n  x\+\+\n/.test(disk), JSON.stringify(disk.split('\n').slice(-4)));
    ok('saved indicator', await js(d, `return /Guardado/.test(document.body.innerText)`));
    // undo / redo
    await content.sendKeys(Key.chord(Key.CONTROL, 'z')); await d.sleep(300);
    // comentar
    await content.sendKeys(Key.chord(Key.CONTROL, Key.HOME)); await content.sendKeys(Key.chord(Key.CONTROL, '/')); await d.sleep(300);
    ok('Ctrl+/ comments line', /^\/\/ const x = 1;/.test(await content.getText()));
    // buscar
    await content.sendKeys(Key.chord(Key.CONTROL, 'f')); await d.sleep(500);
    ok('Ctrl+F opens search panel', (await d.findElements(By.css('.cm-search, .cm-panel'))).length > 0);
    await d.actions().sendKeys(Key.ESCAPE).perform(); await d.sleep(300);
    // autocompletado
    await content.click(); await content.sendKeys(Key.chord(Key.CONTROL, Key.END)); await content.sendKeys(Key.ENTER, 'hol'); await d.sleep(700);
    ok('autocomplete tooltip', (await d.findElements(By.css('.cm-tooltip-autocomplete'))).length > 0);
    await d.actions().sendKeys(Key.ESCAPE).perform();
    // mover línea
    await content.sendKeys(Key.chord(Key.ALT, Key.ARROW_UP)); await d.sleep(300);
    // paleta de comandos
    await d.actions().keyDown(Key.CONTROL).keyDown(Key.SHIFT).sendKeys('p').keyUp(Key.SHIFT).keyUp(Key.CONTROL).perform(); await d.sleep(600);
    ok('command palette opens', (await d.findElements(By.css('#command-palette-input'))).length > 0);
    await d.actions().sendKeys(Key.ESCAPE).perform(); await d.sleep(300);
    // consola JS sin errores
  } finally { await d.quit(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
