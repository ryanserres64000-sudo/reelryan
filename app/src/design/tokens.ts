// Fichier généré par design/build.mjs depuis design/tokens.json : ne pas modifier à la main.

export const tokens = {
  "color": {
    "dark": {
      "bg": "#0E0E0F",
      "surface": "#18181A",
      "surfaceRaised": "#222225",
      "line": "#2C2C2F",
      "text": "#F2F2F0",
      "textMuted": "#9C9C97",
      "action": "#2F4BE0",
      "onAction": "#FFFFFF",
      "actionStrong": "#93A5FF",
      "ai": "#93A5FF",
      "aiFill": "#93A5FF",
      "onAi": "#0E0E0F",
      "danger": "#EE8A80",
      "ok": "#7FC7A6",
      "scrim": "#0E0E0FB3",
      "media": "#000000",
      "onMedia": "#FFFFFF"
    },
    "light": {
      "bg": "#FFFFFF",
      "surface": "#F4F4F2",
      "surfaceRaised": "#EBEBE7",
      "line": "#E2E2DE",
      "text": "#121212",
      "textMuted": "#5F5F5A",
      "action": "#1F3BD6",
      "onAction": "#FFFFFF",
      "actionStrong": "#1F3BD6",
      "ai": "#1F3BD6",
      "aiFill": "#1F3BD6",
      "onAi": "#FFFFFF",
      "danger": "#B3261E",
      "ok": "#1F7A55",
      "scrim": "#FFFFFFB3",
      "media": "#000000",
      "onMedia": "#FFFFFF"
    }
  },
  "gradient": {
    "dark": [
      "#2F4BE0",
      "#7B2FD0",
      "#CC2E5D"
    ],
    "light": [
      "#1F3BD6",
      "#7B2FD0",
      "#CC2E5D"
    ]
  },
  "font": {
    "display": "InstrumentSerif_400Regular",
    "displayItalic": "InstrumentSerif_400Regular_Italic",
    "displayMedium": "InstrumentSans_600SemiBold",
    "body": "InstrumentSans_400Regular",
    "bodyStrong": "InstrumentSans_600SemiBold",
    "mono": "DMMono_500Medium",
    "ui": "system"
  },
  "type": {
    "display": {
      "font": "display",
      "size": 40,
      "lineHeight": 44,
      "letterSpacing": -0.4
    },
    "title": {
      "font": "display",
      "size": 34,
      "lineHeight": 38,
      "letterSpacing": -0.3
    },
    "headline": {
      "font": "displayMedium",
      "size": 20,
      "lineHeight": 26,
      "letterSpacing": -0.2
    },
    "body": {
      "font": "body",
      "size": 17,
      "lineHeight": 24,
      "letterSpacing": 0
    },
    "bodyStrong": {
      "font": "bodyStrong",
      "size": 17,
      "lineHeight": 24,
      "letterSpacing": 0
    },
    "callout": {
      "font": "body",
      "size": 15,
      "lineHeight": 21,
      "letterSpacing": 0
    },
    "caption": {
      "font": "body",
      "size": 13,
      "lineHeight": 18,
      "letterSpacing": 0
    },
    "mono": {
      "font": "mono",
      "size": 13,
      "lineHeight": 18,
      "letterSpacing": 0
    },
    "logo": {
      "font": "bodyStrong",
      "size": 44,
      "lineHeight": 52,
      "letterSpacing": -0.5
    },
    "button": {
      "font": "bodyStrong",
      "size": 17,
      "lineHeight": 22,
      "letterSpacing": 0
    }
  },
  "maxFontScale": 1.6,
  "radius": {
    "chip": 8,
    "button": 12,
    "card": 16,
    "sheet": 24,
    "full": 999
  },
  "space": {
    "xxs": 4,
    "xs": 8,
    "sm": 12,
    "md": 16,
    "lg": 24,
    "xl": 32,
    "xxl": 48
  },
  "layout": {
    "grid": 4,
    "gutter": 16,
    "gutterLarge": 20,
    "largePhoneWidth": 428
  },
  "size": {
    "touch": 44,
    "button": 52,
    "border": 1,
    "selection": 2,
    "icon": 22,
    "waveBar": 2,
    "waveGap": 1,
    "waveHeight": 72,
    "beatDot": 6,
    "frise": 64,
    "pill": 28,
    "textBar": 8,
    "handle": 5,
    "handleWidth": 36,
    "skeletonLine": 14,
    "dismissDrag": 96,
    "toastOffset": 96,
    "lane": 30,
    "laneMain": 52,
    "handleGrip": 14,
    "ruler": 18,
    "laneIcon": 28,
    "playhead": 2,
    "snapPx": 10
  },
  "opacity": {
    "waveOutside": 0.4,
    "disabled": 0.45,
    "pressed": 0.85,
    "pulseLow": 0.45
  },
  "motion": {
    "fast": 200,
    "base": 280,
    "slow": 350,
    "highlight": 2000,
    "stagger": 70,
    "pulse": 900,
    "toast": 5000,
    "autosave": 400,
    "pressScale": 0.97,
    "popScale": 1.08,
    "spring": {
      "damping": 26,
      "stiffness": 260,
      "mass": 1
    }
  },
  "marques": {
    "$doc": "Couleurs imposées par la charte d'une autre marque (le logo Google du bouton de connexion), jamais ailleurs.",
    "google": [
      "#4285F4",
      "#34A853",
      "#FBBC05",
      "#EA4335"
    ]
  }
} as const;

export type ColorScheme = keyof typeof tokens.color;
export type ColorName = keyof typeof tokens.color.dark;
export type TypeName = keyof typeof tokens.type;
export type SpaceName = keyof typeof tokens.space;
export type RadiusName = keyof typeof tokens.radius;
