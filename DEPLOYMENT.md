# OpenWA — Guide de Déploiement Complet

## Architecture cible

```
Internet
   │ 80/443
   ▼
Nginx (VPS 91.134.143.81)
   ├── api.noor-boutique.com   → localhost:2785 (OpenWA API)
   └── dash.noor-boutique.com  → /var/www/openwa-dashboard (React SPA)
```

**Infos VPS :**
- IP : 91.134.143.81
- OS : Ubuntu
- Reverse proxy : Nginx (déjà en place)
- Traefik OpenWA : désactivé (`PROXY_ENABLED=false`)
- Dashboard : servi par Nginx directement (pas Vercel)

---

## ÉTAPE 1 — DNS (chez ton registrar noor-boutique.com)

Ajouter 2 enregistrements **A** :

| Nom   | Type | Valeur          | TTL  |
|-------|------|-----------------|------|
| `api` | A    | `91.134.143.81` | 3600 |
| `dash`| A    | `91.134.143.81` | 3600 |

Vérifier propagation (peut prendre 5 min à 24h) :
```bash
ping api.noor-boutique.com   # doit répondre 91.134.143.81
ping dash.noor-boutique.com  # doit répondre 91.134.143.81
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

## ÉTAPE 5 — Nginx

### 5.1 Créer la config
```bash
sudo tee /etc/nginx/sites-available/openwa << 'EOF'
# ── API Backend ──────────────────────────────────────────────
server {
    listen 80;
    server_name api.noor-boutique.com;
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name api.noor-boutique.com;

    ssl_certificate     /etc/letsencrypt/live/api.noor-boutique.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.noor-boutique.com/privkey.pem;

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
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name dash.noor-boutique.com;

    ssl_certificate     /etc/letsencrypt/live/dash.noor-boutique.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dash.noor-boutique.com/privkey.pem;

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
sudo ln -s /etc/nginx/sites-available/openwa /etc/nginx/sites-enabled/
sudo nginx -t
# doit afficher : syntax is ok
```

### 5.3 Certificats SSL
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

### Sur le VPS
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

./scripts/openwa.sh build   # ~5-10 min
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
./scripts/openwa.sh logs
./scripts/openwa.sh logs openwa-api 200
```

---

## ÉTAPE 8 — Récupérer la clé API

```bash
cat /opt/openwa/data/.api-key
# owa_k1_xxxxxxxxxxxxxxxxxxxxx  ← noter cette clé
```

Swagger UI : `https://api.noor-boutique.com/api/docs`

---

## ÉTAPE 9 — Démarrage automatique au reboot

```bash
sudo nano /etc/systemd/system/openwa.service
```

```ini
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
User=REMPLACER_PAR_TON_USER

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable openwa
sudo systemctl start openwa
```

---

## ÉTAPE 10 — Mise à jour

```bash
cd /opt/openwa
git pull
./scripts/openwa.sh build
./scripts/openwa.sh restart

# Rebuilder le dashboard si changements frontend
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
./scripts/openwa.sh update    # git pull + rebuild + restart
```

---

## Résultat final

```
https://dash.noor-boutique.com          ← Dashboard React (Nginx → /var/www/openwa-dashboard)
        │
        │ VITE_API_URL
        ▼
https://api.noor-boutique.com/api       ← OpenWA API (Nginx → localhost:2785)
        │
        ├── Docker (openwa-api container)
        ├── Sessions WhatsApp (Chromium/Puppeteer)
        └── PostgreSQL (alwaysdata externe)
```

---

## Checklist

- [ ] DNS — enregistrements A `api` et `dash` créés chez le registrar
- [ ] DNS propagé — `ping api.noor-boutique.com` → `91.134.143.81`
- [ ] Docker installé sur le VPS
- [ ] `/var/www/openwa-dashboard` créé
- [ ] Repo cloné dans `/opt/openwa`
- [ ] `.env` configuré (`DATABASE_PASSWORD` renseigné, `PROXY_ENABLED=false`)
- [ ] Nginx config créée et activée (`sudo nginx -t` → OK)
- [ ] Certificats SSL Certbot générés pour les 2 sous-domaines
- [ ] Dashboard buildé et copié dans `/var/www/openwa-dashboard`
- [ ] `./scripts/openwa.sh build` terminé sans erreur
- [ ] `./scripts/openwa.sh start` → containers UP
- [ ] `curl https://api.noor-boutique.com/api/health` → `{"status":"ok"}`
- [ ] `curl https://dash.noor-boutique.com` → HTML retourné
- [ ] Service systemd activé (démarrage auto)
