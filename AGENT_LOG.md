# Padely Agent Log

## [2026-03-01] - Run #01
### Decision
Priorite sur le moteur PIR backend (valeur visible immediate pour la progression) plutot que du polish UI: ajout streak + momentum + calibration progressive avec couverture tests.

### Ce qui a ete fait
- Ajout des primitives PIR dans `backend/src/domain/pir.js`:
  - `computeStreakMultiplier` (x1.1 apres 3 wins, x1.2 apres 5)
  - `computeFormIndex` (forme sur les 10 derniers matchs, ponderee recence + amplitude)
  - `computeMomentumFactor` (amplification/attenuation bornee a 0.9-1.1)
  - `computeCalibrationKFactor` (K lineaire de 40 vers 24 sur 10 matchs)
- Integration dans `backend/src/engine/matchEngine.js`:
  - Base delta applique maintenant `Kcalibre * domination * streak * momentum`
  - Enrichissement `breakdown` (baseK, streakMultiplier, momentumFactor, formIndex, preMatchWinStreak)
- Integration service match `backend/src/services/matchService.js`:
  - Construction de contexte `form` et `calibration` par joueur avant evaluation
  - Inference legacy depuis `remainingMatches` si `matchesPlayed` absent
  - Persistance post-match de `history.didWin` + `calibration.matchesPlayed/remainingMatches`
  - Raisons PIR enrichies (K calibration, streak, momentum)
- Harmonisation des defaults calibration a 10 matchs:
  - `backend/src/store/memoryStore.js`
  - `backend/src/store/firestoreStore.js`
  - `backend/src/services/profileService.js`
  - `backend/src/store/seed.js`
- Mise a jour de la doc formule PIR dans `docs/pir-formula.md`.
- Ajout/MAJ tests:
  - `backend/test/pir.test.js` (streak, momentum/form, calibration K)
  - `backend/test/matchEngine.test.js` (assertions breakdown enrichi)

### Fichiers modifies
- backend/src/domain/pir.js
- backend/src/engine/matchEngine.js
- backend/src/services/matchService.js
- backend/src/services/profileService.js
- backend/src/store/firestoreStore.js
- backend/src/store/memoryStore.js
- backend/src/store/seed.js
- backend/test/pir.test.js
- backend/test/matchEngine.test.js
- docs/pir-formula.md
- AGENT_LOG.md

### Statut
✅

### Problemes rencontres
- Worktree deja tres modifie cote mobile (hors scope run), donc commit cible uniquement backend + docs + log.

### Etat du projet
- Nouveau calcul PIR avec progression plus lisible (serie, forme, calibration) operationnel.
- Couverture de tests backend verte (17/17).
- Migration visuelle/navigation mobile deja entamee mais encore incoherente sur certains ecrans legacy.

### Prochaines priorites
1. Migrer les ecrans legacy restants vers `palette.*` (supprimer `theme.colors.*` dans JSX/styles dynamiques).
2. Introduire stats periode + head-to-head (endpoints + payload dashboard enrichi).
3. Ajouter validation `zod` sur endpoints match/auth critiques.

## [2026-03-02] — Run #02
### Mission
NOTIFICATIONS PUSH TEMPS RÉEL
### Résultat
Les joueurs reçoivent maintenant des notifications push réelles quand un match est créé contre eux, quand un score est validé/rejeté, quand une invitation est générée, et quand le classement de leur ville bouge.
Sur mobile, le token Expo est enregistré automatiquement après login, les notifications ouvrent directement l’écran concerné (match ou conversation), et l’onglet Communauté affiche un badge de notifications non lues.
### Technique
`backend/src/services/pushService.js` (stockage token + envoi via expo-server-sdk avec fallback), `backend/src/services/profileService.js` + `backend/src/server.js` (PUT `/api/v1/profile/push-token`), `backend/src/services/matchService.js` (triggers push sur create/validate/reject/invite + mouvement leaderboard ville), `backend/src/store/memoryStore.js` et `backend/src/store/firestoreStore.js` (champ `pushTokens`), `backend/test/pushNotifications.test.js` (flux end-to-end push), `mobile/src/utils/pushRealtime.js`, `mobile/src/App.js`, `mobile/src/api/client.js`, `mobile/src/screens/play/PlaySetupScreen.js`, `mobile/src/screens/CommunityScreen.js`.
### Statut
✅
### Prochaine mission recommandée
WEBSOCKET / SSE LIVE SCORING

## [2026-03-02] — Run #03
### Mission
WEBSOCKET / SSE LIVE SCORING
### Résultat
Le scoring est maintenant réellement multi-device: un joueur démarre un canal live, les autres participants rejoignent avec le code live, et le score se synchronise en temps réel sans refresh.
Quand le match est sauvegardé, la session live se ferme automatiquement et se lie au match final; les participants reçoivent l’état final instantanément.
### Technique
Backend: nouveau service `backend/src/services/liveMatchService.js` (sessions live, séquences, subscribe/broadcast, clôture), nouveaux endpoints `POST /api/v1/matches/live`, `GET /api/v1/matches/:matchId/live` (SSE), `PUT /api/v1/matches/:matchId/live`, `GET /api/v1/matches/:matchId/live/state`, `DELETE /api/v1/matches/:matchId/live` dans `backend/src/server.js`, et rattachement `liveMatchId` dans `backend/src/services/matchService.js` lors de la création de match.
Mobile: extension API dans `mobile/src/api/client.js`, nouveau client stream `mobile/src/utils/liveScoreStream.js` (SSE + fallback polling), intégration complète dans `mobile/src/screens/PlayScreen.js` (démarrer/rejoindre/quitter live, sync score bidirectionnelle, liaison auto à la sauvegarde match).
Tests: `backend/test/liveScoring.test.js` ajouté; suite backend complète passe en `19/19`.
### Statut
✅
### Prochaine mission recommandée
PERSISTANCE DATABASE
