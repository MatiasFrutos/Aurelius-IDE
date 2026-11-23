# Pruebas en la app real

Las suites de `Playwright` (en el entorno de desarrollo) usan un Tauri simulado. Estas, en cambio, abren el **binario real**
(Tauri + WebKitGTK + PTY del sistema) con `tauri-driver` y Selenium, dentro de un display virtual (Xvfb).

```bash
sudo apt install xvfb xdotool webkit2gtk-driver      # o el equivalente de tu distro
cargo install tauri-driver --locked
./scripts/e2e-real/run.sh                    # terminal + editor + ratón real
./scripts/e2e-real/run.sh terminal           # solo una
```

Crean un proyecto de ejemplo en `/tmp/proj` y lo abren restaurando la sesión (`~/.config/aurelius-ide/session.json`).
Cubren: terminal (eco, cwd, UTF-8, ANSI, 20 000 líneas, Ctrl+C, orden de teclas con escritura rápida, `exit`) y editor
(resaltado, autocierre de paréntesis, guardado en disco con Ctrl+S, comentar, buscar, autocompletado, paleta).
`AURELIUS_BIN` permite apuntar a otro binario.
