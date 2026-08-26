import Anthropic from "@anthropic-ai/sdk";

const PARSE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantityDisplay: { type: "string" },
          amount: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          isStaple: { type: "boolean" },
          note: { type: ["string", "null"] },
        },
        required: ["name", "quantityDisplay", "amount", "unit", "isStaple", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export interface ParsedGroceryIngredient {
  name: string;
  quantityDisplay: string;
  amount: number | null;
  unit: string | null;
  isStaple: boolean;
  note: string | null;
}

const BASELINE_STAPLES = [
  "salt",
  "black pepper",
  "olive oil",
  "vegetable oil",
  "cooking oil",
  "butter",
  "sugar",
  "brown sugar",
  "flour",
  "milk",
  "eggs",
  "garlic powder",
  "onion powder",
  "dried oregano",
  "dried basil",
  "dried thyme",
  "cumin",
  "paprika",
  "cinnamon",
  "baking powder",
  "baking soda",
  "vanilla extract",
  "soy sauce",
  "ketchup",
  "mustard",
  "mayonnaise",
];

export async function parseIngredientsForGrocery(
  lines: string[],
  knownStaples: string[]
): Promise<ParsedGroceryIngredient[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  const client = new Anthropic({ apiKey });

  const staples = [...new Set([...BASELINE_STAPLES, ...knownStaples.map((s) => s.toLowerCase())])];

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    output_config: { format: { type: "json_schema", schema: PARSE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `You are cleaning up a raw recipe ingredient list so a household can shop from it. Given these ingredient lines (possibly from more than one recipe):

${lines.map((l) => `- ${l}`).join("\n")}

For each distinct ingredient, produce one entry:
- "name": a short, clean, shoppable grocery name. Strip prep instructions and cooking
  state — anything describing what to DO to the ingredient or its state at cook time,
  not what to buy (chopped, diced, minced, sliced, melted, softened, room temperature,
  "to taste", any degree-of-fineness adverb like finely/coarsely/roughly/thinly, and
  default/implied states that describe the ingredient's normal off-the-shelf form, like
  "uncooked" or "dry"). Only keep a descriptor when it changes which product or aisle
  you'd actually pick up (fresh vs. dried vs. frozen vs. canned, unsalted vs. salted,
  low-fat, whole vs. ground, grated vs. block, etc.). Examples:
    - "2tbsp chopped fresh parsley" -> "fresh parsley" (fresh vs. dried is a real buying
      choice; chopped is prep)
    - "8 oz uncooked pasta" -> "pasta" (pasta is uncooked by default off the shelf)
    - "1 cup dry bread crumbs" -> "bread crumbs" (bread crumbs are dry by default)
    - "1/2 cup finely grated parmesan cheese" -> "grated parmesan cheese" (drop "finely";
      keep "grated" only because pre-grated vs. a block is a real product choice)
- Merge duplicate or near-duplicate ingredients that appear more than once across the
  WHOLE input list into a single entry, summing their quantities whenever the units are
  compatible (e.g. 1/4 cup + 1/2 cup cherry tomatoes -> 3/4 cup cherry tomatoes).
- "quantityDisplay": the combined amount phrased as a common retail package count/size
  when it makes sense (cans, boxes, bundles, bags, sticks) rather than the raw recipe
  amount — e.g. 12 oz tomato paste -> "2 (6 oz) cans". Pick standard sizes a real grocery
  store would sell, and double-check your unit math before picking one — never state a
  converted size that doesn't actually equal the recipe amount. For ingredients normally
  sold only in a fixed standard package (butter sticks/boxes, cream cheese blocks,
  tortilla packs, etc.), round UP to that standard package instead of inventing a custom
  size: e.g. 1/4 cup butter is 2 oz (1/4 cup = 4 tbsp = 2 oz = 1/2 stick), but butter
  isn't sold in 2 oz units, so say "1 (16 oz) box", not "2 oz butter". Know your
  conversions: 1 cup butter = 8 oz = 2 sticks; 1 stick butter = 4 oz = 1/2 cup = 8 tbsp.
- "amount"/"unit": the underlying combined numeric amount and its unit word in the
  recipe's own terms (e.g. 0.25 and "cup" for the butter example above — NOT the retail
  package size), using null/null when there's no meaningful single number (e.g. "to
  taste").
- "note": when quantityDisplay is a package size that doesn't exactly match what's
  needed, briefly say how much is actually used (e.g. "about 3/4 cup needed" or "uses 1/4
  cup of the 16 oz box"); otherwise null.
- "isStaple": true for common pantry/fridge staples a household usually already has on
  hand — basic salt/pepper/oil/butter/sugar/flour/milk/eggs, common dried herbs and
  spices, and condiments — OR anything in this household's own known-staples list:
  ${staples.join(", ")}. Everything else is false.

Return every distinct ingredient exactly once.`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No parsed ingredients returned");
  const parsed = JSON.parse(block.text) as { items: ParsedGroceryIngredient[] };
  return parsed.items;
}
