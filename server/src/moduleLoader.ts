import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Express } from "express";
import type { SpellManifest, SpellModule } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPELLS_DIR = resolve(__dirname, "../spells");

export interface LoadedSpell {
  manifest: SpellManifest;
}

export async function loadSpells(app: Express): Promise<LoadedSpell[]> {
  if (!existsSync(SPELLS_DIR)) {
    return [];
  }

  const loaded: LoadedSpell[] = [];

  for (const entry of readdirSync(SPELLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const spellDir = join(SPELLS_DIR, entry.name);
    const manifestPath = join(spellDir, "spell.json");
    if (!existsSync(manifestPath)) continue;

    const manifest: SpellManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const backendPath = join(spellDir, manifest.backend);
    const imported = (await import(pathToFileURL(backendPath).href)) as {
      default: SpellModule;
    };

    imported.default.register(app, manifest.config ?? {});
    loaded.push({ manifest });

    console.log(`[grimoire] loaded spell "${manifest.name}" v${manifest.version}`);
  }

  return loaded;
}
