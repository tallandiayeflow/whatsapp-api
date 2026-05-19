# OpenWA — Guide de Déploiement Complet

## Architecture cible

```
Internet
   │ 80/443
   ▼
Nginx (VPS 91.134.143.81)
   ├── api.noor-boutique.com   → localhost:2785 (OpenWA API Docker)
   └── dash.noor-boutique.com  → /var/www/openwa-dashboard (React SPA statique)
```

**Infos VPS :**
- IP : 91.134.143.81
- OS : Ubuntu
- Reverse proxy : Nginx (gère SSL)
- Traefik : désactivé (`PROXY_ENABLED=false`)
- Dashboard container : désactivé (`DASHBOARD_ENABLED=false`), servi par Nginx

---

## ÉTAPE 1 — DNS

Chez le registrar `noor-boutique.com`, ajouter 2 enregistrements **A** :

| Nom    | Type | Valeur          | TTL  |
|--------|------|-----------------|------|
| `api`  | A    | `91.134.143.81` | 3600 |
| `dash` | A    | `91.134.143.81` | 3600 |

Vérifier propagation :
```bash
ping api.noor-boutique.com   # → 91.134.143.81
ping dash.noor-boutique.com  # → 91.134.143.81
```

---

## ÉTAPE 2 — Préparer le VPS

### 2.1 Connexion SSH
```bash
ssh user@91.134.143.81
```

### 2.2 Installer Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

### 2.3 Créer dossier dashboard
```bash
sudo mkdir -p /var/www/openwa-dashboard
sudo chown $USER:$USER /var/www/openwa-dashboard
```

### 2.4 Ouvrir les ports
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

---

## ÉTAPE 3 — Cloner le projet

```bash
sudo mkdir -p /opt/openwa
sudo chown $USER:$USER /opt/openwa
git clone https://github.com/tallandiayeflow/whatsapp-api.git /opt/openwa
cd /opt/openwa
```

---

## ÉTAPE 4 — Configurer `.env`

```bash
nano /opt/openwa/.env
```

```bash
# Core
NODE_ENV=production
LOG_LEVEL=info

# Domaine
DOMAIN=api.noor-boutique.com

# Nginx gère SSL — Traefik et dashboard container désactivés
PROXY_ENABLED=false
DASHBOARD_ENABLED=false

# CORS — dashboard sur même VPS
CORS_ORIGINS=https://dash.noor-boutique.com

# Base de données PostgreSQL (alwaysdata)
DATABASE_TYPE=postgres
DATABASE_HOST=postgresql-devperso.alwaysdata.net
DATABASE_PORT=5432
DATABASE_NAME=devperso_openwa
DATABASE_USERNAME=devperso
DATABASE_PASSWORD=METTRE_LE_MOT_DE_PASSE_ICI
DATABASE_SYNCHRONIZE=false
DATABASE_LOGGING=false

# Engine WhatsApp
ENGINE_TYPE=whatsapp-web.js
SESSION_DATA_PATH=./data/sessions
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu

# Storage local
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./data/media

# Redis désactivé
REDIS_ENABLED=false

# Plugins
PLUGINS_ENABLED=true
PLUGINS_DIR=./data/plugins

# Sécurité
API_MASTER_KEY=

# Swagger
ENABLE_SWAGGER=true
```

---

## ÉTAPE 5 — Nginx + SSL

> **Important :** écrire la config HTTP-only d'abord, activer, puis lancer Certbot.
> Certbot modifie automatiquement la config pour ajouter SSL.
> Ne pas référencer les certificats SSL avant qu'ils existent.

### 5.1 Config HTTP-only (avant Certbot)
```bash
sudo tee /etc/nginx/sites-available/openwa > /dev/null << 'EOF'
# ── API Backend ──────────────────────────────────────────────
server {
    listen 80;
    server_name api.noor-boutique.com;

    proxy_connect_timeout 60s;
    proxy_send_timeout    300s;
    proxy_read_timeout    300s;

    location /api/ {
        proxy_pass http://127.0.0.1:2785;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:2785;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_set_header X-Real-IP  $remote_addr;
        proxy_read_timeout 86400;
    }
}

# ── Dashboard Frontend ────────────────────────────────────────
server {
    listen 80;
    server_name dash.noor-boutique.com;

    root /var/www/openwa-dashboard;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

### 5.2 Activer
```bash
sudo ln -sf /etc/nginx/sites-available/openwa /etc/nginx/sites-enabled/openwa
sudo nginx -t       # doit afficher : syntax is ok
sudo systemctl reload nginx
```

### 5.3 Certificats SSL (Certbot modifie la config automatiquement)
```bash
sudo apt install certbot python3-certbot-nginx -y

sudo certbot --nginx \
  -d api.noor-boutique.com \
  -d dash.noor-boutique.com
# Email : ndiayetalla928@gmail.com
# CGU : Y
# Redirection HTTP→HTTPS : 2
```

### 5.4 Recharger Nginx
```bash
sudo systemctl reload nginx
```

---

## ÉTAPE 6 — Builder le Dashboard

```bash
cd /opt/openwa/dashboard
npm install
VITE_API_URL=https://api.noor-boutique.com/api npm run build
cp -r dist/* /var/www/openwa-dashboard/
```

Vérifier :
```bash
curl https://dash.noor-boutique.com
# Doit retourner du HTML
```

---

## ÉTAPE 7 — Lancer OpenWA API

```bash
cd /opt/openwa
chmod +x scripts/openwa.sh

./scripts/openwa.sh build   # ~5-10 min (build Docker image)
./scripts/openwa.sh start
./scripts/openwa.sh status
```

Tester :
```bash
curl https://api.noor-boutique.com/api/health
# {"status":"ok","database":{"main":"connected","data":"connected"},...}
```

Logs si problème :
```bash
docker logs openwa-api --tail 50
./scripts/openwa.sh logs openwa-api 200
```

---

## ÉTAPE 8 — Récupérer la clé API

La clé API est générée au premier démarrage et affichée dans les logs Docker.
Elle est stockée dans un volume Docker nommé (pas accessible directement sur le host).

```bash
docker logs openwa-api 2>&1 | grep "owa_k1_"
# owa_k1_xxxxxxxxxxxxxxxxxxxxx  ← noter cette clé
```

Swagger UI : `https://api.noor-boutique.com/api/docs`

Tester avec la clé :
```bash
curl https://api.noor-boutique.com/api/sessions \
  -H "X-API-Key: owa_k1_xxx..."
```

---

## ÉTAPE 9 — Démarrage automatique au reboot

```bash
sudo tee /etc/systemd/system/openwa.service > /dev/null << EOF
[Unit]
Description=OpenWA WhatsApp API
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/openwa
ExecStart=/opt/openwa/scripts/openwa.sh start
ExecStop=/opt/openwa/scripts/openwa.sh stop
User=$USER

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable openwa
sudo systemctl start openwa
```

---

## ÉTAPE 10 — CI/CD (déploiement automatique)

Chaque push sur `main` déclenche le pipeline GitHub Actions :
lint → test → build → docker → **deploy automatique sur VPS**.

### 10.1 Créer les secrets GitHub

Aller sur : **github.com/tallandiayeflow/whatsapp-api → Settings → Secrets and variables → Actions**

| Secret        | Valeur                    |
|---------------|---------------------------|
| `VPS_HOST`    | `91.134.143.81`           |
| `VPS_USER`    | ton user SSH (ex: `openwa`) |
| `VPS_SSH_KEY` | clé SSH privée (voir ci-dessous) |

### 10.2 Générer la clé SSH pour GitHub Actions

```bash
# Sur le VPS
ssh-keygen -t ed25519 -C "github-actions"
# Appuyer Enter 3 fois (pas de passphrase, chemin par défaut)

cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys

# Copier le contenu ci-dessous dans le secret VPS_SSH_KEY
cat ~/.ssh/id_ed25519
```

### 10.3 Flux CI/CD

```
git push origin main
    │
    ├── lint (ESLint backend + frontend)
    ├── test (Jest 110 tests)
    ├── dashboard (build React)
    ├── build (compile TypeScript)
    ├── docker (build + push ghcr.io)
    └── deploy (SSH → git pull + rebuild + restart + dashboard)
```

---

## Mise à jour manuelle

Si besoin de mettre à jour sans attendre le CI :

```bash
cd /opt/openwa
git pull
./scripts/openwa.sh build
./scripts/openwa.sh restart

# Dashboard si changements frontend
cd /opt/openwa/dashboard
npm install
VITE_API_URL=https://api.noor-boutique.com/api npm run build
cp -r dist/* /var/www/openwa-dashboard/
```

---

## Commandes de maintenance

```bash
./scripts/openwa.sh status    # état containers
./scripts/openwa.sh logs      # logs live API
./scripts/openwa.sh restart   # redémarrer
./scripts/openwa.sh stop      # arrêter
docker logs openwa-api --tail 100   # logs détaillés
```

---

## Résultat final

```
https://dash.noor-boutique.com          ← Dashboard React (Nginx → /var/www/openwa-dashboard)
        │
        │ VITE_API_URL=https://api.noor-boutique.com/api
        ▼
https://api.noor-boutique.com/api       ← OpenWA API (Nginx → localhost:2785)
        │
        ├── Docker (openwa-api container)
        ├── Sessions WhatsApp (Chromium/Puppeteer)
        └── PostgreSQL (alwaysdata externe)

git push main → GitHub Actions → SSH deploy automatique
```

---

## Utiliser l'API depuis une autre app

### Créer une session WhatsApp
```bash
# 1. Créer session
curl -X POST https://api.noor-boutique.com/api/sessions \
  -H "X-API-Key: owa_k1_xxx..." \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "ma-session"}'

# 2. Scanner QR (base64 → https://base64.guru/converter/decode/image)
curl https://api.noor-boutique.com/api/sessions/ma-session/qr \
  -H "X-API-Key: owa_k1_xxx..."

# 3. Vérifier statut (attendre "ready")
curl https://api.noor-boutique.com/api/sessions/ma-session \
  -H "X-API-Key: owa_k1_xxx..."
```

### Envoyer un message
```bash
curl -X POST https://api.noor-boutique.com/api/sessions/ma-session/messages/send-text \
  -H "X-API-Key: owa_k1_xxx..." \
  -H "Content-Type: application/json" \
  -d '{"to": "221771234567@c.us", "text": "Bonjour!"}'
```

Format numéro : `[indicatif_pays][numéro]@c.us` → ex: `221784448928@c.us`

Documentation complète : `https://api.noor-boutique.com/api/docs`

---

## Checklist

- [x] DNS — enregistrements A `api` et `dash` créés
- [x] DNS propagé — `ping api.noor-boutique.com` → `91.134.143.81`
- [x] Docker installé sur le VPS
- [x] `/var/www/openwa-dashboard` créé
- [x] Repo cloné dans `/opt/openwa`
- [x] `.env` configuré (`DATABASE_PASSWORD` renseigné, `PROXY_ENABLED=false`)
- [x] Nginx config HTTP-only créée et activée (`sudo nginx -t` → OK)
- [x] Certbot exécuté — SSL ajouté automatiquement
- [x] Dashboard buildé avec `VITE_API_URL` et copié dans `/var/www/openwa-dashboard`
- [x] `./scripts/openwa.sh build` terminé sans erreur
- [x] `./scripts/openwa.sh start` → container UP
- [x] `curl https://api.noor-boutique.com/api/health` → `{"status":"ok"}`
- [x] `curl https://dash.noor-boutique.com` → HTML retourné
- [ ] Clé API récupérée depuis `docker logs openwa-api`
- [ ] Service systemd activé (démarrage auto au reboot)
- [ ] Secrets GitHub Actions configurés (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`)
- [ ] CI/CD testé — pipeline vert sur main
