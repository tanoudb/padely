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

## [2026-03-02] — Run #04
### Mission
PERSISTANCE DATABASE (SQLite)
### Résultat
Les données backend survivent désormais aux redémarrages serveur: utilisateurs, matchs, validations, paires, leaderboards, messages de communauté/DM, clubs et badges sont persistés en SQLite.
Les canaux communauté ne perdent plus leur historique après restart et les badges débloqués restent stockés durablement.
### Technique
Nouveau store `backend/src/store/sqliteStore.js` avec migrations automatiques (tables `users`, `matches`, `validations`, `pairs`, `leaderboard_cache`, `badges`, `clubs`, `messages`, `sessions`, `email_verifications`, `bag_items`, `marketplace`) et seed catalogue clubs. Provider backend basculé par défaut sur SQLite dans `backend/src/store/index.js` (fallback test isolé `:memory:` par worker). `communityService` migré vers le store pour persister messages et clubs. `gamificationService` persist désormais les badges débloqués. Script de seed ajouté (`npm run seed`) via `backend/src/store/seedCli.js`. Test de persistance ajouté: `backend/test/sqlitePersistence.test.js`.
### Statut
✅
### Prochaine mission recommandée
VALIDATION INPUT + ERROR HANDLING

## [2026-03-02] — Run #05
### Mission
VALIDATION INPUT + ERROR HANDLING
### Résultat
Les flux critiques sont maintenant blindés: inscription, connexion, création de match, validation de match et mise à jour profil sont validés par schémas zod avec erreurs structurées par champ (`error`, `field`, `message`, `issues`).
Côté mobile, les erreurs s’affichent inline sous les inputs avec animation shake sur les champs invalides (Auth + Setup match), ce qui rend les corrections immédiates et claires pour le joueur.
### Technique
Backend: nouveaux modules `backend/src/api/validation.js` (schémas zod + `RequestValidationError`) et `backend/src/api/rateLimit.js` (rate limiter réutilisable). `backend/src/server.js` valide les payloads critiques avant services, retourne un format d’erreur uniforme et applique un rate limiting auth strict `5/min/IP` sur register/login/oauth. Dépendance `zod` déclarée dans `backend/package.json`.
Mobile: `mobile/src/api/client.js` introduit `ApiError` structuré (status/code/field/issues), `mobile/src/utils/formErrors.js` mappe les erreurs backend vers les champs UI, `mobile/src/screens/AuthScreen.js` et `mobile/src/screens/play/PlaySetupScreen.js` affichent les erreurs inline + shake.
Tests: `backend/test/requestValidation.test.js` couvre validation payloads et rate limiter auth (5 tentatives ok, 6e bloquée). Suite backend verte `24/24`.
### Statut
✅
### Prochaine mission recommandée
SYSTÈME DE COMMUNICATION TEMPS RÉEL

## [2026-03-02] — Run #06
### Mission
SYSTÈME DE COMMUNICATION TEMPS RÉEL
### Résultat
La communauté Padely est maintenant réellement temps réel: les DM et messages de canaux arrivent instantanément sans refresh grâce à un flux SSE dédié.
Les conversations et canaux supportent la pagination, le marquage lu persistant, et l’onglet Communauté affiche un badge non-lu basé sur de vraies données serveur.
### Technique
Backend: `backend/src/services/communityService.js` (SSE user feed, unread summary, read markers, pagination DM/canaux), `backend/src/server.js` (GET `/api/v1/community/live`, GET `/api/v1/community/unread`, pagination query params, POST read endpoints), `backend/src/store/memoryStore.js` + `backend/src/store/sqliteStore.js` + `backend/src/store/firestoreStore.js` (community read markers), nouveau test `backend/test/communityRealtime.test.js`.
Mobile: `mobile/src/utils/communityStream.js` (SSE + fallback polling 10s), `mobile/src/api/client.js` (endpoints unread/read/pagination), `mobile/src/screens/CommunityScreen.js` (sync live DM/canaux, load more, markRead), `mobile/src/App.js` (badge Community branché sur unread serveur), `mobile/src/i18n/dictionaries.js` (label load more).
### Statut
✅
### Prochaine mission recommandée
STATS AVANCÉES

## [2026-03-02] — Run #07
### Mission
STATS AVANCÉES
### Résultat
Le profil joueur affiche maintenant des stats avancées filtrables par période (7 jours, 30 jours, saison, global), des records personnels et une heatmap d’activité type GitHub pour rendre la progression vraiment lisible.
Quand on visite un autre joueur depuis la communauté, un écran dédié affiche le head-to-head complet (bilan, winrate, historique récent) et respecte la confidentialité (profil privé bloqué).
### Technique
Backend: `backend/src/services/statsService.js` enrichi avec filtrage période, records (`biggestUpset`, `bestWinStreak`, `bestSet`, `longestMatch`), heatmap, endpoint head-to-head et garde privacy; `backend/src/server.js` expose `GET /api/v1/stats/head-to-head/:userId/:opponentId` et `GET /api/v1/stats/records/:userId` + query `period` sur les endpoints stats existants. `backend/test/statsAdvanced.test.js` couvre période/records/head-to-head/privacy. Correction stabilité temps réel sur pagination messages via timestamps monotones dans `backend/src/services/communityService.js` (fix régression test).
Mobile: `mobile/src/api/client.js` ajoute les méthodes stats avancées, `mobile/src/screens/ProfileScreen.js` intègre sélecteur de période + records + heatmap, `mobile/src/screens/PlayerProfileScreen.js` nouveau profil visitable avec head-to-head, `mobile/src/App.js` route `PlayerProfile`, `mobile/src/screens/CommunityScreen.js` navigation vers profil joueur, `mobile/src/i18n/dictionaries.js` nouvelles clés FR/EN.
### Statut
✅
### Prochaine mission recommandée
PROFILS PUBLICS (historique complet + badges + bouton proposer un match depuis leaderboard)

## [2026-03-02] — Run #08
### Mission
PROFILS PUBLICS
### Résultat
Le profil joueur public est maintenant complet: stats période, badges débloqués, historique récent des matchs avec partenaire/adversaires, heatmap d’activité et face-à-face sont visibles depuis un seul écran.
Depuis les leaderboards (Accueil + Communauté), on peut ouvrir un profil joueur et proposer un match en un tap, avec préremplissage automatique du joueur ciblé dans la configuration de match.
### Technique
Backend: nouveau service `getPublicPlayerProfile` dans `backend/src/services/statsService.js` + endpoint `GET /api/v1/stats/public-profile/:playerId` dans `backend/src/server.js`, avec respect de `publicProfile` et filtrage des matchs invités selon `showGuestMatches`. Tests étendus dans `backend/test/statsAdvanced.test.js`.
Mobile: `mobile/src/screens/PlayerProfileScreen.js` refondu pour consommer `api.publicProfile` (`mobile/src/api/client.js`) et afficher badges + historique + CTA proposer match. `mobile/src/screens/play/PlaySetupScreen.js` supporte `suggestedPlayerId` pour préselection. Navigation profil branchée depuis leaderboard via `mobile/src/components/LeaderboardRow.js`, `mobile/src/screens/HomeScreen.js`, `mobile/src/screens/CommunityScreen.js`.
### Statut
✅
### Prochaine mission recommandée
PARTAGE SOCIAL (image de résultat premium noir/or + share sheet natif)

## [2026-03-02] — Run #09
### Mission
SAISONS TRIMESTRIELLES
### Résultat
Padely dispose maintenant d’un vrai cycle compétitif trimestriel: l’app affiche la saison en cours avec progression et jours restants, et le classement local peut être filtré sur la période saison.
Les transitions de saison sont robustes côté backend: les classements de la saison passée sont archivés, un soft reset rating/PIR est appliqué à l’ouverture de la nouvelle saison, et un badge de fin de saison est exposé selon le rang historique.
### Technique
Backend: nouveau service `backend/src/services/seasonService.js` (détection saison S1..S4, progression, transition automatique, archive city leaderboard, soft reset rating+PIR, overview), endpoint `GET /api/v1/gamification/seasons` dans `backend/src/server.js`, support `period=season` + `leaderboard/periods.season` dans `backend/src/services/communityService.js` + `backend/src/server.js`, persistance saison dans `backend/src/store/sqliteStore.js` (tables `season_state`, `season_leaderboard_archive`) et fallback mémoire dans `backend/src/store/memoryStore.js`, reset PIR enrichi dans `backend/src/services/gamificationService.js`. Tests ajoutés: `backend/test/seasonSystem.test.js`.
Mobile: API `api.seasons()` (`mobile/src/api/client.js`), carte saison Home avec barre de progression/rang/jours restants (`mobile/src/screens/HomeScreen.js`), filtre classement local Saison/Global dans Communauté (`mobile/src/screens/CommunityScreen.js`), nouvelles clés i18n FR/EN (`mobile/src/i18n/dictionaries.js`).
### Statut
✅
### Prochaine mission recommandée
PARTAGE SOCIAL (image résultat) dès que la dépendance `react-native-view-shot` peut être installée

## [2026-03-02] — Run #10
### Mission
MATCHMAKING INTELLIGENT
### Résultat
Les joueurs ont maintenant un vrai moteur “Trouver un match” : l’app propose des adversaires pertinents en 1 écran avec compatibilité %, activité récente et niveau proche.
Le bouton “Proposer” déclenche une invitation réelle côté backend (DM persisté + ajout en ami) et une notification push ciblée, ce qui transforme la suggestion en mise en relation immédiate.
### Technique
Backend : nouveau service `backend/src/services/matchmakingService.js` (filtres stricts rating ±150, même ville, actif sur 7 jours, exclusion adversaires déjà joués cette semaine, scoring compatibilité 0-100), endpoints `GET /api/v1/community/matchmaking/suggestions` et `POST /api/v1/community/matchmaking/propose` ajoutés dans `backend/src/server.js`.
Mobile : client API étendu (`mobile/src/api/client.js`), section “Trouver un match” intégrée dans `mobile/src/screens/CommunityScreen.js` (liste suggestions + CTA Proposer + état envoi + feedback), i18n FR/EN enrichi (`mobile/src/i18n/dictionaries.js`), routing push mis à jour pour `matchmaking_invite` (`mobile/src/utils/pushRealtime.js`).
Tests : nouveau fichier `backend/test/matchmakingSuggestions.test.js` couvrant suggestions + proposition/push, suite backend complète verte (`32/32`).
### Statut
✅
### Prochaine mission recommandée
PARTAGE SOCIAL (image résultat premium + share sheet) dès que `react-native-view-shot` est installable

## [2026-03-02] — Run #11
### Mission
ÉCRAN VICTOIRE ÉMOTIONNEL
### Résultat
L’écran de fin de match est désormais une vraie séquence émotionnelle en 2 secondes: apparition cinématique noir/or, titre, sous-titre, score, jauge PIR, puis delta animé.
En cas de défaite, le ton devient neutre (“MATCH TERMINÉ”) au lieu d’un message de victoire, avec trois actions claires en sortie: partager, rejouer immédiatement, ou retourner à l’accueil.
### Technique
Mobile: refonte complète de `mobile/src/components/VictoryOverlay.js` (timeline animée séquentielle, ambiance premium, intégration `PirGauge`, CTA `share/replay/home`), adaptation de `mobile/src/screens/PlayScreen.js` (détection victoire/défaite côté utilisateur, passage PIR/rang, navigation HomeTab depuis overlay), nouvelles traductions FR/EN dans `mobile/src/i18n/dictionaries.js` (`play.replay`, `play.home`, `play.matchFinishedTitle`, `play.matchFinishedSub`).
Validation: backend tests OK `32/32` (`npm test`), bundle mobile iOS exporté avec succès via `npx expo export --platform ios`.
### Statut
✅
### Prochaine mission recommandée
PARTAGE SOCIAL (image résultat premium) dès que l’installation de `react-native-view-shot` est possible (réseau npm indisponible sur ce run)

## [2026-03-02] — Run #12
### Mission
REFONTE SCORING + HAPTICS
### Résultat
Le scoring en match est maintenant totalement immersif: interface plein écran avec deux zones rouges/bleues, score géant (120+) et feedback visuel instantané sur l’équipe qui vient de marquer.
Chaque action déclenche des haptics adaptés (medium sur point, heavy sur jeu, success à la fin), avec un rebond de score fluide et un indicateur de service visuel pour réduire les erreurs d’arbitrage.
### Technique
Mobile: refonte complète de `mobile/src/screens/play/PlayScoringScreen.js` (layout immersif, gradients dynamiques day/night, animation bounce `withSpring` config 15/150/0.8, flash accent côté gagnant, service indicator SVG, footer actions localisées). Palette étendue avec teinte info/bleu dans `mobile/src/state/ui.js` pour supporter la moitié bleue sans hardcode global.
Validation: backend tests `32/32` (`npm test`) + export Expo iOS et Android réussis (`npx expo export --platform ios|android`).
### Statut
✅
### Prochaine mission recommandée
PARTAGE SOCIAL (image résultat premium noir/or + share sheet natif)
