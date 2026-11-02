# Programme muscu — 12 mois

Application web de suivi de musculation sur 52 semaines, pensée pour être utilisée sur téléphone pendant les séances.

**Application en ligne :** https://baldfox1567.github.io/programme-muscu/

## Utilisation sur iPhone

1. Ouvrir le lien ci-dessus dans **Safari**.
2. Toucher **Partager** → **Sur l'écran d'accueil**.
3. Lancer l'app depuis l'icône : elle s'ouvre en plein écran.

Les données saisies restent sur le téléphone (stockage local du navigateur). Pense à exporter le journal régulièrement.

## Fonctionnalités

- 3 séances par semaine : **Push / Pull / Legs**
- **7 blocs** répartis sur **52 semaines**, avec semaines de décharge
- **Minuteur de repos automatique** à la coche d'une série (règle des supersets : rien entre A1 et A2, repos après A2), alerte plein écran et bips en fin de repos
- **Chrono de séance** sur 45 min avec indicateur de rythme par poste, minuteur d'échauffement, écran maintenu allumé
- **Saisie des charges** et des répétitions série par série, avec la perf de la semaine précédente en rappel
- **Plan annuel** (un tap sur une semaine l'ouvre) et **courbes de progression**
- **Export du journal** (copie en texte)

## Technique

- Un seul fichier : `index.html` (HTML, CSS et JavaScript inline)
- Zéro dépendance externe (l'icône d'écran d'accueil est un PNG inline généré par `outils/icone.mjs`)
- Zéro appel réseau : fonctionne hors ligne une fois la page chargée
- Données stockées uniquement dans le `localStorage` du navigateur

## Avertissement

Ce programme est personnel et partagé à titre indicatif. Ce n'est pas un conseil médical : consulte un professionnel de santé avant de commencer un programme d'entraînement ou de nutrition.

## Licence

[MIT](LICENSE)
