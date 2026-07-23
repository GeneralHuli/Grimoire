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

interface DiscoveredSpell {
  manifest: SpellManifest;
  spellDir: string;
}

function discoverSpells(): Map<string, DiscoveredSpell> {
  const discovered = new Map<string, DiscoveredSpell>();

  for (const entry of readdirSync(SPELLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const spellDir = join(SPELLS_DIR, entry.name);
    const manifestPath = join(spellDir, "spell.json");
    if (!existsSync(manifestPath)) continue;

    const manifest: SpellManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    discovered.set(manifest.name, { manifest, spellDir });
  }

  return discovered;
}

/** Fails loudly at startup rather than letting a Spell silently misbehave without a dependency it needs. */
function validateRequirements(spells: Map<string, DiscoveredSpell>): void {
  for (const { manifest } of spells.values()) {
    for (const dep of manifest.requires ?? []) {
      if (!spells.has(dep)) {
        throw new Error(
          `Spell "${manifest.name}" requires "${dep}", but no such Spell was found in ${SPELLS_DIR}`
        );
      }
    }
  }
}

/**
 * Orders Spells so a `requires` dependency always loads before its dependent, and so
 * Rituals load before ordinary Spells (Rituals are likely dependencies, e.g. shared
 * auth, even for Spells that don't explicitly `requires` them).
 */
function topologicalOrder(spells: Map<string, DiscoveredSpell>): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Circular Spell dependency detected at "${name}"`);
    }
    visiting.add(name);
    for (const dep of spells.get(name)!.manifest.requires ?? []) {
      visit(dep);
    }
    visiting.delete(name);
    visited.add(name);
    order.push(name);
  }

  const names = [...spells.keys()];
  const rituals = names.filter((name) => spells.get(name)!.manifest.kind === "ritual");
  const rest = names.filter((name) => spells.get(name)!.manifest.kind !== "ritual");
  for (const name of rituals) visit(name);
  for (const name of rest) visit(name);
  return order;
}

export async function loadSpells(app: Express): Promise<LoadedSpell[]> {
  if (!existsSync(SPELLS_DIR)) {
    return [];
  }

  const discovered = discoverSpells();
  validateRequirements(discovered);
  const order = topologicalOrder(discovered);

  const loaded: LoadedSpell[] = [];

  for (const name of order) {
    const { manifest, spellDir } = discovered.get(name)!;
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
