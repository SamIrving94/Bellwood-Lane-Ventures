// No-op stub for the `server-only` package under vitest. The real package
// throws at import time to keep server modules out of client bundles; in tests
// we just want the module to load.
export {};
