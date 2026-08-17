# Deploy — AWS Lightsail + nginx + pm2 + GitHub Actions (SSH)

A cada push na `main`, o GitHub Actions builda o checkout, sincroniza os
arquivos via **rsync** direto para `/opt/school-api` na instância (sem
precisar de `git` instalado no servidor), escreve um `.env` novo a partir
dos secrets, instala dependências, builda e recarrega o pm2 via SSH.

## 1. Bucket S3 e usuário IAM para os anexos das aulas

Os anexos das aulas (PDFs etc, módulo `attachments`) ficam num bucket S3
privado — o backend nunca torna o bucket público, só gera URLs assinadas
temporárias (`getSignedUrl`, mesmo padrão de hoje com o disco local).

1. Crie o bucket (console AWS ou CLI), região à sua escolha, com **Block all
   public access** ativado:
   ```bash
   aws s3api create-bucket --bucket SEU-BUCKET --region us-east-1
   aws s3api put-public-access-block --bucket SEU-BUCKET --public-access-block-configuration \
     BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   ```
2. Crie um usuário IAM **dedicado** (não reuse sua conta root/admin) com
   permissão só nesse bucket:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::SEU-BUCKET/*"
       }
     ]
   }
   ```
3. Gere uma access key para esse usuário (`Security credentials → Create
   access key`) — os valores vão nos secrets `AWS_ACCESS_KEY_ID` e
   `AWS_SECRET_ACCESS_KEY` (seção 4).

## 2. Provisionar a instância (uma vez só)

```bash
scp -r backend/deploy ubuntu@SEU-IP:~/deploy
ssh ubuntu@SEU-IP
cd ~/deploy
chmod +x setup-server.sh
./setup-server.sh
```

Isso instala Node 20, pm2, nginx e Docker, sobe o MongoDB (container
isolado, só em `127.0.0.1`) e cria `/opt/school-api` (vazio — o código
chega ali via rsync a cada deploy, não por `git clone`). Ao final ele
imprime os passos manuais restantes (chave SSH, nginx, firewall, certbot).

## 3. Chave SSH para o GitHub Actions conectar na instância

Essa é a única chave necessária — o workflow usa ela tanto para o rsync
quanto para rodar os comandos remotos (`npm ci`, build, pm2). O conteúdo
**completo** do arquivo `.pem`/chave privada (com as linhas `BEGIN`/`END`)
vai no secret `LIGHTSAIL_SSH_KEY`. Prefira setar via `gh` CLI a colar na UI
do GitHub — copy/paste manual costuma corromper quebras de linha e quebra o
parse da chave (`ssh: no key found`):

```bash
gh secret set LIGHTSAIL_SSH_KEY --repo salesthiago/school-api --body-file "CAMINHO\PARA\SUA_CHAVE.pem"
```

**Chave dedicada vs. chave default da conta**: usar a chave `.pem` default
da conta/região do Lightsail funciona (é o que este projeto está usando
hoje), mas se ela vazar dá acesso a *qualquer* instância sua que use a
mesma chave. Quando estiver tudo estável, vale trocar por uma chave
dedicada só a esse deploy:

```bash
ssh-keygen -t ed25519 -f school_api_deploy_key -C "github-actions-deploy" -N ""
cat school_api_deploy_key.pub | ssh SEU-USUARIO@SEU-IP "cat >> ~/.ssh/authorized_keys"
gh secret set LIGHTSAIL_SSH_KEY --repo salesthiago/school-api --body-file school_api_deploy_key
```

## 4. Secrets a cadastrar no GitHub

Repositório `school-api` → **Settings → Secrets and variables → Actions →
New repository secret**.

### Conexão SSH (usadas pelo workflow para entrar na instância)

| Secret              | Valor                                              |
| ------------------- | --------------------------------------------------- |
| `LIGHTSAIL_HOST`     | IP público (ou domínio) da instância                 |
| `LIGHTSAIL_USER`     | usuário SSH (ex.: `ubuntu`)                          |
| `LIGHTSAIL_SSH_KEY`  | conteúdo da chave **privada** `school_api_deploy_key`|
| `LIGHTSAIL_PORT`     | opcional, só se o SSH não estiver na porta 22        |

### Conteúdo do `.env` de produção (reescrito a cada deploy)

Todo push na `main` regenera `/opt/school-api/.env` inteiro a partir destes
secrets — não edite o `.env` manualmente na instância, ele é sobrescrito no
próximo deploy.

| Secret                  | Exemplo / observação                                          |
| ------------------------ | -------------------------------------------------------------- |
| `API_PUBLIC_URL`         | `https://api.seudominio.com/api`                                |
| `FRONTEND_URL`           | `https://seu-frontend-em-producao.com`                          |
| `CORS_ORIGIN`            | mesmo domínio do `FRONTEND_URL` (ou lista separada por vírgula) |
| `MONGODB_URI`            | `mongodb://localhost:27017/gpschool` (Mongo roda na própria instância) |
| `JWT_ACCESS_SECRET`      | gerar com `openssl rand -hex 32`                                |
| `JWT_REFRESH_SECRET`     | gerar com `openssl rand -hex 32`                                |
| `STORAGE_SIGNING_SECRET` | gerar com `openssl rand -hex 32` (só usada pelo driver `local`)  |
| `AWS_REGION`             | região do bucket S3, ex.: `us-east-1`                            |
| `AWS_S3_BUCKET`          | nome do bucket S3 dos anexos das aulas                           |
| `AWS_ACCESS_KEY_ID`      | usuário IAM dedicado, só com permissão no bucket acima            |
| `AWS_SECRET_ACCESS_KEY`  | secret do mesmo usuário IAM                                      |
| `ITAU_CLIENT_ID`         | credencial real do Itaú                                         |
| `ITAU_CLIENT_SECRET`     | credencial real do Itaú                                         |
| `ITAU_CERTIFICATE_PATH`  | caminho do certificado **já presente na instância** (veja nota) |
| `ITAU_WEBHOOK_SECRET`    | gerar com `openssl rand -hex 32` (ou valor combinado com o Itaú)|

Os campos `PORT`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `UPLOAD_DIR`,
`STORAGE_DRIVER` e `NODE_ENV` não mudam entre deploys, então ficam fixos
direto no `backend/.github/workflows/deploy.yml` — não precisam de secret.
Em produção `STORAGE_DRIVER=s3` fica fixo no workflow (os anexos das aulas
vão para o S3, não para o disco da instância).

> **Nota sobre `ITAU_CERTIFICATE_PATH`**: é só o *caminho* do arquivo, não o
> certificado em si — o `.p12`/`.pem` precisa ser enviado manualmente para a
> instância (ex.: `scp certificado.pem ubuntu@SEU-IP:/opt/school-api/certs/`)
> e o secret deve apontar para esse caminho. O deploy automático nunca lida
> com o arquivo do certificado.

## 5. Como o deploy funciona

`.github/workflows/deploy.yml` roda a cada push na `main`, em 5 steps
separados (cada um com log próprio no Actions):

1. **Checkout** — baixa o código no runner do GitHub.
2. **Configurar chave SSH** — grava `LIGHTSAIL_SSH_KEY` em `~/.ssh/deploy_key`
   e faz `ssh-keyscan` do host.
3. **Preparar diretório remoto** — `mkdir -p /opt/school-api` + `chown` na
   instância (idempotente, não falha se já existir).
4. **Sincronizar via rsync** — copia o repo do runner para
   `/opt/school-api`, excluindo `.git`, `.github`, `node_modules`, `dist`,
   `.env` e `uploads` (o `--delete` remove na instância o que não existe
   mais no repo, exceto o que está excluído).
5. **Instalar dependências, buildar e reiniciar PM2** — via
   `appleboy/ssh-action`: escreve `/opt/school-api/.env` a partir dos
   secrets (encaminhados como variáveis de ambiente via `envs:`), roda
   `npm ci && npm run build && npm prune --omit=dev`, depois
   `pm2 startOrReload ecosystem.config.js --env production` e `pm2 save`.

Rodar manualmente: aba **Actions** → *Deploy* → **Run workflow**.

## 6. Depois do deploy

- Logs: `pm2 logs gpschool-backend`
- Status: `pm2 status`
- Reiniciar manualmente: `pm2 restart gpschool-backend`
- Logs do Mongo: `sudo docker logs school-api-mongo`

## Checklist de segurança

- [ ] Porta 3000 fechada no firewall do Lightsail (só nginx fala com o Node)
- [ ] Porta 22 restrita ao seu IP, se possível
- [ ] Chave `LIGHTSAIL_SSH_KEY` dedicada ao deploy (não a sua chave pessoal)
- [ ] Segredos de produção (`JWT_*`, `STORAGE_SIGNING_SECRET`) diferentes dos
      usados em dev
- [ ] `CORS_ORIGIN` apontando só para o domínio real do frontend em produção
- [ ] HTTPS via certbot assim que o domínio da API estiver configurado
- [ ] Bucket S3 dos anexos com "Block all public access" ativado
- [ ] Usuário IAM do S3 sem permissão além do bucket dos anexos
