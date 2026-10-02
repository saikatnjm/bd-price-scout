import type { PackageInfo } from "./types";

const bdtFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** Formats a BDT amount with Bangladeshi (lakh) digit grouping, e.g. ৳1,25,000. */
export function formatBdt(amount: number): string {
  return `৳${bdtFormatter.format(amount)}`;
}

/** Only http(s) URLs may be rendered as links; scraped data must never yield javascript: etc. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const UNIT_LABEL: Record<string, string> = { g: "g", kg: "kg", ml: "ml", l: "L", sheet: "sheets" };

/** Short package summary, e.g. "5 L", "12 × 62 g", "4 × 5 L · Bundle"; undefined if nothing is known. */
export function formatPack(pack: PackageInfo | undefined): string | undefined {
  if (!pack) return undefined;
  const size = pack.size ? `${pack.size.value} ${UNIT_LABEL[pack.size.unit]}` : undefined;
  const count = pack.count !== undefined && pack.count > 1 ? pack.count : undefined;
  const parts = [size && count ? `${count} × ${size}` : (size ?? (count ? `${count} pcs` : undefined)), pack.bundle ? "Bundle" : undefined];
  const text = parts.filter(Boolean).join(" · ");
  return text === "" ? undefined : text;
}
