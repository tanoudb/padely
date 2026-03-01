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
