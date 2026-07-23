export interface SpellManifest {
  name: string;
  displayName: string;
  version: string;
  /** Omitted for Rituals, which have no display on the App home page. */
  frontend?: string;
  kind?: "spell" | "ritual";
  config?: Record<string, unknown>;
}
