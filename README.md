# 💩 LinkedIn Bullshit-o-Meter — Extension Firefox

Analyse les profils LinkedIn et détecte le niveau de bullshit corporate.

## Architecture sécurisée (clé OpenAI non exposée)

La clé OpenAI n'est **plus dans l'extension**. L'extension appelle un backend local/serveur, et le backend seul appelle OpenAI.

Flux:
1. Extension Firefox -> POST http://localhost:8787/v1/analyze
2. Backend Node.js -> OpenAI API (avec OPENAI_API_KEY en variable d'environnement)
3. Backend -> Extension (résultat JSON)

Important:
- Une clé API ne peut jamais être "inaccessible par personne" si elle est embarquée côté client.
- Cette architecture est la bonne pratique: clé uniquement côté serveur.

## Pourquoi `.env.example` et `.env` ?

- `.env.example`:
   - Template versionné (sans secret) pour montrer quelles variables sont nécessaires.
- `.env`:
   - Fichier local avec les vraies valeurs secrètes (ne doit jamais être commit).

Dans ce repo, `.env` et `server/.env` sont ignorés via [.gitignore](.gitignore).

## Installation Firefox (mode développeur)

### Méthode temporaire (test rapide)
1. Ouvre Firefox → tape `about:debugging` dans la barre d'adresse
2. Clique **"Ce Firefox"** → **"Charger un module temporaire"**
3. Sélectionne le fichier `manifest.json` dans le dossier
4. L'extension est active jusqu'au prochain redémarrage de Firefox

### Méthode permanente (Firefox Developer Edition)
1. Ouvre Firefox Developer Edition
2. Va sur `about:config` → passe `xpinstall.signatures.required` à `false`
3. Va sur `about:addons` → engrenage → "Installer depuis un fichier"
4. Renomme le ZIP en `.xpi` et sélectionne-le

## Setup backend sécurisé

Le backend est dans [server/index.js](server/index.js).

1. Ouvre un terminal dans [server](server)
2. Installe les dépendances:
   - npm install
3. Crée ton fichier .env depuis [.env.example](server/.env.example)
4. Renseigne OPENAI_API_KEY dans .env
5. Démarre le backend:
   - npm start

Le service écoute sur http://localhost:8787

## Déployer sur Vercel

1. Push le repo sur GitHub.
2. Dans Vercel, import le repo.
3. Dans `Project Settings > Environment Variables`, ajoute:
   - `OPENAI_API_KEY`
   - Optionnel: `OPENAI_MODEL` (ex: `gpt-4o-mini`)
4. Déploie.
5. Vérifie les endpoints Vercel:
   - `https://TON-PROJET.vercel.app/api/health`
   - `https://TON-PROJET.vercel.app/api/analyze`
6. Mets à jour l'URL backend utilisée par l'extension dans [popup.js](popup.js):
   - Remplace `http://localhost:8787/v1/analyze`
   - Par `https://TON-PROJET.vercel.app/api/analyze`
7. Recharge l'extension dans Firefox (`about:debugging`).

Les fonctions serverless Vercel sont dans:
- [api/analyze.js](api/analyze.js)
- [api/health.js](api/health.js)

## Première utilisation extension

1. Clique sur l'icône 💩 dans la barre d'outils
2. Vérifie que le backend tourne (http://localhost:8787/health)
3. Navigue sur un profil LinkedIn (`linkedin.com/in/quelquun`)
4. Clique sur "Analyser le Bullshit"

## Coût

Modèle : GPT-3.5-turbo — ~0.002€ par analyse. 1000 analyses ≈ 2€
