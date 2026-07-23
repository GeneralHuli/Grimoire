import Anthropic from "@anthropic-ai/sdk";
import type { RecipeDraft } from "./importRecipe.js";

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    mealType: { type: "string" },
    ease: { type: "string", enum: ["easy", "medium", "hard"] },
    ingredients: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "string" } },
  },
  required: ["title", "mealType", "ease", "ingredients", "steps"],
  additionalProperties: false,
} as const;

export async function generateRecipe(prompt: string): Promise<RecipeDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    output_config: { format: { type: "json_schema", schema: RECIPE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Write a complete, practical recipe a home cook could follow, based on this request: ${prompt}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No recipe returned");
  return JSON.parse(block.text) as RecipeDraft;
}
