# PIR (Padel Impact Rating) - Formules

## 1) Base ELO

- Rating equipe = moyenne des 2 joueurs
- Probabilite de victoire equipe A:

`P(A) = 1 / (1 + 10 ^ ((R_B - R_A)/400))`

- Delta brut:

`DeltaBase = K * (Resultat - P(A))`

Avec calibration progressive:

- `K=40` au debut
- puis baisse lineaire jusqu'a `K=24` sur les 10 premiers matchs classes

## 2) Multiplicateurs et bonus

### Domination

Mesure l'ecart de jeux remportes.

`DominationMultiplier = 1 + clamp((GameDiff/TotalGames) * 0.6, 0, 0.35)`

### Streak (serie de victoires)

- a partir de 3 victoires consecutives: `x1.1`
- a partir de 5 victoires consecutives: `x1.2`

### Momentum (forme recente)

Un `formIndex` est calcule sur les 10 derniers matchs en ponderant la recence et l'amplitude du delta.

- forme chaude -> gains legerement amplifies
- forme froide -> pertes legerement attenuees
- bornes facteur momentum: `0.9` a `1.1`

### Clutch (Punto de Oro)

`BonusClutch = clamp((GoldenWon/GoldenTotal) * 3, 0, 3)`

### Combativite (donnees montre)

Active uniquement si:

- equipe underdog
- defaite serree (<= 3 jeux d'ecart)

Puis:

`Bonus = (distanceFactor*0.3 + calorieFactor*0.4 + intensityFactor*0.3) * 5`

### Synergie partenaire

- Joueur fort gagnant avec partenaire bien plus faible: bonus leadership +2
- Joueur faible gagnant avec partenaire bien plus fort: bonus apprentissage +4

## 3) Paires

Un rating de paire est maintenu separement:

- `PairDelta = Kpair * (Resultat - P(pairA))`
- `Kpair = 18`

## 4) PIR DNA (Radar)

Le score visuel PIR est la moyenne de 5 piliers (0-100):

1. Power (vitesse smash)
2. Stamina (distance + calories)
3. Consistency (winners/(winners+fautes directes))
4. Clutch (points decisifs)
5. Social (note fair-play)

## 5) Saisons

### Soft reset trimestriel

`R_new = baseline + (R_old - baseline) * (1 - compression)`

Par defaut: baseline 1200, compression 15%.

### Decay inactivite

- aucune penalite avant 3 semaines
- puis `-6 points/semaine`
- plancher 700

## 6) Formule finale simplifiee

`DeltaBase = Kcalibre * (Resultat - ExpectedWin)`

`Delta = DeltaBase * DominationMultiplier * StreakMultiplier * MomentumFactor`

`DeltaFinal = Delta + Clutch + Combativite + Leadership + Upset + LossProtection`
