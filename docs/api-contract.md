# API Contract (MVP)

## `GET /health`

Reponse:

```json
{
  "status": "ok",
  "service": "padely-api",
  "time": "2026-02-28T17:00:00.000Z"
}
```

## `POST /api/v1/pir/rate-match`

Body principal:

- `sets`: tableau de sets (`a`, `b`)
- `goldenPoints`: `{teamA, teamB}`
- `teamA`, `teamB`: 2 joueurs chacun
  - `id`, `rating`
  - `pairRating` (optionnel)
  - `watch.distanceKm`, `watch.calories`, `watch.intensityScore`, `watch.smashSpeedKmh`
  - `winners`, `directErrors`, `fairPlayScore`

Retour:

- resume match
- deltas rating individuels
- deltas rating de paire
- detail des bonus
- PIR DNA (5 piliers)

## `POST /api/v1/matchmaking`

Body:

```json
{
  "players": [
    {"id": "p1", "rating": 1340, "lat": 45.764, "lng": 4.836}
  ],
  "maxResults": 5
}
```

Retour:

- combinaisons equipe A/B
- probabilites de victoire
- fairness score (proche 1 = meilleur)
