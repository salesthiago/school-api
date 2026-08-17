#!/usr/bin/env bash
# Provisionamento inicial da instância AWS Lightsail (Ubuntu 22.04/24.04) para
# rodar o backend (repo `school-api`) com Node.js + pm2 + nginx, e o MongoDB
# em um container Docker isolado (sem expor a porta publicamente).
#
# Rode uma única vez, como o usuário com sudo (ex.: `ubuntu` no Lightsail):
#   chmod +x setup-server.sh
#   ./setup-server.sh
#
# Idempotente na maior parte dos passos (seguro rodar de novo).

set -euo pipefail

REPO_URL="https://github.com/salesthiago/school-api.git"
APP_DIR="/opt/school-api"
APP_USER="$(whoami)"
NODE_MAJOR=20

echo "==> Atualizando pacotes do sistema"
sudo apt-get update -y
sudo apt-get upgrade -y

echo "==> Instalando Node.js ${NODE_MAJOR}.x"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "==> Instalando pm2 globalmente"
sudo npm install -g pm2

echo "==> Instalando nginx e git"
sudo apt-get install -y nginx git

echo "==> Instalando Docker (para rodar o MongoDB isolado)"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$APP_USER"
  echo "    Adicionado $APP_USER ao grupo docker. Talvez precise reabrir a sessão SSH."
fi

echo "==> Subindo o MongoDB (container local, porta só em 127.0.0.1)"
if ! sudo docker ps -a --format '{{.Names}}' | grep -qx school-api-mongo; then
  sudo docker volume create school_api_mongo_data
  sudo docker run -d \
    --name school-api-mongo \
    --restart unless-stopped \
    -p 127.0.0.1:27017:27017 \
    -v school_api_mongo_data:/data/db \
    mongo:7
else
  echo "    Container school-api-mongo já existe, pulando."
fi

echo "==> Clonando o repositório em ${APP_DIR} (repo público, sem chave de deploy)"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "    ${APP_DIR} já é um repositório git, pulando o clone."
fi

echo "==> Configurando pm2 para iniciar no boot"
pm2 startup systemd -u "$APP_USER" --hp "$HOME" | tail -n 1 | sudo bash || true

cat <<'EOF'

==> Provisionamento base concluído. Passos manuais restantes:

1. Adicione a chave pública SSH gerada para o deploy (veja backend/deploy/README.md)
   em ~/.ssh/authorized_keys deste usuário, para o GitHub Actions conseguir
   conectar.

2. Configure o site do nginx (veja backend/deploy/nginx/school-api.conf):
     sudo cp deploy/nginx/school-api.conf /etc/nginx/sites-available/school-api
     sudo ln -s /etc/nginx/sites-available/school-api /etc/nginx/sites-enabled/
     sudo nginx -t && sudo systemctl reload nginx

3. Abra as portas 80 e 443 no firewall de rede do Lightsail (painel AWS).
   Restrinja a porta 22 (SSH) ao seu IP sempre que possível.
   NÃO abra a porta 3000 publicamente — o nginx é quem fala com o Node.

4. Depois de ter um domínio apontando para a instância, rode o certbot para
   HTTPS:
     sudo apt-get install -y certbot python3-certbot-nginx
     sudo certbot --nginx -d SEU-DOMINIO-DA-API

5. Primeiro deploy: rode o workflow do GitHub Actions manualmente (aba
   Actions → Deploy → Run workflow) depois de cadastrar os secrets — ele
   gera o .env, faz build e sobe o pm2 sozinho. Não precisa fazer nada manual
   em ${APP_DIR} além do clone acima.
EOF
