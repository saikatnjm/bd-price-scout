import "server-only";

/**
 * Identity attributes read from a product name for conflict detection in matching:
 * memory/storage, generation, condition and model codes. Only explicit text is used;
 * absent means "not stated", never "same".
 */
export interface ProductSpecs {
  /** RAM in GB, only when explicitly labelled (e.g. "8GB RAM", "8GB/128GB"). */
  ramGb?: number;
  /** Storage in GB, only when explicitly labelled (e.g. "256GB ROM", "8GB/128GB", "1TB SSD"). */
  storageGb?: number;
  /** Every GB/TB capacity mentioned, in GB, sorted. */
  capacitiesGb: number[];
  generation?: number;
  /** Set only when the name says the item is used/refurbished. */
  used: boolean;
  /** Letter+digit codes such as "s25", "pb572", "hsu-19" (units and pack notations excluded). */
  modelCodes: string[];
  /** Model-line qualifiers that distinguish products ("ultra", "pro", "fe", ...). */
  qualifiers: string[];
}

const toGb = (value: string, unit: string) => Number(value) * (unit.toLowerCase() === "tb" ? 1024 : 1);

const RAM_STORAGE_PAIR = /(?<![\w.])(\d+(?:\.\d+)?)\s*gb\s*(?:ram\s*)?[/+|]\s*(\d+(?:\.\d+)?)\s*(gb|tb)\b/i;
const RAM = /(?<![\w.])(\d+(?:\.\d+)?)\s*gb\s*(?:ram|lpddr\d*x?|ddr\d*)\b/i;
const STORAGE = /(?<![\w.])(\d+(?:\.\d+)?)\s*(gb|tb)\s*(?:rom|storage|ssd|hdd|emmc|ufs|internal)\b/i;
const CAPACITY = /(?<![\w.])(\d+(?:\.\d+)?)\s*(gb|tb)\b/gi;
const GENERATION = [/(?<![\w.])(\d+)(?:st|nd|rd|th)\s*gen(?:eration)?\b/i, /\bgen(?:eration)?\s*[-:]?\s*(\d+)\b/i];
const USED = /\b(used|refurbished|pre-?owned|renewed|second[\s-]?hand|open[\s-]?box)\b/i;
const QUALIFIERS = new Set(["ultra", "plus", "pro", "max", "mini", "lite", "fe", "edge", "neo", "prime", "air", "slim"]);

// Tokens that mix letters and digits but are units or pack notations, not model codes.
const NOT_A_MODEL = [
  /^\d+(\.\d+)?(g|gm|gms|gr|kg|kgs|ml|l|lt|ltr|ltrs|litre|liter|pcs|pc|sheets?|gb|tb|mb|mah|w|v|hz|mm|cm|m|inch|in|x|p|k)$/,
  /^\d+x\d+(\.\d+)?[a-z]*$/, // 10x15g
  /^x\d+$/, /^\d+x$/, // x12, 12x
  /^\d+in\d+$/, // 3in1
  /^b\d+g\d+$/, // b1g1
  /^\d+(st|nd|rd|th)$/, // 2nd
  /^\d+[gk]$/, // 4g, 5g network / 4k
];

export function parseSpecs(name: string): ProductSpecs {
  const text = name.normalize("NFKC");
  const pair = text.match(RAM_STORAGE_PAIR);
  const ram = pair ? Number(pair[1]) : Number(text.match(RAM)?.[1] ?? NaN);
  const storageMatch = text.match(STORAGE);
  const storage = pair ? toGb(pair[2] ?? "", pair[3] ?? "") : storageMatch ? toGb(storageMatch[1] ?? "", storageMatch[2] ?? "") : NaN;
  const capacities = [...new Set([...text.matchAll(CAPACITY)].map((m) => toGb(m[1] ?? "", m[2] ?? "")))].sort((a, b) => a - b);

  let generation: number | undefined;
  for (const pattern of GENERATION) {
    const g = Number(text.match(pattern)?.[1]);
    if (Number.isInteger(g) && g > 0) {
      generation = g;
      break;
    }
  }

  const words = text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
  const modelCodes = [...new Set(words.filter((w) => /[a-z]/.test(w) && /\d/.test(w) && !NOT_A_MODEL.some((p) => p.test(w))))].sort();
  const qualifiers = [...new Set(words.filter((w) => QUALIFIERS.has(w)))].sort();

  const specs: ProductSpecs = { capacitiesGb: capacities, used: USED.test(text), modelCodes, qualifiers };
  if (Number.isFinite(ram) && ram > 0) specs.ramGb = ram;
  if (Number.isFinite(storage) && storage > 0) specs.storageGb = storage;
  if (generation !== undefined) specs.generation = generation;
  return specs;
}
