# Deploy — AWS Lightsail + nginx + pm2 + GitHub Actions (SSH)

O deploy conecta via SSH direto na instância a cada push na `main`. Lá, o
próprio servidor tem um `git clone` do repositório `school-api`; o workflow
só faz `git pull`, escreve um `.env` novo a partir dos secrets do GitHub,
builda e recarrega o pm2. Nada é buildado no runner do GitHub nem copiado
por SCP.

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

Isso instala Node 20, pm2, nginx, git e Docker, sobe o MongoDB (container
isolado, só em `127.0.0.1`) e clona o repositório em `/opt/school-api`. Ao
final ele imprime os passos manuais restantes (chave SSH, nginx, firewall,
certbot).

## 3. Chave SSH dedicada para o GitHub Actions conectar na instância

Gere um par de chaves só para isso (não reuse sua chave pessoal):

```bash
ssh-keygen -t ed25519 -f school_api_deploy_key -C "github-actions-deploy" -N ""
```

Isso cria dois arquivos:

- `school_api_deploy_key` — a chave **privada**. Vai para o secret
  `LIGHTSAIL_SSH_KEY` no GitHub (conteúdo completo do arquivo, incluindo as
  linhas `BEGIN`/`END`).
- `school_api_deploy_key.pub` — a chave **pública**. Vai para a instância:

```bash
cat school_api_deploy_key.pub | ssh ubuntu@SEU-IP "cat >> ~/.ssh/authorized_keys"
```

Como os repositórios `school-api` e `school-web` são públicos, essa é a
**única** chave SSH necessária — ela serve para o GitHub Actions entrar na
instância; o `git pull` que a instância faz do próprio GitHub não precisa de
credencial (repo público). Se um dia os repositórios ficarem privados, será
necessário adicionar uma segunda chave (deploy key, só leitura) nas
configurações do repositório no GitHub para o `git pull` funcionar.

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

`.github/workflows/deploy.yml` roda a cada push na `main`:

1. Conecta via SSH na instância.
2. Escreve `/opt/school-api/.env` com os valores acima.
3. `git fetch && git reset --hard origin/main`.
4. `npm ci && npm run build`.
5. `pm2 reload ecosystem.config.js --env production` (ou `pm2 start` no
   primeiro deploy) e `pm2 save`.

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
