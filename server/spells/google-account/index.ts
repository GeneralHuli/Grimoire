import type { Express, Request, Response } from "express";
import type { SpellModule } from "../../src/types.js";
import { createOAuthClient, getConsentUrl } from "./client.js";
import { saveRefreshToken, isConnected, clearRefreshToken } from "./tokenStore.js";

function handleErrors(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error("[google-account spell]", err);
      res.status(500).send("Failed to complete Google sign-in");
    });
  };
}

const mod: SpellModule = {
  register(app: Express) {
    app.get("/api/spells/google-account/status", (_req, res) => {
      res.json({ connected: isConnected() });
    });

    app.get("/api/spells/google-account/auth/start", (_req, res) => {
      res.redirect(getConsentUrl());
    });

    app.get(
      "/api/spells/google-account/auth/callback",
      handleErrors(async (req, res) => {
        const code = req.query.code;
        if (typeof code !== "string") {
          res.status(400).send("Missing authorization code");
          return;
        }
        const client = createOAuthClient();
        const { tokens } = await client.getToken(code);
        if (!tokens.refresh_token) {
          res
            .status(400)
            .send(
              "Google didn't return a refresh token. Remove Grimoire's access at " +
                "https://myaccount.google.com/permissions and try connecting again."
            );
          return;
        }
        saveRefreshToken(tokens.refresh_token);
        res.redirect("/");
      })
    );

    app.post("/api/spells/google-account/auth/disconnect", (_req, res) => {
      clearRefreshToken();
      res.json({ connected: false });
    });
  },
};

export default mod;
