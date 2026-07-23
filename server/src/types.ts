import type { Express } from "express";

export interface SpellManifest {
  name: string;
  displayName: string;
  version: string;
  /** Path to the backend entry, relative to the spell's own directory. */
  backend: string;
  /**
   * Name of the frontend component in web/src/spells to render for this spell.
   * Omitted for Rituals, which have no display on the App home page.
   */
  frontend?: string;
  /**
   * "ritual" marks a Spell that is purely functional (no home-page display), e.g.
   * shared auth. Rituals always load before ordinary Spells since other Spells are
   * likely to depend on them. Omitted/absent means an ordinary Spell.
   */
  kind?: "spell" | "ritual";
  /** Names of other Spells (by manifest `name`) that must be present for this one to load. */
  requires?: string[];
  config?: Record<string, unknown>;
}

export interface SpellModule {
  register(app: Express, config: Record<string, unknown>): void;
}
