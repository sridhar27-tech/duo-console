/**
 * themeConfig.ts — Visual theme definitions for Duo Console
 *
 * Each theme maps to a data-theme attribute on <html> and overrides the
 * CSS custom properties defined in App.css :root. The CRT scanline overlay
 * and flicker effect are toggled independently via data-crt on <html>.
 *
 * Themes:
 *   amber      — VT100 amber phosphor terminal (warm dark)
 *   matrix     — Classic green-on-black terminal
 *   cyberpunk  — Cyan/magenta neon on near-black
 *   stealth    — Monochrome slate, minimal palette
 *   default    — Original neo-brutal cream/black (no override needed)
 */

export type ThemeId = "default" | "amber" | "matrix" | "cyberpunk" | "stealth";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;           // shown in the [THEME: X] button
  /** CSS custom property overrides applied via data-theme="<id>" */
  vars: Record<string, string>;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "default",
    label: "DEFAULT",
    vars: {}, // no overrides — uses :root values from App.css
  },
  {
    id: "amber",
    label: "AMBER",
    vars: {
      "--black":        "#120a00",
      "--cream":        "#2a1500",
      "--paper":        "#1e1000",
      "--aqua":         "#ffb000",
      "--pink":         "#ff8c00",
      "--acid":         "#ffdb70",
      "--sun":          "#3d1f00",
      "--orange":       "#ff6600",
      "--purple":       "#cc8800",
      "--fg":           "#ffb000",
      // text and borders follow the amber palette
      "color":          "#ffb000",
      "background":     "#120a00",
    },
  },
  {
    id: "matrix",
    label: "MATRIX",
    vars: {
      "--black":        "#020d04",
      "--cream":        "#041a07",
      "--paper":        "#031206",
      "--aqua":         "#00ff66",
      "--pink":         "#a3ffc2",
      "--acid":         "#00ff66",
      "--sun":          "#062e0e",
      "--orange":       "#00cc44",
      "--purple":       "#00ff99",
      "--fg":           "#00ff66",
      "color":          "#00ff66",
      "background":     "#020d04",
    },
  },
  {
    id: "cyberpunk",
    label: "CYBER",
    vars: {
      "--black":        "#0a0012",
      "--cream":        "#120022",
      "--paper":        "#0e001a",
      "--aqua":         "#00f0ff",
      "--pink":         "#ff0055",
      "--acid":         "#00f0ff",
      "--sun":          "#1a0030",
      "--orange":       "#ff0055",
      "--purple":       "#cc00ff",
      "--fg":           "#00f0ff",
      "color":          "#00f0ff",
      "background":     "#0a0012",
    },
  },
  {
    id: "stealth",
    label: "STEALTH",
    vars: {
      "--black":        "#0d1117",
      "--cream":        "#161b22",
      "--paper":        "#0d1117",
      "--aqua":         "#8899a6",
      "--pink":         "#8899a6",
      "--acid":         "#ffffff",
      "--sun":          "#21262d",
      "--orange":       "#8899a6",
      "--purple":       "#8899a6",
      "--fg":           "#8899a6",
      "color":          "#8899a6",
      "background":     "#0d1117",
    },
  },
];

/** Index lookup — O(1) by id */
export const THEME_MAP = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
) as Record<ThemeId, ThemeDefinition>;

/** Cycle to the next theme in the list */
export function nextTheme(current: ThemeId): ThemeId {
  const idx = THEMES.findIndex((t) => t.id === current);
  return THEMES[(idx + 1) % THEMES.length].id;
}

/**
 * Apply a theme by writing its CSS variable overrides inline onto <html>.
 * Using inline styles on the root element means the overrides have the
 * highest specificity and cascade correctly over :root defaults.
 */
export function applyTheme(id: ThemeId): void {
  const theme = THEME_MAP[id];
  const root = document.documentElement;

  // Clear all previously applied theme vars first
  THEMES.forEach((t) => {
    Object.keys(t.vars).forEach((key) => {
      root.style.removeProperty(key);
    });
  });

  // Apply new theme vars
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Set data-theme for CSS selectors that need to target specific themes
  root.setAttribute("data-theme", id);
}

/**
 * Toggle CRT scanline + flicker overlay.
 * The overlay is a full-viewport pseudo-element on <body> controlled by
 * the data-crt attribute — see App.css for the actual rendering.
 */
export function setCRTMode(enabled: boolean): void {
  document.documentElement.setAttribute("data-crt", enabled ? "on" : "off");
}

/** Persist user preferences to localStorage */
export const STORAGE_KEYS = {
  THEME: "duo-console:theme",
  SFX:   "duo-console:sfx",
  CRT:   "duo-console:crt",
} as const;

export function loadPreferences(): {
  theme: ThemeId;
  sfxEnabled: boolean;
  crtEnabled: boolean;
} {
  return {
    theme:      (localStorage.getItem(STORAGE_KEYS.THEME) as ThemeId) ?? "default",
    sfxEnabled: localStorage.getItem(STORAGE_KEYS.SFX) !== "false",
    crtEnabled: localStorage.getItem(STORAGE_KEYS.CRT) === "true",
  };
}

export function savePreferences(
  theme: ThemeId,
  sfxEnabled: boolean,
  crtEnabled: boolean,
): void {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  localStorage.setItem(STORAGE_KEYS.SFX,   String(sfxEnabled));
  localStorage.setItem(STORAGE_KEYS.CRT,   String(crtEnabled));
}
