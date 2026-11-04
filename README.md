# Programme muscu — 12 mois

Application web de suivi de musculation sur 52 semaines, pensée pour être utilisée sur téléphone pendant les séances.

**Application en ligne :** https://baldfox1567.github.io/programme-muscu/

## Utilisation sur iPhone

1. Ouvrir le lien ci-dessus dans **Safari**.
2. Toucher **Partager** → **Sur l'écran d'accueil**.
3. Lancer l'app depuis l'icône : elle s'ouvre en plein écran.

Saisis toujours depuis l'icône : sur iPhone, l'app de l'écran d'accueil et la même page ouverte dans Safari ne partagent pas leurs données.

Les données saisies restent sur le téléphone (stockage local du navigateur). Enregistre une **sauvegarde fichier** régulièrement (onglet Plan → Sauvegarde) : c'est elle qui permet de tout récupérer sur un autre téléphone ou après un effacement.

## Fonctionnalités

- 3 séances par semaine : **Push / Pull / Legs**
- **7 blocs** répartis sur **52 semaines**, avec semaines de décharge
- **Minuteur de repos automatique** à la coche d'une série (règle des supersets : rien entre A1 et A2, repos après A2), alerte plein écran et bips en fin de repos
- **Chrono de séance** sur 45 min avec indicateur de rythme par poste, minuteur d'échauffement, écran maintenu allumé
- **Saisie des charges** et des répétitions série par série, avec la perf de la semaine précédente en rappel
- **Plan annuel** (un tap sur une semaine l'ouvre) et **courbes de progression**
- **Sauvegarde et restauration** : fichier JSON complet par la feuille de partage (Fichiers, iCloud, Mail), restauration avec aperçu avant remplacement, copies automatiques sur le téléphone. Export texte pour les notes.
- **Sauvegarde protégée** : si elle ne peut pas être lue, l'app n'écrit plus rien et propose de repartir d'une copie ; un échec d'écriture est signalé
- **Hors ligne** : une fois l'app ouverte une fois, elle se recharge sans réseau
- **Repères en séance** : série cochée sans reps, charge de décharge (−15 %), plafond de fourchette atteint, séries sous la fourchette
- **Progression** : meilleure série par semaine, 1RM estimé (Epley), cible de fin de bloc

## Technique

- `index.html` : toute l'app (HTML, CSS et JavaScript inline), autonome et ouvrable seule
- `sw.js` : copie hors ligne de la page pour GitHub Pages. Facultatif : sans lui, l'app marche en ligne comme avant ; il ne touche jamais au journal
- Zéro dépendance externe (l'icône d'écran d'accueil est un PNG inline généré par `outils/icone.mjs`)
- Zéro appel réseau de l'app elle-même
- Données dans le `localStorage` du navigateur (ou `window.storage` en artifact Claude), clé `muscu_bloc1_v1`, schéma versionné (`v`) avec migrations explicites. Copies de secours à côté : `__avant_v2` (sauvegarde d'origine), `__prec` (sauvegarde au premier lancement du jour), `__avant_import`, `__illisible`

### Tests

- `node --test` : logique du programme et schéma de sauvegarde. Le bloc de code entre `@pur:debut` et `@pur:fin` d'`index.html` est exécuté tel quel, sans dépendance.
- `node outils/verifier.mjs [dossier] [--captures dossier]` : 17 scénarios de bout en bout dans Chromium à la taille d'un iPhone (perte de données, semaine, hors ligne, saisie). Demande Playwright ; l'app n'en dépend pas.

## Avertissement

Ce programme est personnel et partagé à titre indicatif. Ce n'est pas un conseil médical : consulte un professionnel de santé avant de commencer un programme d'entraînement ou de nutrition.

## Licence

[MIT](LICENSE)
