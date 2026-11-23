const { Builder, By, until, Key } = require('selenium-webdriver');
const fs = require('fs');
exports.Key = Key; exports.By = By;
function ensureDemoProject() {
  fs.mkdirSync('/tmp/proj/src', { recursive: true });
  const seed = { '/tmp/proj/a.js': 'const x = 1;\nfunction hola(a, b) {\n  return a + b;\n}\n', '/tmp/proj/b.py': 'print("py ok")\n', '/tmp/proj/README.md': '# Demo\n', '/tmp/proj/src/util.js': 'export const add = (a, b) => a + b;\n' };
  for (const [file, text] of Object.entries(seed)) fs.writeFileSync(file, text);
}

exports.start = async () => {
  ensureDemoProject();
  fs.mkdirSync('' + (process.env.HOME || '/root') + '/.config/aurelius-ide', { recursive: true });
  fs.writeFileSync('' + (process.env.HOME || '/root') + '/.config/aurelius-ide/session.json', JSON.stringify({ activity_panel: 'explorer', topbar_visible: true, sidebar_visible: true, right_panel_visible: true, bottom_panel_visible: true, sidebar_width: 286, right_panel_width: 360, bottom_panel_height: 260, active_right_panel: 'ai', active_bottom_panel: 'terminal', project_path: '/tmp/proj', active_file_path: null, open_tabs: [], expanded_folders: ['/tmp/proj/src'] }));
  const driver = await new Builder().usingServer('http://127.0.0.1:4444/').withCapabilities({ 'tauri:options': { application: '' + (process.env.AURELIUS_BIN || require('path').resolve(__dirname, '../../src-tauri/target/debug/aurelius-ide')) + '' }, browserName: 'wry' }).build();
  await driver.wait(until.elementLocated(By.css('#app *')), 25000);
  await driver.sleep(2000);
  await driver.wait(until.elementLocated(By.css('#explorer-tree .au-tree__row')), 20000);
  await driver.sleep(1200);
  return driver;
};
exports.shot = async (d, name) => fs.writeFileSync(`/tmp/sel/${name}.png`, await d.takeScreenshot(), 'base64');
exports.js = (d, code, ...a) => d.executeScript(code, ...a);
exports.termText = (d) => d.executeScript(`const rows=[...document.querySelectorAll('.xterm-rows > div')];return rows.map(r=>r.textContent).join('\\n')`);
exports.waitTerm = async (d, re, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const tx = await exports.termText(d); if (re.test(tx)) return tx; await d.sleep(150); } return await exports.termText(d); };
