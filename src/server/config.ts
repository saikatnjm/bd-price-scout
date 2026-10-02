import "server-only";

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

export interface SearchConfig {
  storeTimeoutMs: number;
  budgetMs: number;
}

export function getSearchConfig(): SearchConfig {
  return {
    storeTimeoutMs: intFromEnv("STORE_TIMEOUT_MS", 8000, 1000, 20000),
    budgetMs: intFromEnv("SEARCH_BUDGET_MS", 15000, 2000, 25000),
  };
}
