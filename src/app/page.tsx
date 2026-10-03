import { SearchApp } from "@/components/SearchApp";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">BD Price Scout</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Compare prices for the same product across Bangladesh online stores. Currently searches Othoba (grocery and household).
      </p>
      <SearchApp />
    </main>
  );
}
