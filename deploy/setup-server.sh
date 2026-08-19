#!/usr/bin/env bash
# Provisionamento inicial da instância AWS Lightsail (Ubuntu 22.04/24.04) para
# rodar o backend (repo `school-api`) com Node.js + pm2 + nginx.
#
# O MongoDB não é instalado por este script — é instalado/gerenciado
# manualmente na instância (não usamos Docker neste projeto).
#
# O código chega na instância via rsync a cada deploy do GitHub Actions (não
# por git clone) — este script só prepara o SO: Node, pm2 e nginx.
#
# Rode uma única vez, como o usuário com sudo (ex.: `ubuntu` no Lightsail):
#   chmod +x setup-server.sh
#   ./setup-server.sh
#
# Idempotente na maior parte dos passos (seguro rodar de novo).

set -euo pipefail

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

echo "==> Instalando nginx"
sudo apt-get install -y nginx

echo "==> Criando diretório da aplicação em ${APP_DIR}"
sudo mkdir -p "$APP_DIR"
sudo chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "==> Configurando pm2 para iniciar no boot"
pm2 startup systemd -u "$APP_USER" --hp "$HOME" | tail -n 1 | sudo bash || true

cat <<'EOF'

==> Provisionamento base concluído. Passos manuais restantes:

1. Instale e configure o MongoDB manualmente nesta instância (não é feito
   por este script). MONGODB_URI no .env de produção deve apontar para ele.

2. Adicione a chave pública SSH gerada para o deploy (veja backend/deploy/README.md)
   em ~/.ssh/authorized_keys deste usuário, para o GitHub Actions conseguir
   conectar.

3. Configure o site do nginx (veja backend/deploy/nginx/school-api.conf):
     sudo cp deploy/nginx/school-api.conf /etc/nginx/sites-available/school-api
     sudo ln -s /etc/nginx/sites-available/school-api /etc/nginx/sites-enabled/
     sudo nginx -t && sudo systemctl reload nginx

4. Abra as portas 80 e 443 no firewall de rede do Lightsail (painel AWS).
   Restrinja a porta 22 (SSH) ao seu IP sempre que possível.
   NÃO abra a porta 3000 publicamente — o nginx é quem fala com o Node.

5. Depois de ter um domínio apontando para a instância, rode o certbot para
   HTTPS:
     sudo apt-get install -y certbot python3-certbot-nginx
     sudo certbot --nginx -d SEU-DOMINIO-DA-API

6. Primeiro deploy: rode o workflow do GitHub Actions manualmente (aba
   Actions → Deploy → Run workflow) depois de cadastrar os secrets — ele
   builda no runner do GitHub, sincroniza o resultado via rsync, gera o
   .env e sobe o pm2 sozinho. Não precisa fazer nada manual em ${APP_DIR}.
EOF
