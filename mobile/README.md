# Padely Mobile (React Native + Expo)

## Objectif

App mobile padel prete pour build natif iOS/Android (dev client + production), avec GPS actif, branding app (icon/splash), et API backend Padely.

## Prerequis

- Node.js 20+
- npm
- Compte Expo ([expo.dev](https://expo.dev))
- Xcode (iOS) / Android Studio (Android)

## Lancer en developpement (sans Expo Go)

```bash
cd /Users/ethan/Desktop/padely/mobile
npm install
npx expo start --dev-client
```

Puis installer un dev build natif:

```bash
cd /Users/ethan/Desktop/padely/mobile
npm run build:ios:dev
# ou
npm run build:android:dev
```

## Build iOS/Android reelle

```bash
cd /Users/ethan/Desktop/padely/mobile
npx eas login
npx eas build:configure
npm run build:ios:prod
npm run build:android:prod
```

## API backend

```bash
cd /Users/ethan/Desktop/padely/mobile
EXPO_PUBLIC_API_URL=http://192.168.1.12:8787 npm run dev-client
```

## Notes importantes

- Permissions GPS configurees via `expo-location` (iOS + Android).
- App configuree avec `bundleIdentifier` iOS `com.padely.app` et package Android `com.padely.app`.
- Icône/splash/favicone custom dans `/Users/ethan/Desktop/padely/mobile/assets`.
- EAS profiles dans `/Users/ethan/Desktop/padely/mobile/eas.json`.
