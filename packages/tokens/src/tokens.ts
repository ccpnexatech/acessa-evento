// Gerado por scripts/gerar.ts a partir de tokens.json. Não edite à mão.
export const temas = ["light","dark","alto-contraste"] as const;
export type Tema = (typeof temas)[number];

export const cores = {
  "light": {
    "surface000": "#ffffff",
    "surface100": "#f4f6f5",
    "surface200": "#e7ebea",
    "ink900": "#12201e",
    "ink600": "#46534f",
    "borderHairline": "#d5dcda",
    "borderControl": "#6f7d79",
    "primary050": "#eef8f9",
    "primary100": "#d4eef1",
    "primary600": "#0a5c69",
    "primary700": "#074550",
    "onPrimary": "#ffffff",
    "accent400": "#f2b23a",
    "onAccent": "#12201e",
    "success100": "#e1f4e8",
    "success700": "#1d6b40",
    "danger100": "#fde7e5",
    "danger700": "#a41e15",
    "warning100": "#fff1d6",
    "warning700": "#6e4700",
    "focusRing": "#1b5fd1"
  },
  "dark": {
    "surface000": "#0e1615",
    "surface100": "#16211f",
    "surface200": "#20302d",
    "ink900": "#eef4f3",
    "ink600": "#b3c1bd",
    "borderHairline": "#2c3d3a",
    "borderControl": "#8b9a96",
    "primary050": "#0f2a2e",
    "primary100": "#133a40",
    "primary600": "#6fd0dd",
    "primary700": "#9fe3ec",
    "onPrimary": "#06262b",
    "accent400": "#f5c45e",
    "onAccent": "#12201e",
    "success100": "#12301f",
    "success700": "#7ee0aa",
    "danger100": "#3a1513",
    "danger700": "#ffa79f",
    "warning100": "#33270b",
    "warning700": "#f2c14e",
    "focusRing": "#8ab4ff"
  },
  "alto-contraste": {
    "surface000": "#ffffff",
    "surface100": "#ffffff",
    "surface200": "#f0f0f0",
    "ink900": "#000000",
    "ink600": "#1a1a1a",
    "borderHairline": "#000000",
    "borderControl": "#000000",
    "primary050": "#ffffff",
    "primary100": "#e8f3f5",
    "primary600": "#003a43",
    "primary700": "#00262c",
    "onPrimary": "#ffffff",
    "accent400": "#ffcc00",
    "onAccent": "#000000",
    "success100": "#ffffff",
    "success700": "#00552a",
    "danger100": "#ffffff",
    "danger700": "#8a0000",
    "warning100": "#ffffff",
    "warning700": "#4d3200",
    "focusRing": "#0000ee"
  }
} as const;
export type NomeCor = keyof (typeof cores)['light'];

export const espaco = {
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "6": 24,
  "8": 32,
  "12": 48
} as const;
export const raio = {
  "sm": 6,
  "md": 12,
  "lg": 20,
  "pill": 999
} as const;
export const tamanho = {
  "touchMin": 48,
  "touchLg": 56,
  "icon": 24,
  "bpMedium": 600,
  "bpExpanded": 840
} as const;
export const tipografia = {
  "display": {
    "familia": "display",
    "tamanho": 32,
    "alturaLinha": 38,
    "peso": "700"
  },
  "titleLg": {
    "familia": "display",
    "tamanho": 24,
    "alturaLinha": 30,
    "peso": "600"
  },
  "title": {
    "familia": "display",
    "tamanho": 20,
    "alturaLinha": 26,
    "peso": "600"
  },
  "bodyLg": {
    "familia": "sans",
    "tamanho": 18,
    "alturaLinha": 26,
    "peso": "400"
  },
  "body": {
    "familia": "sans",
    "tamanho": 16,
    "alturaLinha": 24,
    "peso": "400"
  },
  "bodyStrong": {
    "familia": "sans",
    "tamanho": 16,
    "alturaLinha": 24,
    "peso": "700"
  },
  "label": {
    "familia": "sans",
    "tamanho": 14,
    "alturaLinha": 20,
    "peso": "700"
  },
  "caption": {
    "familia": "sans",
    "tamanho": 14,
    "alturaLinha": 20,
    "peso": "400"
  }
} as const;
