# Padely

Plateforme padel complete:

- Backend API (auth, profil, scoring match, PIR, communaute, OTP email)
- App mobile React Native (Accueil, Match, Social, Profil)

## Arborescence

- `/Users/ethan/Desktop/padely/backend` : API Node.js + moteur PIR
- `/Users/ethan/Desktop/padely/mobile` : app mobile Expo/EAS
- `/Users/ethan/Desktop/padely/docs` : specifications

## Backend

```bash
cd /Users/ethan/Desktop/padely/backend
npm install
npm test
npm start
```

Le serveur ecoute par defaut sur `0.0.0.0:8787`.

Exemple variables backend: [backend/.env.example](/Users/ethan/Desktop/padely/backend/.env.example)

## Mobile (vraie app native)

```bash
cd /Users/ethan/Desktop/padely/mobile
npm install
npx eas login
npx eas build:configure
npm run build:ios:prod
npm run build:android:prod
```

Pour dev local avec backend du Mac:

```bash
cd /Users/ethan/Desktop/padely/mobile
EXPO_PUBLIC_API_URL=http://192.168.1.12:8787 npm run dev-client
```

## Test rapide API

```bash
cd /Users/ethan/Desktop/padely
./scripts/smoke-api.sh
```
