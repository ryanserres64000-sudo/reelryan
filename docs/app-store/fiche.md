# Fiche App Store : Ma DA

À recopier dans App Store Connect (onglet de la version 1.0, langue principale français). Les limites d'Apple sont entre parenthèses ; chaque texte les respecte. `<site>` = l'adresse du site en production (secret `MADA_API_URL`).

## Informations de l'app

| Champ | Valeur |
| --- | --- |
| Nom (30) | Ma DA : Studio créatif IA |
| Sous-titre (30) | Tes Reels et visuels de marque |
| Identifiant de lot | `com.madastudio.app` |
| SKU | `madastudio` |
| Catégorie principale | Photo et vidéo |
| Catégorie secondaire | Graphisme et design |
| URL de confidentialité | `<site>/confidentialite.html` |
| URL d'assistance | `<site>/aide.html` |
| URL marketing | `<site>` |
| Copyright | 2026 Atelier SERRES |
| Prix de l'app | Gratuite (abonnements intégrés) |
| Disponibilité | France, Belgique, Suisse, Luxembourg, Canada au lancement (interface en français) |

## Texte promotionnel (170, modifiable sans nouvelle version)

Tes rushes et une phrase : Ma DA monte ton Reel à tes couleurs, avec tes polices et ton logo, prêt pour Instagram, TikTok et YouTube Shorts. 3 montages IA offerts.

## Description (4 000)

Tu as les images, pas le temps de monter ? Donne tes rushes et une phrase, Ma DA s'occupe du reste.

Ma DA, c'est ta directrice artistique de poche. Elle choisit les meilleurs plans, coupe sur le rythme, écrit des textes courts et place ton logo. Le résultat ressemble à ta marque, pas à un modèle vu mille fois.

POUR QUI
Les indépendants qui font leur propre contenu : coachs, restaurateurs, artisans, commerçants, freelances, associations et BDE. Pas besoin de savoir monter.

TON STYLE, PAS UN TEMPLATE
• À l'inscription, quelques questions sur ton activité, ton ton et ton logo. Ma DA en tire ta charte : couleurs, duo de polices, façon de parler.
• Chaque montage suit cette charte.
• Tu corriges ? Ma DA retient. Après deux corrections du même genre, elle les applique d'elle-même.

UN RENDU NATUREL
Tes vraies images d'abord. Pas de néon, pas de zooms à chaque coupe, pas d'emojis plaqués : Ma DA retire elle-même ce qui fait « fait par une IA » et te dit ce qu'elle a corrigé.

TU GARDES LA MAIN
Change un plan, une coupe, un texte, une couleur, en touchant l'écran ou en l'écrivant (« plus court », « enlève le deuxième texte »). Verrouille ce que tu aimes, annule autant de fois que tu veux.

VISUELS AUSSI
Flyers, affiches, posts et stories à ta marque, retouchables calque par calque, exportés en PNG.

PRÊT À PUBLIER PARTOUT
Un export par plateforme : Reels, TikTok et YouTube Shorts, en 1080 × 1920, textes dans la zone visible de chacune, légende et hashtags proposés. Ajoute ensuite le son tendance directement dans l'appli de publication.

GRATUIT POUR COMMENCER
• Montage à la main gratuit, sans limite.
• 3 montages IA et 3 visuels IA offerts.
• Ma DA Pro : 3,99 € par semaine, 6,99 € par mois ou 49,99 € par an.

L'IA, EN CLAIR
Ma DA te demande ton accord avant d'envoyer quoi que ce soit à l'IA. Seules quelques images réduites de tes rushes partent, jamais la vidéo entière, et Ma DA ne les garde pas. Tu peux couper l'IA à tout moment dans Réglages et continuer à la main. Chaque export porte la mention « Montage assisté par IA ». Pas de compte à créer, et tu supprimes tes données depuis l'appli.

Abonnement renouvelé automatiquement sauf résiliation au moins 24 h avant la fin de la période, depuis les réglages de ton compte Apple. Conditions : <site>/conditions.html. Confidentialité : <site>/confidentialite.html.

## Mots-clés (100, séparés par des virgules, sans espaces)

montage,reel,vidéo,story,flyer,affiche,post,marque,logo,créateur,commerce,coach,restaurant,charte

Pas de nom de marque concurrente ni de plateforme dans les mots-clés (règle 2.3.7). Les mots du nom et du sous-titre comptent déjà.

## Nouveautés de la version 1.0

Première version de Ma DA.

## Captures d'écran

Obligatoires : iPhone 6,9 pouces (1320 × 2868 ou 1290 × 2796), 3 au moins, 10 au plus. Ordre proposé, une phrase en haut de chacune :

1. Résultat d'un montage : « Tes rushes. Une phrase. Ton Reel. »
2. Carnet de marque : « À tes couleurs, avec tes polices. »
3. Relecture visible : « Elle corrige ce qui fait IA. »
4. Éditeur, plan verrouillé : « Tu gardes la main sur tout. »
5. Visuel affiche : « Flyers et posts à ta marque. »
6. Export trois plateformes : « Prêt pour Reels, TikTok et Shorts. »

On les prend sur le premier build TestFlight (bouton latéral + volume haut), sur un vrai rush d'un de tes clients avec son accord.

## Abonnements (Monetization → Subscriptions)

Groupe « Ma DA Pro », un seul niveau, trois durées. Les identifiants doivent rester ceux de `core/plans.ts`.

| Référence | Identifiant produit | Durée | Prix France |
| --- | --- | --- | --- |
| Ma DA Pro annuel | `mada.pro.an` | 1 an | 49,99 € |
| Ma DA Pro mensuel | `mada.pro.mois` | 1 mois | 6,99 € |
| Ma DA Pro hebdo | `mada.pro.semaine` | 1 semaine | 3,99 € |

Pour chacun : nom affiché « Ma DA Pro », description « Montages et visuels IA sans attendre », une capture du paywall pour la relecture. Les abonnements doivent être joints à la version 1.0 au moment de la soumission (section « In-App Purchases and Subscriptions » de la version), sinon Apple les ignore.

## Classification par âge

Répondre « Aucun » partout, sauf : contenu généré par l'utilisateur ou par IA → oui pour la génération, non pour le partage entre utilisateurs (l'appli n'a ni profil public ni messagerie). Résultat attendu : 4+.

## Confidentialité de l'app

Réponses dans `docs/app-store/confidentialite.md`.

## Notes pour la relecture d'Apple (App Review Information)

Pas de compte de démonstration : l'appli ne demande aucune connexion.

> Ma DA edits short vertical videos and designs posters for small businesses. No login is required.
>
> How to test:
> 1. Open the app, answer the short brand questionnaire (any answers; the logo step can be skipped).
> 2. Start a video: « Ajouter depuis la photothèque », pick 3 to 10 clips or photos, then write a one-line brief (or tap « Prendre l'exemple »), choose a music option and continue.
> 3. Before the first AI request the app asks for consent (guideline 5.1.2(i)). Only a few downscaled frames are sent to our server, which calls Anthropic's Claude API; nothing is stored by us. Without consent, manual editing still works.
> 4. The result can be edited by hand (tap a shot or a text) and exported per platform.
> 5. The first 3 AI edits are free. The paywall then offers Ma DA Pro (weekly, monthly, yearly auto-renewable subscriptions). Use a Sandbox account to test purchase and « Restaurer mes achats » in Réglages.
> 6. Account and data deletion: Réglages → « Supprimer mon compte et mes données » (guideline 5.1.1(v)).
>
> Every export is labelled « Montage assisté par IA » in its metadata. Sound effects are synthesized in-house; no third-party music is bundled.

Coordonnées de contact : celles de l'éditeur (`docs/legal/editeur.json`).

## Avant d'appuyer sur « Soumettre »

- [ ] Build TestFlight testé sur un vrai iPhone : import, montage, export, achat en Sandbox, restauration, suppression du compte.
- [ ] `node scripts/legal.mjs --strict` passe (médiateur et compteurs remplis).
- [ ] Sur Vercel : `ANTHROPIC_API_KEY`, `MADA_APPLE_BUNDLE_ID=com.madastudio.app`, Upstash ou Vercel KV branché, `MADA_QUOTA=strict`.
- [ ] Accord « Applications payantes » signé, coordonnées bancaires et fiscales remplies.
- [ ] Notifications App Store Server V2 : `<site>/api/apple/notifications`.
- [ ] Abonnements joints à la version.
