# Padely Mobile (Expo)

## Prerequis

- Node.js 20+
- npm
- Expo Go (iOS/Android) ou simulateur

## Lancer

```bash
cd /Users/ethan/Desktop/padely/mobile
npm install
EXPO_PUBLIC_API_URL=http://127.0.0.1:8787 npm start
```

## Ecrans

- Home: prochain match, PIR actuel, badge en cours
- Jouer: selection des 3 joueurs, creation match, scoring, validation/refus des matchs en attente
- Communaute: leaderboard ville, joueurs proches, marketplace
- Stats/Materiel: dashboard, duo stats, performance holes, usure raquette

## Notes

- Auth email incluse (Google/Apple cote backend en mode MVP stub)
- Le backend doit etre lance avant les appels API
