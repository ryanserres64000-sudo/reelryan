# MaDA

« Ma DA », ta directrice artistique : l'IA qui crée tes posts, vidéos et stories à ta place, avec espaces de marque, éditeur, sous-titres, idées et analyse Instagram.

## Comment ça marche

- `public/index.html` : l'application (une seule page, générée depuis `source/`).
- `public/shim.js` : relie l'application au serveur IA et gère l'enregistrement des fichiers.
- `api/generate.js` : fonction serveur (Vercel) qui appelle l'API Claude. La clé API reste sur le serveur, jamais dans le navigateur.
- `server.js` : le même serveur pour un hébergement Node classique (Render, Railway, VPS) ou pour tester en local.

Sur mobile, MaDA peut s'ajouter à l'écran d'accueil comme une app (Partager → « Sur l'écran d'accueil » sur iPhone).

Les marques, créations et images sont enregistrées dans le navigateur de chaque visiteur. Le bouton « Exporter mes données » de la page Compte permet d'en garder une copie.

## Mise en ligne sur Vercel

1. Crée une clé API sur https://console.anthropic.com/settings/keys (et ajoute du crédit sur le compte).
2. Ouvre https://vercel.com/new/import?s=https://github.com/ryanserres64000-sudo/reelryan, connecte ton GitHub si on te le demande, et clique sur **Deploy**. Aucun réglage de build n'est nécessaire.
3. Dans **Settings → Environment Variables**, ajoute :
   - `ANTHROPIC_API_KEY` : ta clé API (obligatoire)
   - `APP_PASSWORD` : un code d'accès que l'app demandera avant d'utiliser l'IA. Fortement conseillé : sans lui, n'importe qui ayant le lien peut consommer ton crédit API.
4. Clique sur **Redeploy**. L'app est en ligne sur l'adresse donnée par Vercel ; tu peux y relier ton propre nom de domaine dans **Settings → Domains**.

Réglages optionnels : `RR_MODEL` (modèle Claude, par défaut `claude-opus-5-5`), `RR_EFFORT` (`low`, `medium` par défaut, `high`) et `MAX_PER_HOUR` (demandes IA maximum par visiteur et par heure, 60 par défaut).

Conseil : fixe aussi un plafond de dépenses mensuel dans la console Anthropic (*Limits*).

## Galerie de musique et MaDA Pro (serveur)

- `JAMENDO_CLIENT_ID` : active la recherche de musique (clé gratuite sur https://developer.jamendo.com). L'usage commercial dans une app payante demande un contrat de licence (Jamendo Licensing, Epidemic Sound ou Soundstripe) avant la sortie publique.
- `REVENUECAT_SECRET_KEY` : active MaDA Pro. Sans abonnement, chaque appareil a `FREE_PER_DAY` demandes IA par jour (15 par défaut). Sans cette clé, tout le monde a tout.

## Comptes, Instagram et TikTok

Les comptes sont facultatifs : sans compte, tout reste sur l'appareil. Avec un compte, les marques, créations et idées sont synchronisées, et on peut connecter Instagram et TikTok pour publier directement et voir ses statistiques.

1. **Supabase** (gratuit pour démarrer) : crée un projet en Europe, exécute `supabase/schema.sql` dans *SQL Editor*, puis ajoute `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` dans Vercel.
   - *Authentication → Emails* : dans le modèle « Magic Link », ajoute `{{ .Token }}` pour que l'e-mail contienne le code à 6 chiffres.
   - *Authentication → Providers* : active Apple et Google (identifiants à créer chez Apple et Google).
   - *Authentication → URL Configuration* : ajoute l'adresse du site et `com.madastudio.app://auth` aux adresses de redirection.
2. **Instagram** : sur developers.facebook.com, crée une app avec le produit « Instagram API with Instagram login ». Adresse de redirection : `APP_URL/api/social/callback`. Permissions : `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`. Avant validation par Meta, seuls les comptes testeurs ajoutés à l'app peuvent se connecter. Les comptes Instagram doivent être professionnels (créateur ou entreprise).
3. **TikTok** : sur developers.tiktok.com, crée une app avec Login Kit et Content Posting API (publication directe), même adresse de redirection. Portées : `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.publish`, `video.upload`, `video.list`. Avant l'audit de TikTok, les vidéos publiées restent privées.
4. Dans Vercel : `APP_URL`, `SOCIAL_TOKEN_KEY` (une longue phrase aléatoire), `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.

Les jetons Instagram et TikTok sont chiffrés et lus uniquement par le serveur. Les fichiers envoyés pour publication sont supprimés juste après.

## Application iPhone et Android

L'app mobile est la même application, emballée avec Capacitor (`ios/`, `android/`). Elle appelle ton serveur Vercel.

1. Dans `.env`, renseigne `MADA_API_BASE` (adresse de ton site Vercel) et, pour les achats, `MADA_RC_IOS_KEY` / `MADA_RC_ANDROID_KEY` (clés publiques RevenueCat).
2. `npm install`, puis :
   - iPhone (sur un Mac avec Xcode) : `npm run ios`, choisis ton équipe dans *Signing & Capabilities*, puis *Product → Archive* pour l'envoyer sur TestFlight.
   - Android (avec Android Studio) : `npm run android`, puis *Build → Generate Signed App Bundle* pour Google Play.
3. Après chaque modification de l'app : `cd source && python3 build.py`, puis `npm run mobile:build`.

L'identifiant de l'app est `com.madastudio.app` (dans `capacitor.config.json`) : change-le avant la première soumission si tu préfères un autre nom, il ne pourra plus changer ensuite. Les icônes viennent de `assets/` (`npm run mobile:icons` pour les régénérer).

Pages obligatoires pour les stores : `/confidentialite.html` et `/conditions.html` (complète le nom de l'éditeur et l'e-mail de contact).

## Tester en local

```bash
npm install
cp .env.example .env   # puis remplis ANTHROPIC_API_KEY
npm run dev            # http://localhost:3000
```

## Modifier l'application

Le code de l'app est découpé en modules dans `source/` (voir `CLAUDE.md` et `source/MISSION.md`). Après une modification, reconstruis la page :

```bash
cd source && python3 build.py && node --check all.js
```

Cela met à jour `public/index.html` (site web) et `source/mada-studio.html` (version Claude).

## Autres hébergeurs

Sur Render, Railway ou un serveur, lance `npm start` avec les mêmes variables d'environnement (le port est lu dans `PORT`).
