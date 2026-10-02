import "server-only";
import type { PackageInfo, SizeUnit } from "@/lib/types";

const UNIT_ALIASES: Record<string, SizeUnit> = {
  g: "g", gm: "g", gms: "g", gr: "g", gram: "g", grams: "g",
  kg: "kg", kgs: "kg",
  ml: "ml",
  l: "l", lt: "l", ltr: "l", ltrs: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  sheet: "sheet", sheets: "sheet",
};

const NUM = String.raw`(\d+(?:\.\d+)?)`;
// Weight tolerance as written by BD stores, e.g. "180(±)10ml" means 180 ml.
const TOLERANCE = String.raw`(?:\s*\(\s*[±+\-/]+\s*\)\s*\d+(?:\.\d+)?)?`;
const UNIT = String.raw`(kgs?|gms?|grams?|gr|g|ml|ltrs?|lt|litres?|liters?|l|sheets?)`;
const END = String.raw`(?![a-z])`;
const COUNT_WORD = String.raw`(?:pcs|pc|pieces?|packs?|sachets?|rolls?|tablets?)`;

// "10 x 15g" (count first) and "62gm x 12pcs" (size first).
const COUNT_X_SIZE = new RegExp(String.raw`(?<![\w.])(\d+)\s*[x×]\s*${NUM}${TOLERANCE}\s*${UNIT}${END}`, "gi");
const SIZE_X_COUNT = new RegExp(String.raw`(?<![\w.])${NUM}${TOLERANCE}\s*${UNIT}\s*[x×]\s*(\d+)(?:\s*${COUNT_WORD})?${END}`, "gi");
const SIZE = new RegExp(String.raw`(?<![\w.])${NUM}${TOLERANCE}\s*${UNIT}${END}`, "gi");
const COUNT_PATTERNS = [
  new RegExp(String.raw`(?<![\w.])(\d+)\s*${COUNT_WORD}${END}`, "gi"),
  /\bpack\s+of\s+(\d+)\b/gi,
  /(?<![\w.])(\d+)\s*-\s*pack\b/gi,
];
const BUNDLE = /\b(bundle|combo)\b|buy\s*1\s*get\s*1|\bb1g1\b|\bbogo(f)?\b/i;

interface Size {
  value: number;
  unit: SizeUnit;
}

function toBase(size: Size): { value: number; unit: "g" | "ml" | "sheet" } {
  if (size.unit === "kg") return { value: round(size.value * 1000), unit: "g" };
  if (size.unit === "l") return { value: round(size.value * 1000), unit: "ml" };
  return { value: size.value, unit: size.unit };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function sameBase(a: Size, b: Size): boolean {
  const x = toBase(a);
  const y = toBase(b);
  return x.unit === y.unit && x.value === y.value;
}

function parseSize(value: string, unit: string): Size | null {
  const n = Number(value);
  const u = UNIT_ALIASES[unit.toLowerCase()];
  return Number.isFinite(n) && n > 0 && u ? { value: n, unit: u } : null;
}

/** Removes matched text so later patterns do not count it twice. */
function blank(text: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0;
  return text.slice(0, start) + " ".repeat(match[0].length) + text.slice(start + match[0].length);
}

/**
 * Parses size, item count and bundle wording from a product name.
 * Conservative: if the name states conflicting sizes or counts, those fields are left
 * absent rather than picking one.
 */
export function parsePackage(name: string): PackageInfo {
  let rest = name;
  const sizes: Size[] = [];
  const counts: number[] = [];
  let perItem: Size | undefined;

  for (const m of [...rest.matchAll(COUNT_X_SIZE)]) {
    const size = parseSize(m[2] ?? "", m[3] ?? "");
    const count = Number(m[1]);
    if (size && count > 0) {
      perItem ??= size;
      sizes.push(size);
      counts.push(count);
      rest = blank(rest, m);
    }
  }
  for (const m of [...rest.matchAll(SIZE_X_COUNT)]) {
    const size = parseSize(m[1] ?? "", m[2] ?? "");
    const count = Number(m[3]);
    if (size && count > 0) {
      perItem ??= size;
      sizes.push(size);
      counts.push(count);
      rest = blank(rest, m);
    }
  }

  const looseSizes: Size[] = [];
  for (const m of [...rest.matchAll(SIZE)]) {
    const size = parseSize(m[1] ?? "", m[2] ?? "");
    if (size) {
      looseSizes.push(size);
      rest = blank(rest, m);
    }
  }
  for (const pattern of COUNT_PATTERNS) {
    for (const m of [...rest.matchAll(pattern)]) {
      const count = Number(m[1]);
      if (count > 0) counts.push(count);
    }
  }

  const count = counts.length > 0 && counts.every((c) => c === counts[0]) ? counts[0] : undefined;

  let size: Size | undefined;
  if (perItem) {
    // A loose size is allowed only if it equals the per-item size or the pack total
    // ("10X15g 150g"); anything else is a contradiction.
    const total = count ? { value: perItem.value * count, unit: perItem.unit } : undefined;
    const consistent = looseSizes.every((s) => sameBase(s, perItem) || (total !== undefined && sameBase(s, total)));
    const allItemSizesAgree = sizes.every((s) => sameBase(s, perItem));
    size = consistent && allItemSizesAgree ? perItem : undefined;
  } else if (looseSizes.length > 0 && looseSizes.every((s) => sameBase(s, looseSizes[0]!))) {
    size = looseSizes[0];
  }

  const info: PackageInfo = { multipack: count !== undefined && count > 1, bundle: BUNDLE.test(name) };
  if (size) info.size = size;
  if (count !== undefined) info.count = count;
  if (size) {
    const base = toBase(size);
    info.total = { value: round(base.value * (count ?? 1)), unit: base.unit };
  } else if (count !== undefined && looseSizes.length === 0 && sizes.length === 0) {
    info.total = { value: count, unit: "piece" };
  }
  return info;
}
