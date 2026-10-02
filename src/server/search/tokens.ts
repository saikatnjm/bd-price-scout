import "server-only";

// Spelling variants of the same unit, so "5 ltr" and "5L" filter the same way.
// Only spelling is unified; different units (g vs kg, ml vs l) stay different.
const UNIT_ALIASES: Record<string, string> = {
  l: "l", lt: "l", ltr: "l", ltrs: "l", liter: "l", litre: "l", liters: "l", litres: "l",
  ml: "ml",
  kg: "kg", kgs: "kg",
  g: "g", gm: "g", gms: "g", gr: "g", gram: "g", grams: "g",
  pc: "pcs", pcs: "pcs", piece: "pcs", pieces: "pcs",
};

const STOPWORDS = new Set(["a", "an", "the", "and", "of", "for", "with", "in", "bd", "price"]);

/**
 * Splits text into lowercase comparison tokens: punctuation removed, numbers split from
 * units ("5ltr" -> "5", "l"), unit spellings unified. Used only to filter candidates by
 * query words; it is not product normalization or matching.
 */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/[^a-z0-9.]+/g, " ")
    .split(" ")
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean)
    .map((t) => UNIT_ALIASES[t] ?? t);
}

export function queryTokens(query: string): string[] {
  return [...new Set(tokenize(query).filter((t) => !STOPWORDS.has(t)))];
}
