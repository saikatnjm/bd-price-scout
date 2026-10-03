"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { searchProducts, SearchRequestError } from "@/lib/api-client";
import { QUERY_MAX_LENGTH, QUERY_MIN_LENGTH, type SearchResponse } from "@/lib/types";
import { SearchResults } from "./SearchResults";

type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "done"; data: SearchResponse }
  | { status: "error"; message: string };

export function SearchApp() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  async function runSearch(rawQuery: string) {
    const trimmed = rawQuery.replace(/\s+/g, " ").trim();
    if (trimmed.length < QUERY_MIN_LENGTH) {
      setState({ status: "error", message: `Search must be at least ${QUERY_MIN_LENGTH} characters.` });
      return;
    }

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ status: "loading", query: trimmed });

    try {
      const data = await searchProducts(trimmed, controller.signal);
      if (!controller.signal.aborted) setState({ status: "done", data });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState({
        status: "error",
        message: err instanceof SearchRequestError ? err.message : "Something went wrong. Please try again.",
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  const loading = state.status === "loading";

  return (
    <div className="mt-8">
      <form onSubmit={onSubmit} role="search" className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="search-query" className="sr-only">
          Product name
        </label>
        <input
          id="search-query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. soybean oil 5 ltr"
          maxLength={QUERY_MAX_LENGTH}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-700 px-5 py-3 font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Searching…" : "Find Best Price"}
        </button>
      </form>

      <section aria-live="polite" aria-busy={loading} className="mt-8">
        {state.status === "idle" && (
          <p className="text-sm text-slate-500">Enter a product name to compare prices.</p>
        )}

        {state.status === "loading" && (
          <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-700" />
            Searching stores for “{state.query}”…
          </div>
        )}

        {state.status === "error" && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p>{state.message}</p>
            {query.trim().length >= QUERY_MIN_LENGTH && (
              <button type="button" onClick={() => void runSearch(query)} className="mt-2 font-medium underline">
                Try again
              </button>
            )}
          </div>
        )}

        {state.status === "done" && <SearchResults data={state.data} />}
      </section>
    </div>
  );
}
