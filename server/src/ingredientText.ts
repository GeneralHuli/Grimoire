const UNIT_WORDS = new Set([
  "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
  "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds", "g", "gram", "grams", "kg",
  "ml", "milliliter", "milliliters", "l", "liter", "liters", "litre", "litres",
  "clove", "cloves", "can", "cans", "package", "packages", "pkg", "pinch", "pinches",
  "dash", "dashes", "slice", "slices", "stick", "sticks", "bunch", "bunches",
  "head", "heads", "quart", "quarts", "qt", "pint", "pints", "pt", "gallon", "gallons", "gal",
]);

const NUMBER_TOKEN = /^(\d+-\d+|\d+\/\d+|\d+(\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])$/;

/**
 * Heuristically splits a free-text ingredient/grocery line like "2 cups flour"
 * into a leading quantity ("2 cups") and the remaining name ("flour"). Falls
 * back to an empty quantity when no leading number is found. Imprecise by
 * nature (e.g. "3 large eggs" -> quantity "3", name "large eggs") — callers
 * that need a better search term should let the user edit it directly.
 */
export function splitIngredientText(raw: string): { quantity: string; name: string } {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { quantity: "", name: "" };

  const words = text.split(" ");
  let i = 0;
  while (i < words.length && NUMBER_TOKEN.test(words[i])) i++;
  if (i === 0) return { quantity: "", name: text };

  if (words[i] === "to" && i + 1 < words.length && NUMBER_TOKEN.test(words[i + 1])) {
    i += 2;
  }
  if (i < words.length && UNIT_WORDS.has(words[i].toLowerCase().replace(/\.$/, ""))) {
    i++;
  }

  const quantity = words.slice(0, i).join(" ");
  const name = words.slice(i).join(" ");
  return name ? { quantity, name } : { quantity: "", name: text };
}

export function joinIngredientText(quantity: string, name: string): string {
  return quantity ? `${quantity} ${name}`.trim() : name.trim();
}
