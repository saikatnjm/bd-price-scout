import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

/** Loads a gzipped HTML fixture captured from a real store page (see tests/fixtures/README.md). */
export function loadFixture(path: string): string {
  return gunzipSync(readFileSync(new URL(`./fixtures/${path}.html.gz`, import.meta.url))).toString("utf8");
}
