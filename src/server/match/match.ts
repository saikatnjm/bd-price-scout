import "server-only";
import type { Offer, PackageInfo, VariantInfo } from "@/lib/types";
import { tokenize } from "../search/tokens";
import { parseSpecs, type ProductSpecs } from "../normalize/specs";

export type MatchVerdict = "match" | "no_match" | "uncertain";

/**
 * Result of comparing two normalized products. `basis` says what evidence produced a
 * match; `reasons` explains conflicts or missing evidence. Internal only: this is not a
 * user-facing confidence score.
 */
export interface MatchResult {
  verdict: MatchVerdict;
  basis?: "same_listing" | "gtin" | "model" | "attributes";
  reasons: string[];
}

const key = (value: string | undefined) => value?.toLowerCase().replace(/[^a-z0-9]/g, "") || undefined;

// Words that describe packaging, not product identity; pack facts are compared separately.
const PACKAGING_WORDS = new Set(["pack", "packs", "family", "bundle", "combo", "pcs", "piece", "pieces", "x", "sheet", "sheets", "roll", "rolls"]);
const UNIT_TOKENS = new Set(["g", "kg", "ml", "l", "gb", "tb"]);
const STOPWORDS = new Set(["a", "an", "the", "and", "of", "for", "with", "in"]);

/** Product-identity words from the name: no numbers, units or packaging words (those are compared structurally). */
function identityTokens(title: string): string[] {
  return [...new Set(tokenize(title))]
    .filter((t) => !/^\d+(\.\d+)?$/.test(t) && !UNIT_TOKENS.has(t) && !PACKAGING_WORDS.has(t) && !STOPWORDS.has(t))
    .sort();
}

const sameList = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => v === b[i]);

interface Comparison {
  conflicts: string[];
  gaps: string[];
}

function comparePack(
  a: PackageInfo | undefined,
  b: PackageInfo | undefined,
  out: Comparison,
  quantityExpected: boolean,
): void {
  const pa = a ?? { multipack: false, bundle: false };
  const pb = b ?? { multipack: false, bundle: false };
  if (pa.bundle !== pb.bundle) out.conflicts.push("bundle vs standalone");
  if (pa.total && pb.total) {
    if (pa.total.unit !== pb.total.unit || pa.total.value !== pb.total.value) {
      out.conflicts.push(`quantity differs: ${pa.total.value} ${pa.total.unit} vs ${pb.total.value} ${pb.total.unit}`);
    }
  } else if (pa.total || pb.total) {
    out.gaps.push("quantity stated for only one product");
  } else if (quantityExpected) {
    out.gaps.push("quantity not stated");
  }
  if (pa.count !== undefined && pb.count !== undefined && pa.count !== pb.count) {
    out.conflicts.push(`pack count differs: ${pa.count} vs ${pb.count}`);
  } else if ((pa.count ?? 1) > 1 !== (pb.count ?? 1) > 1 && (pa.count === undefined || pb.count === undefined)) {
    out.gaps.push("multipack stated for only one product");
  }
}

function compareVariant(a: VariantInfo | undefined, b: VariantInfo | undefined, out: Comparison): void {
  for (const field of ["flavour", "scent", "colour"] as const) {
    const va = key(a?.[field]);
    const vb = key(b?.[field]);
    if (va && vb && va !== vb) out.conflicts.push(`${field} differs`);
    else if (Boolean(va) !== Boolean(vb)) out.gaps.push(`${field} stated for only one product`);
  }
}

function compareSpecs(a: ProductSpecs, b: ProductSpecs, out: Comparison): void {
  if (a.used !== b.used) out.conflicts.push("new vs used");
  if (a.ramGb !== undefined && b.ramGb !== undefined && a.ramGb !== b.ramGb) out.conflicts.push("RAM differs");
  if (a.storageGb !== undefined && b.storageGb !== undefined && a.storageGb !== b.storageGb) out.conflicts.push("storage differs");
  if (a.capacitiesGb.length > 0 && b.capacitiesGb.length > 0 && !sameList(a.capacitiesGb, b.capacitiesGb)) {
    out.conflicts.push("memory/storage capacities differ");
  } else if (a.capacitiesGb.length > 0 !== b.capacitiesGb.length > 0) {
    out.gaps.push("capacity stated for only one product");
  }
  if (a.generation !== undefined && b.generation !== undefined && a.generation !== b.generation) {
    out.conflicts.push("generation differs");
  } else if ((a.generation === undefined) !== (b.generation === undefined)) {
    out.gaps.push("generation stated for only one product");
  }
  if (a.modelCodes.length > 0 && b.modelCodes.length > 0 && !sameList(a.modelCodes, b.modelCodes)) {
    out.conflicts.push("model codes differ");
  } else if (a.modelCodes.length > 0 !== b.modelCodes.length > 0) {
    out.gaps.push("model code stated for only one product");
  }
  if (!sameList(a.qualifiers, b.qualifiers)) out.conflicts.push("model line differs (e.g. Pro/Ultra/FE)");
}

/**
 * Decides whether two normalized products are the same purchasable product and variant.
 *
 * 1. Any reliable conflict (quantity, pack count, bundle, variant, brand, GTIN, model,
 *    RAM/storage, generation, condition, model line) -> no_match. Conflicts always win.
 * 2. A match needs strong positive evidence: the same listing in the same store, the
 *    same GTIN, the same model with the same brand, or identical brand + identity words
 *    + quantity + variant with nothing missing on either side.
 * 3. Everything else is uncertain. Titles alone never produce a match.
 */
export function matchProducts(a: Offer, b: Offer): MatchResult {
  const out: Comparison = { conflicts: [], gaps: [] };

  const gtinA = a.gtin;
  const gtinB = b.gtin;
  if (gtinA && gtinB && gtinA !== gtinB) out.conflicts.push("GTIN differs");

  const modelA = key(a.model);
  const modelB = key(b.model);
  if (modelA && modelB && modelA !== modelB) out.conflicts.push("model differs");

  const brandA = key(a.brand);
  const brandB = key(b.brand);
  if (brandA && brandB && brandA !== brandB) out.conflicts.push("brand differs");
  if (!brandA || !brandB) out.gaps.push("brand missing");

  const specsA = parseSpecs(a.title);
  const specsB = parseSpecs(b.title);
  // Device-like products (model codes or GB/TB capacities on both sides) are identified by
  // those, not by a weight/volume; for everything else a missing quantity is a gap.
  const deviceLike = (s: ProductSpecs) => s.modelCodes.length > 0 || s.capacitiesGb.length > 0;
  comparePack(a.pack, b.pack, out, !(deviceLike(specsA) && deviceLike(specsB)));
  compareVariant(a.variant, b.variant, out);
  compareSpecs(specsA, specsB, out);

  if (out.conflicts.length > 0) return { verdict: "no_match", reasons: out.conflicts };

  // Store product IDs are only meaningful inside their own store.
  if (a.storeId === b.storeId && a.storeProductId && a.storeProductId === b.storeProductId) {
    return { verdict: "match", basis: "same_listing", reasons: [] };
  }
  if (gtinA && gtinA === gtinB) return { verdict: "match", basis: "gtin", reasons: [] };
  if (modelA && modelA === modelB && brandA && brandA === brandB) return { verdict: "match", basis: "model", reasons: [] };

  const sameIdentity = sameList(identityTokens(a.title), identityTokens(b.title));
  if (!sameIdentity) out.gaps.push("product names describe different or unclear products");
  if (sameIdentity && out.gaps.length === 0) return { verdict: "match", basis: "attributes", reasons: [] };

  return { verdict: "uncertain", reasons: out.gaps };
}
