import express from "express";
import { loadSpells } from "./moduleLoader.js";
import { getSettings, setSettings } from "./settingsStore.js";

const app = express();
app.use(express.json());

const spells = await loadSpells(app);

app.get("/api/spells", (_req, res) => {
  res.json(spells.map((s) => s.manifest));
});

// Settings are scoped to "general" or a Spell's manifest name. A Spell's manifest
// `config` acts as its defaults; anything saved here overrides those defaults.
app.get("/api/settings/:scope", (req, res) => {
  const { scope } = req.params;
  const defaults = spells.find((s) => s.manifest.name === scope)?.manifest.config ?? {};
  res.json({ ...defaults, ...getSettings(scope) });
});

app.put("/api/settings/:scope", (req, res) => {
  const { scope } = req.params;
  setSettings(scope, req.body as Record<string, unknown>);
  const defaults = spells.find((s) => s.manifest.name === scope)?.manifest.config ?? {};
  res.json({ ...defaults, ...getSettings(scope) });
});

app.get("/healthz", (_req, res) => res.send("ok"));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`[grimoire] server listening on :${port}`);
});
