#!/usr/bin/env bash
# Compila Aurelius IDE y crea el instalador de Arch/Omarchy: aurelius-ide-<versión>-1-x86_64.pkg.tar.zst
#
# Uso (desde cualquier carpeta del proyecto):
#   ./packaging/arch/build-pkg.sh              # compila y crea el paquete
#   ./packaging/arch/build-pkg.sh --install    # además lo instala con pacman
#   ./packaging/arch/build-pkg.sh --skip-build # reutiliza el binario ya compilado (solo reempaqueta)
set -euo pipefail

INSTALL=0
SKIP_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opción desconocida: $arg (usa --help)" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1;32m==>\033[0m \033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PKG_SRC="$ROOT/packaging/arch"
BUILD="$PKG_SRC/.build"
OUT="$ROOT/release"
BIN="$ROOT/src-tauri/target/release/aurelius-ide"
ICON="$ROOT/src-tauri/icons/128x128@2x.png"
cd "$ROOT"

[ "$(id -u)" -ne 0 ] || die "No ejecutes este script como root (makepkg no lo permite). Te pedirá sudo solo al instalar."

# --- 1. Dependencias --------------------------------------------------------
say "Comprobando herramientas"
missing=()
for cmd in node npm cargo makepkg; do
  command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
done

if [ "${#missing[@]}" -gt 0 ]; then
  cat >&2 <<MSG
Faltan: ${missing[*]}

Instálalas con:
  sudo pacman -S --needed base-devel nodejs npm rustup webkit2gtk-4.1 gtk3 librsvg openssl
  rustup default stable
MSG
  exit 1
fi

if [ "$SKIP_BUILD" -eq 0 ] && command -v pkg-config >/dev/null 2>&1 && ! pkg-config --exists webkit2gtk-4.1; then
  die "Falta webkit2gtk-4.1: sudo pacman -S --needed webkit2gtk-4.1 gtk3 librsvg"
fi

VERSION="$(node -p "require('./package.json').version")"
[[ "$VERSION" =~ ^[0-9][0-9A-Za-z._]*$ ]] || die "Versión inválida en package.json: $VERSION"
echo "Versión: $VERSION"

# --- 2. Compilar ------------------------------------------------------------
if [ "$SKIP_BUILD" -eq 0 ]; then
  say "Instalando dependencias de npm"
  npm install --no-audit --no-fund

  say "Compilando (frontend + Rust en modo release; la primera vez tarda varios minutos)"
  npm run tauri build -- --no-bundle
fi

[ -x "$BIN" ] || die "No existe el binario $BIN. Ejecuta el script sin --skip-build."
[ -f "$ICON" ] || die "No encuentro el icono $ICON."

# --- 3. Preparar el paquete (carpeta temporal, no toca los archivos versionados) ----
say "Preparando el paquete"
rm -rf "$BUILD"
mkdir -p "$BUILD" "$OUT"
cp "$BIN" "$BUILD/aurelius-ide"
cp "$ICON" "$BUILD/aurelius-ide.png"
cp "$PKG_SRC/aurelius-ide.desktop" "$BUILD/aurelius-ide.desktop"

cat > "$BUILD/PKGBUILD" <<PKGBUILD
pkgname=aurelius-ide
pkgver=$VERSION
pkgrel=1
pkgdesc="Aurelius IDE - IDE nativo, rápido y minimalista para Linux"
arch=('x86_64')
url="https://github.com/MatiasFrutos/Aurelius-IDE"
license=('custom')
depends=('gtk3' 'webkit2gtk-4.1')
optdepends=(
  'git: Centro de Git'
  'speech-dispatcher: leer respuestas en voz alta'
  'espeak-ng: voz alternativa'
  'pipewire: grabación para el asistente de voz'
  'whisper.cpp: reconocimiento de voz local'
)
options=('!debug')
source=('aurelius-ide' 'aurelius-ide.png' 'aurelius-ide.desktop')
sha256sums=('SKIP' 'SKIP' 'SKIP')

package() {
  install -Dm755 "\$srcdir/aurelius-ide" "\$pkgdir/usr/bin/aurelius-ide"
  install -Dm644 "\$srcdir/aurelius-ide.png" "\$pkgdir/usr/share/icons/hicolor/256x256/apps/aurelius-ide.png"
  install -Dm644 "\$srcdir/aurelius-ide.desktop" "\$pkgdir/usr/share/applications/aurelius-ide.desktop"
}
PKGBUILD

# --- 4. Crear el instalador -------------------------------------------------
say "Creando el instalador (.pkg.tar.zst)"
( cd "$BUILD" && PKGDEST="$OUT" makepkg -f --nodeps --noconfirm )

PKGFILE="$(ls -t "$OUT"/aurelius-ide-"$VERSION"-*-x86_64.pkg.tar.zst 2>/dev/null | head -n1 || true)"
[ -n "$PKGFILE" ] || die "makepkg terminó pero no encuentro el paquete en $OUT"

say "Listo"
echo "Instalador: $PKGFILE"
echo "Instalar:   sudo pacman -U \"$PKGFILE\""
echo "Quitar:     sudo pacman -R aurelius-ide"

# --- 5. Instalar (opcional) -------------------------------------------------
if [ "$INSTALL" -eq 1 ]; then
  say "Instalando con pacman"
  sudo pacman -U --noconfirm "$PKGFILE"
  echo "Instalado. Ábrelo desde el menú de aplicaciones o con: aurelius-ide"
fi
