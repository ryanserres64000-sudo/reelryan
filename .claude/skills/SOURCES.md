# Provenance des skills du projet

Copies figées (vendored) des skills communautaires, vérifiées le 2026-10-25 : aucun script lancé à l'installation, aucun accès réseau caché. Pour mettre à jour, recopier le dossier depuis le dépôt d'origine et relire le diff.

| Skill | Dépôt d'origine | Commit | Licence | Remarques |
| --- | --- | --- | --- | --- |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (`.claude/skills/ui-ux-pro-max`) | `d14efff` | MIT | Scripts Python de recherche dans des CSV locaux, sans réseau. Dossier `scripts/tests` retiré. |
| `design-taste-frontend` | [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) (`skills/taste-skill`) | `12af471` | MIT | Remplace `minimalist-ui`, fusionné par l'auteur dans ce skill unique. `scripts/assets.mjs` interroge des banques d'images libres (Openverse, Wikimedia, Met, Art Institute of Chicago) uniquement quand on le lance ; `scripts/inspect.mjs` pilote un navigateur local. |
| `remotion-best-practices` | [remotion-dev/skills](https://github.com/remotion-dev/skills) (`skills/remotion-best-practices`) | `6c67adc` | aucun fichier de licence dans le dépôt | Skill officiel de Remotion. Remotion lui-même demande une licence entreprise au-delà de 3 personnes. |
| `grill-me`, `grilling` | [mattpocock/skills](https://github.com/mattpocock/skills) (`skills/productivity`) | `5beb35b` | MIT | `grill-me` appelle `grilling` : garder les deux. Texte seul. |
| `content-strategy`, `social`, `pricing` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (`skills/…`) | `e85f3cb` | MIT | Texte seul. Dossiers `evals` retirés. Lisent `.claude/product-marketing.md` s'il existe. |

Écarté : `anti-ui-slop` (copie dans [github/awesome-copilot](https://github.com/github/awesome-copilot), auteur UIZZE). Contenu très mince (environ 8 Ko), pensé comme porte d'entrée vers un service MCP payant, et ses consignes demandent à l'agent de cacher à l'utilisateur quand ce service ne renvoie rien.
