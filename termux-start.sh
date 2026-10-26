#!/data/data/com.termux/files/usr/bin/bash
set -e
termux-setup-storage || true
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_NAME="agenda-lena-base44-clone"

# Android bloqueia symlink dentro de Downloads. Se estiver em storage, copia para a área interna do Termux.
case "$PROJECT_DIR" in
  /storage/*|/sdcard/*|*/storage/downloads/*|*/storage/shared/*)
    echo "Projeto está em Downloads/armazenamento. Copiando para a pasta interna do Termux..."
    rm -rf "$HOME/$PROJECT_NAME"
    cp -r "$PROJECT_DIR" "$HOME/$PROJECT_NAME"
    cd "$HOME/$PROJECT_NAME"
    ;;
  *)
    cd "$PROJECT_DIR"
    ;;
esac

echo "Limpando instalação anterior..."
rm -rf node_modules package-lock.json
npm config set registry https://registry.npmjs.org/
npm config delete proxy >/dev/null 2>&1 || true
npm config delete https-proxy >/dev/null 2>&1 || true

echo "Instalando dependências..."
npm install --registry=https://registry.npmjs.org/

echo "Iniciando Agenda Lena Neuropsicóloga..."
npm run dev -- --host 0.0.0.0
