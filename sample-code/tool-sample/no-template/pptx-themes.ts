/** Supported presentation themes expressed as PptxGenJS-compatible hex colors. */
export const PPTX_THEMES = {
  default: {
    name: "Professional",
    background: "FFFFFF",
    primary: "1E293B",
    accent: "2563EB",
    text: "334155",
    muted: "64748B",
  },
  corporate: {
    name: "Corporate",
    background: "F8FAFC",
    primary: "0F172A",
    accent: "1D4ED8",
    text: "1E293B",
    muted: "64748B",
  },
  dark: {
    name: "Dark",
    background: "0F172A",
    primary: "F8FAFC",
    accent: "38BDF8",
    text: "E2E8F0",
    muted: "94A3B8",
  },
  minimal: {
    name: "Minimal",
    background: "FFFFFF",
    primary: "111827",
    accent: "111827",
    text: "374151",
    muted: "9CA3AF",
  },
  creative: {
    name: "Creative",
    background: "FFF7ED",
    primary: "7C2D12",
    accent: "EA580C",
    text: "431407",
    muted: "9A3412",
  },
} as const;

/** Name of a theme accepted by the public PowerPoint tool. */
export type PptxThemeName = keyof typeof PPTX_THEMES;
