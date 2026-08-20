export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/**
 * Unset/"dark" both resolve to dark -- dark is the app default, not just a fallback for
 * missing settings. Only an explicit "light" choice, or "system" resolving light,
 * produces a light theme.
 */
export function resolveTheme(choice: ThemeChoice | undefined, prefersLight: boolean): ResolvedTheme {
  if (choice === "light") return "light";
  if (choice === "system") return prefersLight ? "light" : "dark";
  return "dark";
}

/**
 * Sets `color-scheme` explicitly (not the old `light dark` both-allowed value) so native
 * form controls and any remaining `canvas`/`canvastext` usages follow the app's resolved
 * theme even when it disagrees with the OS setting.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}
