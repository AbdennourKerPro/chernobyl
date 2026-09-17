# NUCLEUS — atlas interactif des scénarios nucléaires

NUCLEUS est une carte mondiale statique et interactive qui réunit 590 sites de fission nucléaire et 1 823 unités. Elle permet de sélectionner une centrale et un scénario d'accident, récupère par défaut les conditions météorologiques actuelles de la zone, puis visualise l'évolution d'un panache radiologique relatif au fil du temps. Un mode manuel reste disponible. Deux projets de fusion présents dans l'export source sont volontairement exclus : leurs mécanismes d'accident ne sont pas comparables.

## Ce que montre la simulation

- inventaire mondial par site, pays, statut, filière et nombre de réacteurs ;
- quatre grandes familles d'accidents, de la perte de refroidissement à une enveloppe INES 7 ;
- plausibilité technologique de chaque scénario selon la famille de réacteur, sans inventer une probabilité propre à l'installation ;
- initialisation automatique par la météo Open-Meteo de la centrale sélectionnée, avec réglages manuels facultatifs ;
- animation particulaire de l'advection, de la dispersion et du dépôt humide ;
- chronologie, durée du rejet, portée, surface du panache, dépôts au sol indicatifs et territoires traversés ;
- interface responsive, utilisable au clavier et sur écran tactile.

## Limite essentielle

L'indice radiologique affiché est **relatif**. Il ne correspond pas à une dose en mSv et ne constitue ni une prévision d'urgence ni un modèle réglementaire. Les conditions Open-Meteo sont des sorties de modèles météorologiques, pas des mesures certifiées sur le site. Une simulation opérationnelle demanderait notamment un terme source certifié, les isotopes, une météo 3D assimilée, le relief, les protections du site et les mesures d'urgence.

## Données

- flotte nucléaire : [NuclearChain](https://nuclearchain.net/data/), dérivée du Global Nuclear Power Tracker de Global Energy Monitor (édition d'août 2026), CC BY 4.0 ;
- géométries des pays : [Natural Earth / world.geo.json](https://github.com/johan/world.geo.json), domaine public ;
- fond cartographique : OpenStreetMap ;
- moteur cartographique : Leaflet 1.9.4, BSD-2-Clause.
- météo actuelle : [Open-Meteo](https://open-meteo.com/en/docs), CC BY 4.0, service gratuit réservé ici à un usage non commercial.

Le script `scripts/build_plants.py` reconstruit `dist/data/plants.json` depuis `scripts/reactors.csv`.

## Lancer localement

Le site est entièrement statique. Servez le dossier `dist` avec n'importe quel serveur HTTP, par exemple :

```bash
python3 -m http.server 8000 --directory dist
```

Puis ouvrez `http://localhost:8000`.

## Déploiement GitHub Pages

Le workflow inclus publie automatiquement le dossier `dist` à chaque changement sur `main`. Dans les réglages du dépôt, choisissez **Pages → Source → GitHub Actions** une seule fois.

## Licence

Le code de l'interface est proposé sous licence MIT. Les données conservent les licences et attributions indiquées ci-dessus.
