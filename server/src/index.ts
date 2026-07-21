import express from "express";
import { loadSpells } from "./moduleLoader.js";

const app = express();
app.use(express.json());

const spells = await loadSpells(app);

app.get("/api/spells", (_req, res) => {
  res.json(spells.map((s) => s.manifest));
});

app.get("/healthz", (_req, res) => res.send("ok"));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`[grimoire] server listening on :${port}`);
});
