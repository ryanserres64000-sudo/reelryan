# App iPhone MaDa (Expo)

Lot 1 : le design system « Atelier de nuit » (étude, ch. 6). L'app affiche pour l'instant le catalogue des composants ; les vrais écrans arrivent au lot 2.

- `src/design/tokens.ts` : généré depuis `../design/tokens.json` par `node ../design/build.mjs`. Ne pas modifier à la main.
- `src/design/` : thème clair et sombre (sombre par défaut), `Text`, composants (boutons, puces, cartes de rush, frise, sélecteur de musique, forme d'onde, paywall, pastille « Enregistré », écran de génération).
- `src/copy/fr.ts` : tous les textes de l'app, au ton MaDa.
- `src/screens/` : les écrans. Aucune couleur, taille ni texte en dur : `node ../design/check-hardcoded.mjs` le vérifie.

Commandes : `npm run typecheck`, `npx expo export --platform web` (aperçu dans un navigateur), `npx expo run:ios` sur un Mac avec Xcode (dev build).
Les dépendances suivent le SDK 58 (`node_modules/expo/bundledNativeModules.json`).
