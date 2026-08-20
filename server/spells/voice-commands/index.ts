import type { Express, Request, Response } from "express";
import type { SpellModule } from "../../src/types.js";
import { parseCommand, type CommandContext } from "./parseCommand.js";

function handleErrors(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error("[voice-commands spell]", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "internal_error" });
    });
  };
}

function parseContext(body: unknown): CommandContext {
  const b = (body ?? {}) as Partial<CommandContext>;
  return {
    choreBoards: Array.isArray(b.choreBoards) ? b.choreBoards : [],
    groceryItems: Array.isArray(b.groceryItems) ? b.groceryItems : [],
    recipes: Array.isArray(b.recipes) ? b.recipes : [],
  };
}

const mod: SpellModule = {
  register(app: Express) {
    app.post(
      "/api/spells/voice-commands/parse",
      handleErrors(async (req, res) => {
        const { text, context } = req.body as { text?: string; context?: unknown };
        if (!text || !text.trim()) {
          res.status(400).json({ error: "text is required" });
          return;
        }
        const intent = await parseCommand(text.trim(), parseContext(context));
        res.json(intent);
      })
    );
  },
};

export default mod;
