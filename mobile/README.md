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

## Onglets

- Accueil: score PIR, classement, progression mensuelle
- Match: tableau de score visuel equipe rouge / equipe bleue avec calcul automatique (points, jeux, sets, tie-break)
- Partenaires: taux de victoire avec chaque partenaire + distance moyenne + synergie
- Stats: victoires, defaites, distance totale, distance moyenne, constance, regularite

## Notes

- Onboarding expert au premier lancement (niveau 1-8 + quiz)
- Auth email incluse (Google/Apple cote backend en mode MVP)
- Le mode score est pense pour l usage en paysage
- La version montre (watchOS / WearOS) est prevue pour reprendre le meme tableau de score
