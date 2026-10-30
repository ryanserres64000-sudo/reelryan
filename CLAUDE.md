# MaDA — contexte du projet

## Vision (mots de Ryan, 25 octobre 2026)

Ma Da est une application iOS (App Store) de création et de montage vidéo assistée par IA. L'utilisateur importe photos, vidéos et textes, et l'IA monte à sa place selon sa demande, dans le style d'Edits d'Instagram. Ma Da est aussi un studio tout-en-un pour les créateurs, influenceurs et marques : flyers, affiches, stories, posts, pubs. L'IA y joue le rôle de directeur artistique et doit éviter les rendus génériques. L'appli gère plusieurs comptes et doit fonctionner sans que l'utilisateur ait à se connecter à un service d'IA.

Conséquences pour le code : les clés d'IA restent côté serveur (jamais dans l'appli), l'utilisateur ne crée qu'un compte MaDA, et chaque espace de marque (compte) a ses propres médias, couleurs et historique.

## Décisions de Ryan (25 octobre 2026, réponses révisées au questionnaire « grill-me »)

Ces décisions priment sur `source/MISSION.md` et sur la PR #1 (Capacitor, Android, offre à vie).

- **Priorité absolue, avant toute ligne de code mobile** : un prototype sur ordinateur, un simple script (rushes → tri → Claude → timeline JSON → rendu FFmpeg). Test à l'aveugle sur 20 briefs réels contre le montage automatique de CapCut et contre Edits. Objectif fixé à l'avance : **au moins 70 % de préférence** pour MaDA. Si on ne bat pas CapCut, le reste n'a pas d'intérêt. Protocole : `docs/cout-ia-et-grille-qualite.md`.
- **Plateforme** : iOS uniquement en v1. Interface en React Native avec Expo (dev build), et un module natif AVFoundation pour l'aperçu **et** l'export dès la v1. Les deux passent par le même `AVComposition` : on exporte exactement ce qu'on voit à l'écran.
- **Rôle de l'IA** : elle ne renvoie qu'une timeline en JSON (plans retenus, coupes, textes, transitions). Le téléphone fait tout le rendu ; le serveur ne sert qu'à l'IA.
- **Coût à la source** : le tri se fait sur l'appareil avec le framework Vision d'Apple (changements de plan, visages, flou, plans ratés). Seules 15 à 30 images basse résolution déjà triées partent vers Claude, réduites sur l'appareil. Un petit modèle étiquette, un gros modèle décide du montage.
- **Promesse** : « Tu donnes tes rushes et une phrase, tu récupères un Reel publiable en 2 minutes, dans TON style, sans template. » La charte (couleurs, polices, logo) fait partie de « ton style ».
- **Cible n°1** : les indépendants qui font leur propre contenu pour leur activité (coachs, restaurateurs, artisans, commerçants, freelances). Ils ont besoin d'une identité de marque, ne savent pas monter et paient pour gagner du temps. L'offre Agence viendra plus tard, en plus, pas comme position de repli.
- **Défense face à Edits, CapCut et Canva** : le multi-plateforme (export pour Reels, TikTok et Shorts, quand Edits reste centré sur Instagram) et la mémoire du style. L'appli apprend des corrections de chaque utilisateur, et ces corrections nourrissent son style. C'est ce que les concurrents ne pourront pas copier.
- **Prix** : 6,99 €/mois (4,99 € est trop bas vu le coût de l'IA). Annuel proposé : 49,99 €/an (environ 40 % de remise), à valider par Ryan. Pas d'offre à vie au lancement ; si un jour il y en a une, prix élevé et quota mensuel.
- **Gratuit et paywall** : montage manuel gratuit (rendu sur l'appareil). Montages IA gratuits limités à des rushes de 60 à 90 s. Le paywall s'affiche juste après le premier très bon résultat. Protection contre les comptes multiples (App Attest et identifiant d'appareil).
- **App Store** : achats intégrés StoreKit dès la v1, « Se connecter avec Apple » (Google en plus, en option), suppression du compte depuis l'appli, étiquettes de confidentialité complètes, mention claire de l'usage de l'IA.
- **Musique** : coupes calées sur le rythme, puis export d'une vidéo prête à recevoir un son tendance, que l'utilisateur ajoute dans Instagram au moment de publier (légal). À côté : import de ses propres sons, et un catalogue sous licence (comparer les tarifs d'API d'Epidemic Sound, Artlist et Soundstripe).

## Le produit aujourd'hui

Studio de création assisté par IA pour créateurs, influenceurs, marques et agences : visuels (flyers, affiches, stories, posts, collages, pubs), montage vidéo, identité de marque, analyse Instagram, idées et veille. Toute l'interface est en français. Propriétaire du produit : Ryan.

Nom commercial : **MaDA : Studio créatif IA** (« ma DA », ma directrice artistique). Promesse : créer posts, vidéos et stories pour Instagram et TikTok en toute simplicité. Les bases IndexedDB gardent leurs anciens noms (`ryanreel-studio`, `ryanreel`) pour ne pas perdre les données existantes.

## État actuel

Prototype fonctionnel en une seule page HTML, assemblée à partir des modules de `source/` par `source/build.py`. Deux sorties :

- `source/mada-studio.html` : version publiée dans Claude (artefact). L'IA passe par `claude.use("sample")`, la sauvegarde par `claude.use("db")`.
- `public/index.html` : version site web (déployée sur Vercel). `public/shim.js` remplace `window.claude` et appelle `/api/generate` (`api/generate.js` + `lib/claude.js`), qui garde la clé API Anthropic côté serveur, applique le code d'accès `APP_PASSWORD` et une limite de demandes par visiteur (`MAX_PER_HOUR`). `server.js` sert la même chose hors Vercel.

Prototype de montage sur ordinateur dans `prototype/` (mode d'emploi : `prototype/README.md`) : `npm run montage -- monter <dossier> --brief "…"`. Tri des plans avec FFmpeg (`lib/sort.mjs`), étiquetage Haiku 5.5 puis décision Sonnet 5.5 ou Opus 5.5 (`lib/ai.mjs`), timeline JSON validée et calée sur le tempo (`lib/timeline.mjs`), rendu FFmpeg 1080 × 1920 (`lib/render.mjs`), coût réel dans `cout.json`. Le schéma de `lib/timeline.mjs` est celui que lira l'appli iPhone.

App iPhone dans `app/` (Expo SDK 58, TypeScript) : design system « Atelier clair » dans `app/src/design/` (choisi par Ryan le 28 octobre 2026 : blanc, encre, Instrument Serif et Instrument Sans, éditeur vidéo sur fond sombre ; l'action est un dégradé bleu, violet, framboise (`gradient` dans `design/tokens.json`, composant `Gradient`, sa première couleur `#1F3BD6` reste unie pour les petits textes) ; écran d'accueil `HomeScreen`, logo « Ma / DA étiquette » avec l'étiquette en boîtier d'appareil photo (proposition B2) dans `design/icon/mada-icon.svg` et `app/src/design/components/Logo.tsx`, animation d'ouverture `Intro`), textes dans `app/src/copy/fr.ts`. Les jetons viennent de `design/tokens.json` (`node design/build.mjs` régénère `app/src/design/tokens.ts`) ; `npm test` vérifie les contrastes WCAG AA, `node design/check-hardcoded.mjs` refuse couleurs, tailles et textes en dur dans l'app. Mode d'emploi : `app/README.md`.

Logique commune dans `core/` (TypeScript lu tel quel par Node ≥ 22.18 et par Metro) : `core/timeline.ts` est la timeline JSON v1 (schéma pour l'IA, validation `sanitizeTimeline`), partagée par l'app et le serveur. Route `POST /api/montage` (`lib/montage.js`) : l'iPhone envoie brief, rushes et 15 à 30 images clés ; Haiku étiquette, Sonnet écrit 2 ou 3 variantes puis les relit, réponse en flux NDJSON (une ligne par étape). Elle reprend les consignes du prototype (`prototype/lib/ai.mjs`), pour que l'app reçoive ce que le test à l'aveugle a mesuré. ADN de marque à l'inscription (lot 4) : `core/brand.ts` (questions par profil, couleurs du logo lues sur l'appareil, schéma et vérification du carnet, résumé d'environ 200 jetons envoyé à chaque montage dans `style.adn`, carnet sans IA si le serveur ne répond pas) et route `POST /api/adn` (`lib/adn.js`, un seul appel Sonnet). Contrôle total (lot 5) : `core/edit.ts` (retouches à la main sur la timeline, identifiants stables, verrous, annuler et rétablir sans limite, `keepLocked` après une retouche IA), `core/corrections.ts` (corrections courantes comprises sans IA, phrase par phrase ; mémoire du style : une règle après 2 corrections concordantes) et route `POST /api/retouche` (`lib/retouche.js`) pour le reste. Rendu naturel et visuels (lot 6) : `core/natural.ts` (vérification des clichés par le code sur chaque montage : un zoom au plus, peu de mouvements, une seule couleur d'image, pas d'emojis inventés, des textes qui respirent ; ce qu'elle corrige s'ajoute à la relecture visible), `core/design.ts` (portage TypeScript de `aidesign.js` et `render.js` : même JSON de calques, `sanitizeDesign`, `naturalDesign` contre néon, halos, 3 polices, textes trop petits, hors marges ou illisibles, consignes du directeur artistique avec les 10 styles maison, mises en page hors ligne, retouches à la main) et route `POST /api/visuel` (`lib/visuel.js`, un seul appel Sonnet, mode `retoucher`). Dans l'app : écrans `VisualBriefScreen` et `VisualEditorScreen`. Export (lot 7) : `core/export.ts` (un fichier par plateforme en 1080 × 1920 à 30 i/s, textes, sous-titres et logo placés dans la zone sûre de chacune, coupe à la durée maximale, légende par plateforme avec 5 hashtags au plus, titre pour les Shorts, rappel du son tendance, légende sans IA) ; écran `ExportScreen`, export PNG des visuels (`app/src/export/image.ts`). L'export vidéo attend le module natif `MadaVideo` (`app/src/export/video.ts`). Abonnement (lot 8) : `core/plans.ts` (offres 3,99 €/semaine, 6,99 €/mois, 49,99 €/an au lancement, quotas gratuits et Pro, moment du paywall : doux une fois après la première version gardée, bloquant seulement pour une nouvelle création IA quand les offertes sont utilisées), `lib/quota.js` (compteur par appareil `x-mada-device`, Upstash ou Vercel KV sinon mémoire, plafond par IP, remboursement si l'IA échoue) et routes `GET /api/offres`, `POST /api/quota`. Réglages serveur : `MADA_FREE_MONTAGES` (1 ou 3), `MADA_OFFRES_JSON` (prix, ordre, quotas), `MADA_QUOTA=strict`, `UPSTASH_REDIS_REST_URL` / `_TOKEN` ou `KV_REST_API_URL` / `_TOKEN`. Dans l'app : `app/src/plans/` (identifiant d'appareil dans le trousseau, pont StoreKit `MadaStore`), écran `PaywallScreen`, montage à la main gratuit (`manualTimeline`). Pro vérifié par le serveur : `lib/apple.js` (JWS StoreKit 2 contrôlés avec node:crypto jusqu'à Apple Root CA - G3, bon bundle, offre connue, ni remboursé ni expiré, acheté par cet appareil via `appAccountToken`), routes `POST /api/achat` (l'app envoie ses transactions signées) et `POST /api/apple/notifications` (notifications App Store V2 : renouvellement, remboursement) ; l'en-tête `x-mada-pro` ne compte plus qu'avec `MADA_PRO_HEADER=1` (développement). Réglage obligatoire : `MADA_APPLE_BUNDLE_ID`. Pas encore fait, faute de Mac : StoreKit natif compilé et App Attest. Conformité (lot 9) : consentement avant tout envoi à l'IA (`app/src/consent.ts`, `ConsentScreen`, règle Apple 5.1.2(i) ; `aiUrl()` dans `app/src/flow/server.ts` coupe tous les appels IA sans accord), écran `SettingsScreen` (couper l'IA, abonnement, documents, « Supprimer mon compte et mes données » → `app/src/account.ts` et `DELETE /api/compte`), marquage « Montage assisté par IA » dans les métadonnées de chaque export (`provenance` dans `core/export.ts`, AI Act art. 50), manifeste de confidentialité dans `app/app.json`, pages `public/mentions-legales.html`, `public/conditions.html`, `public/confidentialite.html`, `public/aide.html` (prêtes pour l'avocat ; les infos de l'éditeur se remplissent dans `docs/legal/editeur.json` puis `node scripts/legal.mjs`, `--strict` avant l'App Store ; ce qui manque et pourquoi : `docs/legal/a-completer.md` ; registre RGPD : `docs/legal/registre.md` ; serveur Vercel à Paris, `cdg1`) et réponses App Privacy dans `docs/app-store/confidentialite.md`. Modules natifs écrits, pas encore compilés (`app/modules/README.md`) : `mada-vision` (tri des plans, règles dans `core/triage.ts`), `mada-video` (aperçu et export par la même composition), `mada-store` (StoreKit 2) et `mada-audio`. Dès qu'ils sont compilés et que l'IA est autorisée, l'app envoie le vrai montage à `/api/montage` (`app/src/flow/triage.ts`, `montageBody`). Titres en duo et bruitages (lot 10, d'après les références @coachtijoux de Ryan) : `core/typo.ts` (8 duos maison en polices libres : un mot fort et un mot d'accent fin dessous, 2 familles par duo ; le duo vient de l'ADN sans IA, `duoFor`, et part dans `charte.duo` ; l'IA n'écrit que le mot `accent` des titres), bruitages `effets` dans la timeline (`whoosh`, `pop`, `clic`, `ding`, `impact` ; 4 au plus, 3 s d'écart), sons de base synthétisés dans `app/assets/sfx/` (`make.sh`, sans licence, remplaçables par une banque sous licence). Rendu natif dans `Overlay.drawDuo` et mixage dans `Composer`. Dans l'éditeur, onglet « Style et sons ». `npm test` lance tous les tests (prototype, design, core, serveur).

Refonte de l'app en 9 étapes (étude du 28 octobre 2026, PR #4, captures dans `refonte/` des fichiers du projet) : mouvements, « Annuler » partout et brouillons (`core/draft.ts`, `Toast`, `Sheet`) ; onglets Accueil, Créations, +, Idées, Marque (`core/week.ts`, `app/src/flow/Tabs.tsx`) ; lecteur plein écran (`core/playback.ts`, `PlayerScreen`, « Voir comme sur Instagram ») ; frise à pistes Simple / Complet et montage au doigt (`core/tracks.ts`, `app/src/editor/Timeline.tsx`, timeline avec `audios` et `calques` facultatifs) ; voix off (`core/voice.ts`, route `POST /api/voix` dans `lib/voix.js` : texte écrit par Haiku, lu par ElevenLabs, `ELEVENLABS_API_KEY`, `MADA_VOIX_JSON` ; sa propre voix avec `expo-audio` ; `VoiceSheet`) ; vidéos par-dessus et détourage (`core/layers.ts`, `LayerGrip`, rendu dans `Compositor.swift` avec Vision et clé verte) ; publier et revenir (`core/publish.ts`, écran de fin dans `ExportScreen`, Instagram ouvert sur la vidéo, avis App Store après le 3e export, notifications locales dans Réglages) ; « Tes chiffres » (`core/insights.ts`, `StatsScreen`) avec Instagram (`lib/instagram.js`, routes `/api/instagram` et `/api/instagram/callback`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `MADA_TOKEN_KEY`), capture de statistiques lue par Haiku, puis TikTok et YouTube (`lib/reseaux.js`, routes `/api/reseau/<p>` et `/callback`, `TIKTOK_CLIENT_KEY` / `_SECRET`, `GOOGLE_CLIENT_ID` / `_SECRET`). Jetons chiffrés en AES-256-GCM, effacés avec le compte. Avancée et délais du montage IA (29 octobre 2026) : `core/progress.ts` (pourcentage par étape sur l'écran de génération, rushes lus deux par deux avec un délai par rush, Vision bornée sur les longs rushes, signe de vie du serveur toutes les 10 s, arrêt clair à 280 s côté serveur et après 90 s de silence ou 9 min au total côté app, code `credits` quand le compte Anthropic est à sec). Ce qui attend Ryan : la liste « Ce qui t'attend » dans le fil du projet. Phase 1 de l'audit du 30 octobre 2026 (rapport : Claude Doc « Audit de Ma DA et plan par phases ») : pages légales ouvertes dans l'appli par `open()` de `app/src/legal.ts` (erreur affichée), « Voir les offres Pro » dans l'accueil et Réglages, résumé de l'offre sous le bouton du paywall (règle 3.1.2), interrupteurs serveur dans `take()` de `lib/quota.js` (`MADA_IA=off`, `MADA_PLAFOND_JOUR`, 300 par défaut, `MADA_COMPTE_REQUIS=1`), état du serveur sans secret par `GET /api/offres?etat=1` (compteurs `upstash` ou `memoire`), révocation de « Se connecter avec Apple » à la suppression (`MADA_APPLE_KEY_ID`, `MADA_APPLE_TEAM_ID`, `MADA_APPLE_SIGNIN_KEY`) et compte de démo pour la revue Apple (`MADA_DEMO_EMAIL`, `MADA_DEMO_CODE`).

Ne jamais modifier `public/index.html` à la main : modifier les modules, puis lancer `cd source && python3 build.py && node --check all.js`.

## Fichiers sources

| Fichier (dans `source/`) | Rôle |
| --- | --- |
| `shell.css` | Styles de l'application (thème sombre, jetons de couleur dans `:root`) |
| `body.html` | Structure : barre latérale, vues, éditeur. `<!--VIDEO-->` reçoit le studio vidéo |
| `core.js` | Utilitaires, stockage (IndexedDB + base Claude), médias, espaces de marque, `brandContext()`, adaptateur IA, fenêtres modales |
| `render.js` | Moteur de rendu des visuels : fonds, calques texte / forme / image / motif, masques, duotone, grain, test de clic |
| `aidesign.js` | Directeur artistique IA : schéma JSON des calques, consignes de composition, nettoyage (`sanitizeDesign`), création, relecture critique, retouches, adaptation de format |
| `editor.js` | Écran de brief, éditeur de calques (sélection, déplacement, redimensionnement, rotation, magnétisme, historique), variantes, export PNG/JPG/PDF |
| `pages.js` | Coquille, navigation, accueil, identité de marque, analyse Instagram, idées et veille, galerie, compte, démarrage |
| `video_src.html` | Studio vidéo d'origine ; `build.py` le préfixe (`v-`) et l'enferme dans le module `Video` |

## Points clés

- Un visuel = un JSON `{w, h, background, fx, layers[]}` ; l'IA produit ce JSON, `sanitizeDesign` le valide, `renderDesign` le dessine.
- Les images sont des « assets » stockés en IndexedDB (par espace), référencés par id ; l'IA les voit sous des alias (`img1`, `logo`).
- Qualité : création → rendu → relecture critique sur l'image rendue → corrections.
- La veille hebdomadaire est une tâche planifiée Claude qui écrit dans la collection `veille` de la base de l'artefact (version Claude uniquement).
- Le cap produit et technique complet est dans `source/MISSION.md`.

## Prochaines étapes

1. **Prototype sur ordinateur** : fait (`prototype/`). Reste à le lancer sur de vrais rushes et à relever le coût réel de chaque montage (`cout.json`).
2. **Test à l'aveugle** sur 20 briefs réels contre CapCut et Edits, objectif de 70 % de préférence. Rien d'autre ne démarre avant le résultat.
3. **Appli Expo (iOS)** : import depuis la photothèque, tri avec Vision, module natif AVFoundation pour l'aperçu et l'export (un seul `AVComposition`), éditeur de visuels qui dessine le JSON des calques.
4. **Serveur** : l'API IA existante (clés côté serveur), comptes avec « Se connecter avec Apple », quotas, protection contre les comptes multiples (App Attest).
5. **Abonnement** StoreKit (6,99 €/mois, annuel proposé à 49,99 €/an), paywall après le premier très bon résultat.
6. **Mémoire du style** : enregistrer les corrections de chaque utilisateur et les réinjecter dans les consignes du directeur artistique.
7. **Dossier App Store** : suppression du compte, étiquettes de confidentialité, mention de l'IA.

Le prototype web reste la référence de la logique : `render.js` (rendu des calques) et `aidesign.js` (consignes du directeur artistique, schéma JSON, relecture critique) se portent en TypeScript dans l'appli Expo, et le JSON `{w, h, background, fx, layers[]}` reste le format pivot entre l'IA et le moteur de rendu. La timeline vidéo aura son propre schéma JSON, défini pendant le prototype.

## Stack technique retenue

- **Appli** : React Native avec Expo (dev build, pas Expo Go), iOS uniquement en v1.
- **Vidéo** : module natif Swift (Expo Modules API) autour d'AVFoundation : `AVComposition` et `AVVideoComposition` partagés entre l'aperçu (`AVPlayer`) et l'export (`AVAssetExportSession`), 1080 × 1920.
- **Tri des plans** : framework Vision d'Apple sur l'appareil.
- **IA** : le serveur Node actuel (`api/generate.js`, `lib/claude.js`) garde les clés de l'API Anthropic et applique les quotas.
- **Achats** : StoreKit (éventuellement via RevenueCat).
- **Prototype de test** : script Node ou Python sur ordinateur + FFmpeg.

Options écartées par Ryan le 25 octobre 2026 : Capacitor (l'aperçu dans une WebView ne correspondrait pas à l'export natif) et Android en v1.

## Skills et plugins installés (portée projet)

Plugins officiels (marketplace `claude-plugins-official`, activés dans `.claude/settings.json`) :

| Plugin | Quand l'utiliser |
| --- | --- |
| `expo` | Créer, configurer, compiler et publier l'appli Expo (dev build, modules natifs, envoi sur l'App Store). |
| `swift-lsp` | Navigation et diagnostics dans le module natif Swift (nécessite Xcode, qui fournit SourceKit-LSP). |
| `frontend-design` | Direction visuelle d'un écran ou d'une page ; ses principes anti-générique valent aussi pour les consignes du directeur artistique IA. |
| `skill-creator` | Écrire un skill propre à MaDA (par exemple le style maison du directeur artistique IA) ou améliorer un skill existant. |
| `claude-md-management` | Relire et tenir à jour ce fichier CLAUDE.md après une session de travail. |
| `claude-code-setup` | Proposer des automatisations pour le dépôt (hooks, sous-agents, serveurs MCP). |

À ajouter plus tard si besoin : `revenuecat` (configurer produits et droits depuis Claude), `supabase`.

Skills communautaires (copiés dans `.claude/skills/`, provenance et vérifications dans `.claude/skills/SOURCES.md`) :

| Skill | Quand l'utiliser |
| --- | --- |
| `ui-ux-pro-max` | Choisir palette, typographie, styles et règles d'ergonomie, ou relire un écran pour l'accessibilité et la cohérence. Il a des bases dédiées à React Native et SwiftUI. |
| `design-taste-frontend` | Quand un écran ou une page fait « générique », « fait par une IA » : direction artistique stricte et boucle capture d'écran → corrections. Remplace `minimalist-ui`. |
| `grill-me` (+ `grilling`) | Avant de coder une fonction ou de trancher un choix : se faire challenger question par question. Se lance avec `/grill-me`. |
| `content-strategy` | Planifier les sujets et piliers de contenu des comptes de Ryan et de MaDA. |
| `social` | Posts, scripts de vidéos courtes et calendrier pour TikTok, Instagram et YouTube. |
| `pricing` | Revoir le prix, l'essai gratuit, le quota de montages IA et l'annuel face au mensuel. |
