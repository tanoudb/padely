# Backend Endpoints - Padely

## Auth

- POST `/api/v1/auth/register`
- POST `/api/v1/auth/login`
- POST `/api/v1/auth/oauth/google`
- POST `/api/v1/auth/oauth/apple`
- GET `/api/v1/me`

## Profil / Sante

- GET `/api/v1/profile`
- PUT `/api/v1/profile/athlete`
- POST `/api/v1/bag/items`
- GET `/api/v1/bag/items`

## Match / Scoring / Validation

- POST `/api/v1/matches`
- GET `/api/v1/matches`
- GET `/api/v1/matches/:matchId`
- POST `/api/v1/matches/:matchId/validate`
- POST `/api/v1/pir/rate-match`

## Stats / IA

- GET `/api/v1/stats/dashboard/:userId`
- GET `/api/v1/stats/duo/:userId`
- GET `/api/v1/stats/performance-holes/:userId`

## Communaute / Matchmaking

- GET `/api/v1/community/players`
- GET `/api/v1/community/leaderboard?city=Lyon`
- POST `/api/v1/community/matchmaking`
- POST `/api/v1/admin/leaderboard/refresh`

## Gamification / Saison

- GET `/api/v1/gamification/badges/:userId`
- POST `/api/v1/gamification/season-reset`
- POST `/api/v1/gamification/inactivity-decay`

## Marketplace

- POST `/api/v1/marketplace/listings`
- GET `/api/v1/marketplace/listings?city=Lyon`
