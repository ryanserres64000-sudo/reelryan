# App iPhone MaDa (Expo)

L'inscription (lot 4 : profil, questionnaire, logo, carnet de marque), puis le parcours import → brief → musique → génération → résultat (lots 2 et 3), avec des rushes d'exemple tant que le module natif vidéo n'existe pas. Le catalogue du design system s'ouvre avec `#catalogue` dans l'aperçu web.

- `src/design/tokens.ts` : généré depuis `../design/tokens.json` par `node ../design/build.mjs`. Ne pas modifier à la main.
- `src/design/` : thème clair et sombre (sombre par défaut), `Text`, composants (boutons, puces, cartes de rush, frise, sélecteur de musique, forme d'onde, paywall, pastille « Enregistré », écran de génération).
- `src/copy/fr.ts` : tous les textes de l'app, au ton MaDa.
- `src/flow/` : l'enchaînement des écrans, les données d'exemple, le client de `POST /api/montage`.
- `src/brand/` : la marque gardée sur l'iPhone (AsyncStorage), la lecture des couleurs du logo (copie 64 × 64 décodée en JS, sans IA) et l'appel unique à `POST /api/adn`. Sans serveur, le carnet est écrit à partir du profil (`offlineDna` dans `../core/brand.ts`).
- `src/music/` : téléchargement du lien MP3, import de fichier, cache (`sound.ts` sur iPhone, `sound.web.ts` pour l'aperçu web). Les règles et la détection du tempo sont dans `../core/music.ts`.
- `modules/mada-audio/` : module natif Swift qui décode un son avec AVAudioFile. Pas encore compilé : il faut Xcode. Sans lui, l'app propose « Tape le rythme ».
- `src/visual/` : les visuels (lot 6) : rendu des calques `{w, h, background, fx, layers[]}` en vues natives (`DesignView.tsx`, SVG pour formes et photos, vrais `Text` pour les textes), les 12 polices OFL, l'appel à `POST /api/visuel` avec mise en page hors ligne, et les 20 derniers visuels gardés sur l'iPhone.
- `src/export/` : export PNG d'un visuel (capture à taille réelle, Photos en écriture seule, feuille de partage) et pont vers le futur module natif `MadaVideo` (AVFoundation), absent tant que l'app n'est pas compilée sur Mac.
- `src/plans/` : offres et compteur des créations IA offertes (copie locale de `core/plans.ts`, le vrai compte est sur le serveur), identifiant d'appareil anonyme dans le trousseau (`expo-secure-store`), pont vers le futur module natif StoreKit `MadaStore`. `src/legal.ts` : liens Conditions et Confidentialité (`EXPO_PUBLIC_MADA_SITE`).
- `src/consent.ts` : accord daté avant tout envoi à l'IA, demandé au premier besoin (`ConsentScreen`), modifiable dans Réglages ; sans accord, `aiUrl()` renvoie null et l'app passe à la main ou hors ligne. `src/account.ts` : suppression du compte (iPhone et serveur).
- `src/video/` : aperçu natif (`VideoPreview`, même composition que l'export) et fichiers à donner au rendu (`videoSources` : rushes, logo, musique, polices). `src/flow/triage.ts` : tri Vision puis corps de `/api/montage`. Les modules Swift sont dans `modules/` (voir `modules/README.md`).
- `src/screens/` : les écrans. Aucune couleur, taille ni texte en dur : `node ../design/check-hardcoded.mjs` le vérifie.

Serveur : `EXPO_PUBLIC_MADA_API` (adresse du serveur) et `EXPO_PUBLIC_MADA_ACCESS` (code `APP_PASSWORD`) dans `app/.env`. Sans eux, l'app fonctionne hors ligne avec des réponses d'exemple.

Commandes : `npm run typecheck`, `npx expo export --platform web` (aperçu dans un navigateur), `npx expo run:ios` sur un Mac avec Xcode (dev build).
Les dépendances suivent le SDK 58 (`node_modules/expo/bundledNativeModules.json`).

## App iPhone sans Mac (EAS Build et TestFlight)

La compilation se fait sur les serveurs d'Expo, lancée depuis GitHub : onglet **Actions** → **App iPhone** → **Run workflow** (`.github/workflows/ios.yml`). Le job vérifie d'abord les types, les valeurs en dur et `npm test`, puis compile avec le profil `production` de `eas.json` et, si la case est cochée, envoie le build sur TestFlight. Le numéro de build monte tout seul (`autoIncrement`).

À faire une seule fois :

1. **Apple Developer Program** (99 €/an) au nom de l'entreprise individuelle.
2. **App Store Connect** → Apps → « + » : nom « Ma DA : Studio créatif IA », identifiant de lot `com.madastudio.app`, SKU `madastudio`. Signer l'accord « Applications payantes » (Business), sans lui les abonnements ne se vendent pas.
3. **Clé API App Store Connect** : Users and Access → Integrations → App Store Connect API → « + », rôle Admin. Télécharger le `.p8` (une seule fois possible), noter le Key ID et l'Issuer ID.
4. **Expo** : créer un compte sur expo.dev, puis Account settings → Access tokens → créer un jeton.
5. **Secrets GitHub** : Settings → Secrets and variables → Actions → New repository secret, un par ligne :

| Secret | Valeur |
| --- | --- |
| `EXPO_TOKEN` | le jeton Expo |
| `ASC_API_KEY_P8` | tout le texte du fichier `.p8`, lignes BEGIN et END comprises |
| `ASC_API_KEY_ID` | le Key ID |
| `ASC_API_ISSUER_ID` | l'Issuer ID |
| `APPLE_TEAM_ID` | developer.apple.com → Membership → Team ID |
| `MADA_API_URL` | l'adresse du site en production, sans `/` final |
| `MADA_ACCESS` | le code `APP_PASSWORD` du serveur s'il y en a un, sinon ne pas le créer |

6. **Abonnements** dans App Store Connect (Monetization → Subscriptions), un groupe « Ma DA Pro » avec les identifiants de `core/plans.ts` (`produit`), et l'adresse `https://<site>/api/apple/notifications` en version 2 dans App Information → App Store Server Notifications. Sur Vercel : `MADA_APPLE_BUNDLE_ID=com.madastudio.app`.

Si le premier build s'arrête sur « credentials » (certificat de distribution et profil absents), les créer une fois depuis n'importe quel ordinateur, Windows compris : `cd app && npx eas-cli credentials -p ios`, se connecter avec l'identifiant Apple, choisir `production` puis « Build Credentials » → laisser EAS tout générer. Les builds suivants les réutilisent.
