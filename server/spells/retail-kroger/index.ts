import type { Express, Request, Response } from "express";
import type { SpellModule } from "../../src/types.js";
import { getSettings } from "../../src/settingsStore.js";
import { getConsentUrl, exchangeCodeForTokens, searchLocations, searchProducts, addToCart } from "./client.js";
import { saveTokens, isConnected, clearTokens } from "./tokenStore.js";

function handleErrors(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error("[retail-kroger spell]", err);
      res.status(500).json({ error: "Kroger request failed" });
    });
  };
}

const mod: SpellModule = {
  register(app: Express) {
    app.get("/api/spells/retail-kroger/status", (_req, res) => {
      res.json({ connected: isConnected() });
    });

    app.get("/api/spells/retail-kroger/auth/start", (_req, res) => {
      res.redirect(getConsentUrl());
    });

    app.get(
      "/api/spells/retail-kroger/auth/callback",
      handleErrors(async (req, res) => {
        const code = req.query.code;
        if (typeof code !== "string") {
          res.status(400).send("Missing authorization code");
          return;
        }
        const tokens = await exchangeCodeForTokens(code);
        if (!tokens.refresh_token) {
          res.status(400).send("Kroger didn't return a refresh token. Try connecting again.");
          return;
        }
        saveTokens({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        });
        res.redirect("/");
      })
    );

    app.post("/api/spells/retail-kroger/auth/disconnect", (_req, res) => {
      clearTokens();
      res.json({ connected: false });
    });

    app.get(
      "/api/spells/retail-kroger/locations",
      handleErrors(async (req, res) => {
        const zipCode = req.query.zipCode;
        if (typeof zipCode !== "string" || !zipCode.trim()) {
          res.status(400).json({ error: "zipCode is required" });
          return;
        }
        const locations = await searchLocations(zipCode.trim());
        res.json({ locations });
      })
    );

    app.get(
      "/api/spells/retail-kroger/products",
      handleErrors(async (req, res) => {
        const term = req.query.q;
        if (typeof term !== "string" || !term.trim()) {
          res.status(400).json({ error: "q is required" });
          return;
        }
        const { locationId } = getSettings("retail-kroger") as { locationId?: string };
        if (!locationId) {
          res.status(400).json({ error: "Pick a Fred Meyer store in Settings first" });
          return;
        }
        const products = await searchProducts(term.trim(), locationId);
        res.json({ products });
      })
    );

    app.post(
      "/api/spells/retail-kroger/cart/items",
      handleErrors(async (req, res) => {
        if (!isConnected()) {
          res.status(401).json({ error: "Not connected to a Fred Meyer account" });
          return;
        }
        const { items } = req.body as { items?: { productId: string; quantity?: number }[] };
        if (!items || items.length === 0) {
          res.status(400).json({ error: "items is required" });
          return;
        }
        await addToCart(items.map((i) => ({ upc: i.productId, quantity: i.quantity ?? 1 })));
        res.status(204).end();
      })
    );
  },
};

export default mod;
