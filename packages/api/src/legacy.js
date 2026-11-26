// Registrations from the build-period recordings and early test runs. They are
// still on chain and still count as taken, but the public directory hides them
// so test data does not read as real users. The chain remains the source of
// truth; this list only controls what the app displays.
//
// Keep this list small and documented in docs/operations/TEST-DATA.md.
export const LEGACY_TEST_ADDRESSES = new Set([
  "0x405dfe6f2c29e794b2799946ffcbef4da7d3ec70",
  "0x42365e1f1f2dd8815cc7b324f7d2b0ed011c3292",
  "0x92cf6f88d9846c9aecae818cd811ca45b9ae90c7",
  "0x0b43c122422305febdc59936c58c14c46625b97a",
  "0x8ee4ece52e9286958ff16c26035cc73030f557b7",
  "0xdacf93b7f0c9fa3af61cd27c1fe382f29ba4b724",
]);

export function isLegacyTestAddress(address) {
  return LEGACY_TEST_ADDRESSES.has(String(address || "").toLowerCase());
}
