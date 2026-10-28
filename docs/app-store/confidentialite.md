# Étiquettes de confidentialité (App Store Connect, « App Privacy »)

Réponses à saisir dans App Store Connect pour Ma DA v1 (étude, ch. 9, tableau App Store, ligne « Étiquettes de confidentialité »). Elles doivent rester alignées sur `app/app.json` (`ios.privacyManifests`) et sur `public/confidentialite.html`. À relire à chaque nouvelle fonction qui envoie quelque chose au serveur.

## Suivi (tracking)

**Non.** Aucun SDK publicitaire ni de mesure d'audience, aucune donnée croisée avec d'autres apps ou sites. Pas d'App Tracking Transparency à demander.

## Données collectées

« Collectée » au sens d'Apple = qui quitte l'iPhone et qui est gardée plus longtemps que nécessaire pour répondre à la demande. Apple demande aussi de déclarer ce qui part vers un tiers (Anthropic), même sans conservation.

| Catégorie Apple | Donnée Ma DA | Liée à l'identité | Suivi | Finalité |
| --- | --- | --- | --- | --- |
| Contenu utilisateur → Photos ou vidéos | 15 à 30 images basse résolution par montage, photos et logo en petit pour un visuel (envoyés à Claude, non gardés) | Non | Non | Fonctionnalités de l'app |
| Contenu utilisateur → Autre contenu | Brief, carnet de style résumé, réponses à l'inscription, demandes de retouche (non gardés) | Non | Non | Fonctionnalités de l'app |
| Identifiants → Identifiant de l'appareil | Identifiant aléatoire `x-mada-device` (trousseau iOS), compteur de créations offertes | Non | Non | Fonctionnalités de l'app (quotas, prévention de la fraude) |
| Achats → Historique d'achats | Statut Pro (pour l'instant déclaré par l'app ; plus tard reçu StoreKit vérifié) | Non | Non | Fonctionnalités de l'app |

Non collecté : nom, e-mail, téléphone, adresse, localisation, contacts, historique de navigation, données de santé, diagnostics, données financières (le paiement est chez Apple).

Quand « Se connecter avec Apple » arrivera : ajouter « Coordonnées → Adresse e-mail » (liée à l'identité, fonctionnalités de l'app) et « Identifiants → Identifiant utilisateur ».

## Manifeste de confidentialité (`PrivacyInfo.xcprivacy`)

Écrit par Expo à partir de `app.json` → `ios.privacyManifests` :

- `NSPrivacyTracking` : faux ; aucun domaine de suivi.
- Types de données collectées : les 4 lignes du tableau, non liées, sans suivi, finalité « App Functionality ».
- API à raison déclarée : `UserDefaults` (CA92.1, réglages de l'app via AsyncStorage) et horodatage de fichiers (C617.1, fichiers de l'app). Les modules Expo apportent leurs propres manifestes ; vérifier le rapport de confidentialité généré par Xcode (Product → Archive → « Generate Privacy Report ») avant l'envoi.

## Mentions dans l'app

- Consentement avant l'IA (règle 5.1.2(i)) : `ConsentScreen`, avant la première analyse ou le premier montage ; refus = montage à la main et visuels sans IA ; réversible dans Réglages.
- Suppression du compte (règle 5.1.1(v)) : Réglages → « Supprimer mon compte et mes données » → `DELETE /api/compte`.
- Marquage IA (AI Act, art. 50) : métadonnées `com.apple.quicktime.description` « Montage assisté par IA » sur chaque vidéo (`core/export.ts`, `provenance`).
- Textes des autorisations iOS : `expo-image-picker` (photothèque, sélection seulement) et `expo-media-library` (enregistrement dans Photos), dans `app.json`.

## Points vérifiés et restants

- Anthropic : demandes et réponses effacées sous 30 jours (2 ans en cas d'abus), aucun entraînement sur l'API commerciale ; DPA à accepter et à archiver, option « zéro rétention » à demander (voir `docs/legal/a-completer.md`).
- Serveur Vercel à Paris (`vercel.json`, `cdg1`) ; base des compteurs à créer dans l'Union européenne.
- Pro : le serveur vérifie les transactions StoreKit 2 signées par Apple (`lib/apple.js`). Dans App Store Connect, renseigner l'URL des notifications serveur V2 : `https://<site>/api/apple/notifications` (production et sandbox), et sur Vercel `MADA_APPLE_BUNDLE_ID`.
