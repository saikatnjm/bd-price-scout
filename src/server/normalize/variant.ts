import "server-only";
import type { VariantInfo } from "@/lib/types";

// Only explicit wording is used: "<word> Flavor", "Flavour: X", "<word> Scent", "Colour: X".
// Just the single word before "Flavor"/"Scent" is taken: with two words it is impossible to
// tell "Magic Masala" from "Soap Rose" without guessing. The full name is always kept anyway.
// Implicit variants (e.g. "(Litchi)") are not guessed.
const WORDS = String.raw`([A-Za-z][A-Za-z&'-]*)`;
const FLAVOUR = [new RegExp(String.raw`\b${WORDS}\s+flavou?r(?:ed)?\b`, "i"), /\bflavou?r\s*[:-]\s*([A-Za-z][A-Za-z &'-]{0,30}?)(?=\s*(?:[,()|]|$))/i];
const SCENT = [new RegExp(String.raw`\b${WORDS}\s+(?:scent|fragrance)\b`, "i"), /\b(?:scent|fragrance)\s*[:-]\s*([A-Za-z][A-Za-z &'-]{0,30}?)(?=\s*(?:[,()|]|$))/i];
const COLOUR = [/\bcolou?r\s*[:-]\s*([A-Za-z][A-Za-z &'-]{0,30}?)(?=\s*(?:[,()|]|$))/i];

function first(patterns: RegExp[], text: string): string | undefined {
  for (const p of patterns) {
    const value = text.match(p)?.[1]?.replace(/\s+/g, " ").trim();
    if (value) return value;
  }
  return undefined;
}

export function parseVariant(name: string): VariantInfo | undefined {
  const variant: VariantInfo = {};
  const flavour = first(FLAVOUR, name);
  const scent = first(SCENT, name);
  const colour = first(COLOUR, name);
  if (flavour) variant.flavour = flavour;
  if (scent) variant.scent = scent;
  if (colour) variant.colour = colour;
  return Object.keys(variant).length > 0 ? variant : undefined;
}
