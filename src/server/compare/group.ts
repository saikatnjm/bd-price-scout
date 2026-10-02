import "server-only";
import { buildGroup } from "@/lib/groups";
import type { ComparisonGroup, MatchBasis, Offer } from "@/lib/types";
import { matchProducts } from "../match/match";

// Weaker evidence wins when describing a whole group.
const BASIS_STRENGTH: Record<MatchBasis, number> = { same_listing: 3, gtin: 2, model: 1, attributes: 0 };

interface Cluster {
  offers: Offer[];
  basis?: MatchBasis;
}

/**
 * Groups offers using only the Phase 7 matching engine. An offer joins a cluster only if
 * it is a confirmed "match" with every offer already in it, so A~B and B~C never chain
 * into A~C. "no_match" and "uncertain" offers stay in separate groups. Order of first
 * appearance is preserved; nothing is ranked by price.
 */
export function groupOffers(offers: readonly Offer[]): ComparisonGroup[] {
  const clusters: Cluster[] = [];
  for (const offer of offers) {
    let joined = false;
    for (const cluster of clusters) {
      const results = cluster.offers.map((member) => matchProducts(member, offer));
      if (results.every((r) => r.verdict === "match")) {
        for (const r of results) {
          if (r.basis && (!cluster.basis || BASIS_STRENGTH[r.basis] < BASIS_STRENGTH[cluster.basis])) cluster.basis = r.basis;
        }
        cluster.offers.push(offer);
        joined = true;
        break;
      }
    }
    if (!joined) clusters.push({ offers: [offer] });
  }
  return clusters.map((c) => buildGroup(c.offers, c.basis));
}
