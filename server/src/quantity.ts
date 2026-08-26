/**
 * Lightweight cooking-quantity parsing/combining, used by the Grocery List store to
 * merge an incoming parsed ingredient into an existing unchecked item (e.g. "1/4 cup"
 * cherry tomatoes from one recipe + "1/2 cup" from another -> "3/4 cup"). Deliberately
 * narrow: common US-customary volume/weight units plus bare counts. Anything it can't
 * parse or reconcile returns null so the caller keeps items separate rather than
 * guessing.
 */

export type UnitFamily = "volume" | "weight" | "count";

export interface ParsedQuantity {
  amount: number;
  /** Canonical unit key: "cup", "tbsp", "oz", ... for volume/weight; the singularized
   * unit word ("clove", "can", ...) or "" (bare count) for the count family. */
  unitKey: string;
  family: UnitFamily;
}

interface UnitDef {
  family: "volume" | "weight";
  toBase: number; // volume -> ml, weight -> g
  plural: string;
}

const VOLUME_UNITS: Record<string, UnitDef> = {
  tsp: { family: "volume", toBase: 4.92892, plural: "tsp" },
  teaspoon: { family: "volume", toBase: 4.92892, plural: "teaspoons" },
  tbsp: { family: "volume", toBase: 14.7868, plural: "tbsp" },
  tablespoon: { family: "volume", toBase: 14.7868, plural: "tablespoons" },
  cup: { family: "volume", toBase: 236.588, plural: "cups" },
  pt: { family: "volume", toBase: 473.176, plural: "pt" },
  pint: { family: "volume", toBase: 473.176, plural: "pints" },
  qt: { family: "volume", toBase: 946.353, plural: "qt" },
  quart: { family: "volume", toBase: 946.353, plural: "quarts" },
  gal: { family: "volume", toBase: 3785.41, plural: "gal" },
  gallon: { family: "volume", toBase: 3785.41, plural: "gallons" },
  ml: { family: "volume", toBase: 1, plural: "ml" },
  milliliter: { family: "volume", toBase: 1, plural: "milliliters" },
  l: { family: "volume", toBase: 1000, plural: "l" },
  liter: { family: "volume", toBase: 1000, plural: "liters" },
  litre: { family: "volume", toBase: 1000, plural: "litres" },
};

const WEIGHT_UNITS: Record<string, UnitDef> = {
  oz: { family: "weight", toBase: 28.3495, plural: "oz" },
  ounce: { family: "weight", toBase: 28.3495, plural: "ounces" },
  lb: { family: "weight", toBase: 453.592, plural: "lbs" },
  pound: { family: "weight", toBase: 453.592, plural: "pounds" },
  g: { family: "weight", toBase: 1, plural: "g" },
  gram: { family: "weight", toBase: 1, plural: "grams" },
  kg: { family: "weight", toBase: 1000, plural: "kg" },
  kilogram: { family: "weight", toBase: 1000, plural: "kilograms" },
};

// Aliases fold onto a canonical key in the tables above (e.g. "tablespoons" -> "tablespoon").
const UNIT_ALIASES: Record<string, string> = {
  tsps: "tsp",
  teaspoons: "teaspoon",
  tbsps: "tbsp",
  tablespoons: "tablespoon",
  cups: "cup",
  pints: "pint",
  quarts: "quart",
  gallons: "gallon",
  milliliters: "milliliter",
  millilitres: "milliliter",
  liters: "liter",
  litres: "litre",
  ounces: "ounce",
  lbs: "lb",
  pounds: "pound",
  grams: "gram",
  kilograms: "kilogram",
};

const FRACTION_CHARS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const NUMBER_TOKEN = /^(\d+\/\d+|\d+(\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])$/;

function tokenValue(token: string): number | null {
  if (token in FRACTION_CHARS) return FRACTION_CHARS[token];
  if (token.includes("/")) {
    const [num, den] = token.split("/").map(Number);
    if (!den) return null;
    return num / den;
  }
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}

function normalizeUnitWord(word: string): string {
  const cleaned = word.toLowerCase().replace(/\.$/, "");
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

function singularizeCountWord(word: string): string {
  const cleaned = word.toLowerCase().replace(/\.$/, "");
  if (cleaned.endsWith("es") && cleaned.length > 3) return cleaned.slice(0, -2);
  if (cleaned.endsWith("s") && !cleaned.endsWith("ss")) return cleaned.slice(0, -1);
  return cleaned;
}

/** Parses a quantity string ("1/4 cup", "2 tbsp", "3 cloves", "2") into a structured
 * amount + unit family. Returns null for anything ambiguous (ranges like "2-3", empty
 * strings, or text with no leading number). */
export function parseQuantity(raw: string): ParsedQuantity | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (/\d-\d/.test(text)) return null; // ranges are ambiguous to merge, skip

  const words = text.split(" ");
  let i = 0;
  let amount = 0;
  let matchedAny = false;
  while (i < words.length && NUMBER_TOKEN.test(words[i])) {
    const value = tokenValue(words[i]);
    if (value === null) return null;
    amount += value;
    matchedAny = true;
    i++;
  }
  if (!matchedAny) return null;

  const rest = words.slice(i).join(" ").trim();
  if (!rest) return { amount, unitKey: "", family: "count" };

  const unitWord = rest.split(" ")[0];
  const normalized = normalizeUnitWord(unitWord);
  if (normalized in VOLUME_UNITS) return { amount, unitKey: normalized, family: "volume" };
  if (normalized in WEIGHT_UNITS) return { amount, unitKey: normalized, family: "weight" };

  // Not a recognized volume/weight unit -> treat the whole trailing word as a count
  // unit ("clove", "can", "package", ...), only if it's the sole trailing word;
  // anything with extra descriptive words ("large eggs") is too ambiguous to key on.
  if (words.slice(i).length === 1) {
    return { amount, unitKey: singularizeCountWord(unitWord), family: "count" };
  }
  return null;
}

function unitDef(unitKey: string, family: "volume" | "weight"): UnitDef {
  const table = family === "volume" ? VOLUME_UNITS : WEIGHT_UNITS;
  return table[unitKey];
}

/** Combines two parsed quantities if their families/units are compatible, converting
 * to whichever of the two units is coarser (e.g. tbsp + cup -> cup). Returns null when
 * they can't be reconciled (different families, or mismatched count unit words) so the
 * caller can fall back to keeping the items separate. */
export function combineQuantities(a: ParsedQuantity, b: ParsedQuantity): ParsedQuantity | null {
  if (a.family !== b.family) return null;

  if (a.family === "count") {
    if (a.unitKey !== b.unitKey) return null;
    return { amount: a.amount + b.amount, unitKey: a.unitKey, family: "count" };
  }

  // b.family === a.family is guaranteed by the check above, but TS only narrows `a`
  // from the `a.family === "count"` check, not `b` — reuse `family` for both lookups.
  const family = a.family;
  const defA = unitDef(a.unitKey, family);
  const defB = unitDef(b.unitKey, family);
  if (!defA || !defB) return null;

  const totalBase = a.amount * defA.toBase + b.amount * defB.toBase;
  const displayKey = defA.toBase >= defB.toBase ? a.unitKey : b.unitKey;
  const displayDef = unitDef(displayKey, family);
  return { amount: totalBase / displayDef.toBase, unitKey: displayKey, family };
}

const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [3 / 8, "3/8"],
  [1 / 2, "1/2"],
  [5 / 8, "5/8"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [7 / 8, "7/8"],
];

function formatAmount(amount: number): string {
  const whole = Math.floor(amount);
  const frac = amount - whole;
  const nice = NICE_FRACTIONS.find(([value]) => Math.abs(value - frac) < 0.02);
  if (nice) {
    return whole > 0 ? `${whole} ${nice[1]}` : nice[1];
  }
  if (Math.abs(frac) < 0.02) return String(whole);
  return String(Math.round(amount * 100) / 100);
}

/** Formats a parsed quantity back into a display string ("3/4 cup", "5 cloves", "2"). */
export function formatQuantity(q: ParsedQuantity): string {
  const amountText = formatAmount(q.amount);
  if (q.family === "count") {
    if (!q.unitKey) return amountText;
    const isPlural = Math.abs(q.amount - 1) > 0.001;
    return `${amountText} ${isPlural ? `${q.unitKey}s` : q.unitKey}`;
  }
  const def = unitDef(q.unitKey, q.family);
  const isPlural = Math.abs(q.amount - 1) > 0.001;
  const label = isPlural ? def.plural : q.unitKey;
  return `${amountText} ${label}`;
}
