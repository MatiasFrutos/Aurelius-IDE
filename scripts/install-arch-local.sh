#!/usr/bin/env bash

set -euo pipefail

APP_NAME="Aurelius IDE"
APP_ID="aurelius-ide"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RELEASE_BIN="$PROJECT_DIR/src-tauri/target/release/aurelius-ide"
INSTALL_BIN="/usr/local/bin/aurelius-ide"

ICON_SOURCE="$PROJECT_DIR/src-tauri/icons/128x128.png"
ICON_DIR="/usr/share/icons/hicolor/128x128/apps"
ICON_TARGET="$ICON_DIR/aurelius-ide.png"

DESKTOP_FILE="/usr/share/applications/aurelius-ide.desktop"

echo "======================================"
echo " Instalando $APP_NAME en Arch/Omarchy"
echo "======================================"
echo ""

cd "$PROJECT_DIR"

echo "1) Generando build Tauri production..."
npm run tauri build -- --bundles deb

if [ ! -f "$RELEASE_BIN" ]; then
  echo "ERROR: No se encontró el binario release:"
  echo "$RELEASE_BIN"
  exit 1
fi

if [ ! -f "$ICON_SOURCE" ]; then
  echo "ERROR: No se encontró el icono:"
  echo "$ICON_SOURCE"
  exit 1
fi

echo ""
echo "2) Instalando binario production en $INSTALL_BIN..."
sudo install -Dm755 "$RELEASE_BIN" "$INSTALL_BIN"

echo ""
echo "3) Instalando icono en $ICON_TARGET..."
sudo install -Dm644 "$ICON_SOURCE" "$ICON_TARGET"

echo ""
echo "4) Creando launcher .desktop..."
sudo tee "$DESKTOP_FILE" > /dev/null <<EOF
[Desktop Entry]
Type=Application
Name=Aurelius IDE
Comment=Lightweight Linux-first code editor
Exec=/usr/local/bin/aurelius-ide %F
Icon=aurelius-ide
Terminal=false
Categories=Development;IDE;TextEditor;
StartupNotify=true
StartupWMClass=Aurelius IDE
MimeType=text/plain;text/x-c;text/x-c++;text/x-python;text/javascript;text/css;text/html;application/json;
EOF

echo ""
echo "5) Actualizando base de datos de launchers e iconos..."

if command -v update-desktop-database >/dev/null 2>&1; then
  sudo update-desktop-database /usr/share/applications || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  sudo gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

echo ""
echo "======================================"
echo " Aurelius IDE instalado correctamente"
echo "======================================"
echo ""
echo "Podés abrirlo con:"
echo "  aurelius-ide"
echo ""
echo "O buscarlo en el launcher como:"
echo "  Aurelius IDE"
echo ""
