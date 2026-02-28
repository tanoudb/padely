# Padely

Plateforme padel complete avec:

- Backend API (auth, profil, match scoring, PIR, validation croisee, stats IA, saisons, marketplace)
- App mobile Expo (Home, Jouer, Communaute, Stats/Materiel)

## Arborescence

- `/Users/ethan/Desktop/padely/backend` : API Node.js + moteur PIR
- `/Users/ethan/Desktop/padely/mobile` : app React Native Expo
- `/Users/ethan/Desktop/padely/docs` : specifications et contrats

## Backend

```bash
cd /Users/ethan/Desktop/padely/backend
npm test
npm start
```

Variables utiles:

- `HOST` (defaut `127.0.0.1`)
- `PORT` (defaut `8787`)
- `STORAGE_PROVIDER` (`memory` par defaut, `firestore` pour Firestore reel)
- `FIREBASE_PROJECT_ID` (requis si `STORAGE_PROVIDER=firestore`)
- `GOOGLE_APPLICATION_CREDENTIALS` (chemin JSON service account) ou `FIREBASE_SERVICE_ACCOUNT_JSON`

Exemple Firestore:

```bash
cd /Users/ethan/Desktop/padely/backend
npm install
STORAGE_PROVIDER=firestore FIREBASE_PROJECT_ID=ton-projet npm start
```

Comptes demo seedes:

- `alice@padely.app` / `padely2026`
- `ben@padely.app` / `padely2026`
- `chloe@padely.app` / `padely2026`
- `dylan@padely.app` / `padely2026`

## Mobile

```bash
cd /Users/ethan/Desktop/padely/mobile
npm install
EXPO_PUBLIC_API_URL=http://127.0.0.1:8787 npm start
```

## Test rapide API

```bash
cd /Users/ethan/Desktop/padely
./scripts/smoke-api.sh
```

## Fonctionnalites implementees

- Auth: email + endpoints OAuth Google/Apple (MVP)
- Profil athlete: poids, taille, main dominante, localisation
- Scoring match + Punto de Oro
- Validation croisee du match
- PIR hybride (domination, clutch, combativite, synergie, paire)
- Stats: dashboard, duo stats, performance holes
- Sac de padel: usure par heures de jeu
- Communaute: recherche joueurs, leaderboard ville, matchmaking 50/50
- Gamification: badges, soft reset, inactivity decay
- Marketplace locale: depot + listing annonces
