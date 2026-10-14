# MaDA

« Ma DA », ta directrice artistique : l'IA qui crée tes posts, vidéos et stories à ta place, avec espaces de marque, éditeur, sous-titres, idées et analyse Instagram.

## Comment ça marche

- `public/index.html` : l'application (une seule page).
- `public/shim.js` : relie l'application au serveur IA et gère l'enregistrement des fichiers.
- `api/generate.js` : fonction serveur (Vercel) qui appelle l'API Claude. La clé API reste sur le serveur, jamais dans le navigateur.
- `server.js` : le même serveur pour un hébergement Node classique (Render, Railway, VPS) ou pour tester en local.

Les marques, créations et images sont enregistrées dans le navigateur de chaque visiteur. Le bouton « Exporter mes données » de la page Compte permet d'en garder une copie.

## Mise en ligne sur Vercel

1. Crée une clé API sur https://console.anthropic.com/settings/keys (et ajoute du crédit sur le compte).
2. Va sur https://vercel.com/new, connecte ton GitHub et importe ce dépôt. Aucun réglage de build n'est nécessaire.
3. Dans **Settings → Environment Variables**, ajoute :
   - `ANTHROPIC_API_KEY` : ta clé API (obligatoire)
   - `APP_PASSWORD` : un code d'accès que l'app demandera avant d'utiliser l'IA. Fortement conseillé : sans lui, n'importe qui ayant le lien peut consommer ton crédit API.
4. Clique sur **Redeploy**. L'app est en ligne sur l'adresse donnée par Vercel ; tu peux y relier ton propre nom de domaine dans **Settings → Domains**.

Réglages optionnels : `RR_MODEL` (modèle Claude, par défaut `claude-opus-5-5`) et `RR_EFFORT` (`low`, `medium` par défaut, `high`).

## Tester en local

```bash
npm install
cp .env.example .env   # puis remplis ANTHROPIC_API_KEY
npm run dev            # http://localhost:3000
```

## Autres hébergeurs

Sur Render, Railway ou un serveur, lance `npm start` avec les mêmes variables d'environnement (le port est lu dans `PORT`).
