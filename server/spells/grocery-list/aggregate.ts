/**
 * Heuristic free-text ingredient parsing — recipe ingredients are stored as plain lines
 * ("2 onions", "1/2 cup flour"), not structured qty/unit/name, so merging duplicates
 * across recipes means parsing them back out. Good enough for a family grocery list, not
 * a full NLP solution: unparseable lines (e.g. "Salt to taste") just dedupe by exact text.
 */

const UNIT_ALIASES: Record<string, string> = {
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  package: "pkg",
  packages: "pkg",
  pkg: "pkg",
  pinch: "pinch",
  pinches: "pinch",
  slice: "slice",
  slices: "slice",
  stick: "stick",
  sticks: "stick",
  bunch: "bunch",
  bunches: "bunch",
};

const QUANTITY_RE = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s+/;
const UNIT_RE = /^([a-zA-Z]+)\.?\s+/;

function parseQuantityToken(token: string): number {
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(token);
}

export interface ParsedIngredient {
  quantity: number | null;
  unit: string | null;
  name: string;
}

export function parseIngredientLine(raw: string): ParsedIngredient {
  let text = raw.trim();
  let quantity: number | null = null;

  const qtyMatch = text.match(QUANTITY_RE);
  if (qtyMatch) {
    quantity = parseQuantityToken(qtyMatch[1]);
    text = text.slice(qtyMatch[0].length);
  }

  let unit: string | null = null;
  const unitMatch = text.match(UNIT_RE);
  if (unitMatch) {
    const canon = UNIT_ALIASES[unitMatch[1].toLowerCase()];
    if (canon) {
      unit = canon;
      text = text.slice(unitMatch[0].length);
    }
  }

  text = text.replace(/^of\s+/i, "").trim();
  return { quantity, unit, name: text };
}

// Only the spelled-out units get pluralized for display — abbreviations like "tbsp" or
// "oz" read fine either way, so leaving them alone avoids "3 ozs" style oddities.
const PLURAL_UNITS: Record<string, string> = {
  cup: "cups",
  clove: "cloves",
  can: "cans",
  pinch: "pinches",
  slice: "slices",
  stick: "sticks",
  bunch: "bunches",
};

function pluralizeUnit(unit: string): string {
  return PLURAL_UNITS[unit] ?? unit;
}

/** Naive singularization used only as a grouping key — "onions"/"onion" must collide. */
function singularize(name: string): string {
  const lower = name.toLowerCase();
  if (/[a-z](oes|ses|xes|ches|shes)$/.test(lower)) return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) return lower.slice(0, -1);
  return lower;
}

const NICE_FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

function formatQuantity(n: number): string {
  const whole = Math.floor(n);
  const frac = n - whole;
  for (const [value, symbol] of NICE_FRACTIONS) {
    if (Math.abs(frac - value) < 0.02) {
      return whole > 0 ? `${whole}${symbol}` : symbol;
    }
  }
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

export interface AggregatedIngredient {
  key: string;
  label: string;
}

export function aggregateIngredients(lines: string[]): AggregatedIngredient[] {
  const groups = new Map<string, { quantity: number; unit: string | null; displayName: string }>();
  const unparsed = new Map<string, string>();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const { quantity, unit, name } = parseIngredientLine(line);
    if (quantity === null || !name) {
      const dedupeKey = line.toLowerCase();
      if (!unparsed.has(dedupeKey)) unparsed.set(dedupeKey, line);
      continue;
    }

    const key = `${unit ?? ""}::${singularize(name)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += quantity;
      // Once the merged total is more than one, prefer whichever source line already
      // reads as plural, so "3 onion" doesn't show up when "onions" was right there.
      if (existing.quantity > 1 && /s$/i.test(name)) existing.displayName = name;
    } else {
      groups.set(key, { quantity, unit, displayName: name });
    }
  }

  const aggregated: AggregatedIngredient[] = [];
  for (const [key, group] of groups) {
    const qty = formatQuantity(group.quantity);
    const unit = group.unit && group.quantity > 1 ? pluralizeUnit(group.unit) : group.unit;
    const label = unit ? `${qty} ${unit} ${group.displayName}` : `${qty} ${group.displayName}`;
    aggregated.push({ key, label });
  }
  for (const [key, label] of unparsed) {
    aggregated.push({ key: `text::${key}`, label });
  }

  return aggregated.sort((a, b) => a.label.localeCompare(b.label));
}
