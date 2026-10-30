# Banc de rendu (Mac)

Le même `Composer`, `Compositor` et `Overlay` que l'app, lancés sur un Mac avec de vraies vidéos d'iPhone.

```bash
cd app/modules/mada-video/bench && ./build.sh
.build/bench probe ~/Desktop/rushes > /tmp/probe.json
node ../../../../scripts/bench/plan.mjs /tmp/probe.json /tmp/plan.json --gonfle
.build/bench render /tmp/plan.json /tmp/banc.mp4
```

`render` dit la durée de la composition et des instructions, si la composition est valide, puis l'erreur exacte d'AVFoundation ou « OK » avec la durée et les pistes du fichier.
