export interface RecipeDraft {
  title: string;
  mealType: string;
  ease: string;
  ingredients: string[];
  steps: string[];
  sourceUrl?: string;
}

/** Recursively searches parsed JSON-LD for a node whose @type is (or includes) "Recipe". */
function findRecipeNode(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const type = obj["@type"];
    const isRecipe = type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
    if (isRecipe) return obj;
    if (Array.isArray(obj["@graph"])) {
      const found = findRecipeNode(obj["@graph"]);
      if (found) return found;
    }
  }
  return null;
}

/** schema.org HowToStep entries are `{ "@type": "HowToStep", "text": "..." }`; plain strings pass through. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "text" in value) {
    return textOf((value as { text: unknown }).text);
  }
  return "";
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(textOf).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function importRecipeFromUrl(url: string): Promise<RecipeDraft> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Grimoire recipe importer)" } });
  if (!res.ok) throw new Error(`Failed to fetch page (${res.status})`);
  const html = await res.text();

  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const node = findRecipeNode(parsed);
    if (!node) continue;
    const ingredients = toList(node.recipeIngredient ?? node.ingredients);
    const steps = toList(node.recipeInstructions);
    if (ingredients.length === 0 && steps.length === 0) continue;
    const category = node.recipeCategory;
    const mealType = Array.isArray(category) ? textOf(category[0]) : textOf(category);
    return {
      title: textOf(node.name) || "Imported recipe",
      mealType,
      ease: "medium",
      ingredients,
      steps,
      sourceUrl: url,
    };
  }
  throw new Error("Couldn't find recipe data on that page");
}
