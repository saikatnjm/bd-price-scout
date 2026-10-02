import "server-only";
import { othobaAdapter } from "./othoba/adapter";
import type { StoreAdapter } from "./types";

// Store adapters are registered here as they are implemented and verified.
export const storeAdapters: readonly StoreAdapter[] = [othobaAdapter];
