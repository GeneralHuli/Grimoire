import type { Express } from "express";

export interface SpellManifest {
  name: string;
  displayName: string;
  version: string;
  /** Path to the backend entry, relative to the spell's own directory. */
  backend: string;
  /** Name of the frontend component in web/src/spells to render for this spell. */
  frontend: string;
  config?: Record<string, unknown>;
}

export interface SpellModule {
  register(app: Express, config: Record<string, unknown>): void;
}
