import "server-only";

/**
 * Othoba's text search (/search?) is disallowed by its robots.txt, so products are
 * discovered through server-rendered category pages instead. Each entry maps query
 * words to one verified category slug (checked 2026-10-02). Keywords are comparison
 * tokens (see tokenize); store spelling variants are listed explicitly.
 */
export interface OthobaCategory {
  slug: string;
  keywords: readonly string[];
  /**
   * Generic words that describe the whole category ("cooking oil") but rarely appear in
   * product names. They are not required in names when this category is searched.
   */
  descriptors?: readonly string[];
}

export const OTHOBA_CATEGORIES: readonly OthobaCategory[] = [
  {
    slug: "oil",
    keywords: ["oil", "soybean", "soyabean", "soyebean", "mustard", "sunflower", "olive"],
    descriptors: ["cooking", "edible"],
  },
  { slug: "rice", keywords: ["rice", "chinigura", "miniket", "nazirshail", "basmati", "polao"] },
  { slug: "flour", keywords: ["flour", "atta", "maida", "suji"] },
  { slug: "lentil", keywords: ["dal", "daal", "lentil", "lentils", "masoor", "moong", "mug"] },
  { slug: "salt-sugar", keywords: ["salt", "sugar", "molasses", "gur"] },
  { slug: "spice", keywords: ["spice", "spices", "masala", "turmeric", "chili", "chilli", "cumin", "coriander"] },
  { slug: "noodles", keywords: ["noodles", "noodle", "pasta", "ramen", "macaroni"] },
  { slug: "snacks", keywords: ["snacks", "chips", "chanachur"] },
  { slug: "biscuites-toast", keywords: ["biscuit", "biscuits", "toast", "cookies", "cracker", "crackers"] },
  { slug: "cereal", keywords: ["cereal", "oats", "cornflakes"] },
  { slug: "sauces", keywords: ["sauce", "ketchup", "mayonnaise", "vinegar"] },
  { slug: "milk", keywords: ["milk"] },
  { slug: "eggs", keywords: ["egg", "eggs"] },
  { slug: "ghee-butter", keywords: ["ghee", "butter"] },
  { slug: "tea-coffee", keywords: ["tea", "coffee"] },
  { slug: "beverages", keywords: ["juice", "drink", "drinks", "soda", "cola"] },
  {
    slug: "cleaning-supplies",
    keywords: ["cleaner", "cleaning", "detergent", "dishwash", "dishwashing", "bleach", "toilet", "floor"],
  },
  { slug: "soap", keywords: ["soap", "handwash", "bodywash"] },
  { slug: "shampoo", keywords: ["shampoo", "conditioner"] },
  { slug: "toothpaste", keywords: ["toothpaste"] },
  { slug: "napkins-tissue-papers", keywords: ["tissue", "tissues", "napkin", "napkins"] },
  { slug: "diapering-potty", keywords: ["diaper", "diapers", "wipes"] },
];

/** Spelling variants used by Othoba listings, so a query word also matches them. */
export const OTHOBA_SPELLING_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  soybean: ["soyabean", "soyebean"],
  soyabean: ["soybean", "soyebean"],
  soyebean: ["soybean", "soyabean"],
  biscuit: ["biscuite"],
  biscuits: ["biscuites"],
};

/** Categories whose keywords appear in the query, most keyword hits first. */
export function selectCategories(tokens: readonly string[], limit: number): OthobaCategory[] {
  return OTHOBA_CATEGORIES.map((category) => ({
    category,
    hits: tokens.filter((t) => category.keywords.includes(t)).length,
  }))
    .filter((c) => c.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((c) => c.category);
}
