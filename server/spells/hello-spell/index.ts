import type { Express } from "express";
import type { SpellModule } from "../../src/types.js";

const mod: SpellModule = {
  register(app: Express, config) {
    app.get("/api/spells/hello-spell", (_req, res) => {
      res.json({ message: config.greeting ?? "hello" });
    });
  },
};

export default mod;
