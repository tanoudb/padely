# Padely - TestFlight (setup complet)

## 1) Prerequis obligatoires

- Compte Apple Developer actif (99$/an)
- Compte Expo (EAS) actif
- Identifiant app iOS: `com.tanoudb.padely`

## 2) Login Expo

```bash
cd /Users/ethan/Desktop/padely/mobile
npx eas login
```

## 3) Lier le projet a Expo (1 seule fois)

```bash
cd /Users/ethan/Desktop/padely/mobile
npx eas project:init
```

## 4) Build iOS production (ipa TestFlight)

Configurer l'URL API cible (sinon l'app build en 127.0.0.1):

```bash
cd /Users/ethan/Desktop/padely/mobile
npx eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value http://192.168.1.12:8787
```

Puis lancer le build:

```bash
cd /Users/ethan/Desktop/padely/mobile
npm run build:ios:prod
```

Pendant le process EAS:
- reponds `Yes` pour laisser EAS gerer certificats/provisioning
- connecte ton compte Apple quand demande

## 5) Envoyer vers TestFlight

```bash
cd /Users/ethan/Desktop/padely/mobile
npx eas submit -p ios --latest
```

## 6) Test sur iPhone

- Installer app **TestFlight** (App Store)
- Ouvrir App Store Connect > TestFlight > ajouter testeurs internes
- Accepter l’invitation depuis iPhone

## 7) Backend local depuis iPhone (dev reseau local)

Si tu testes avec backend local du Mac:

```bash
cd /Users/ethan/Desktop/padely/backend
npm start
```

et build/dev avec:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.12:8787
```

## Notes

- L’upload TestFlight peut prendre 5-20 min de processing Apple.
- Si Apple Sign In est active, garder `APPLE_BUNDLE_ID=com.tanoudb.padely` cote backend.
