export interface SpellManifest {
  name: string;
  displayName: string;
  version: string;
  frontend: string;
  config?: Record<string, unknown>;
}
