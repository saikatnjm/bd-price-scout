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
