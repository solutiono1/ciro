# Status

Updated: 2026-11-23.

| Layer | State | Evidence |
|---|---|---|
| Product docs | Written | This tree |
| Contract | Implemented | `cd contracts && forge test` on 2026-11-21: 11 passed, 0 failed. Solc 0.8.28, EVM Shanghai. The 2026-11-22 web pass did not touch the contract |
| API | Implemented | `npm test -w @ciro/api` on 2026-11-22 passed. Unsigned reads and writes against a local Anvil chain. No signing key in the server |
| CLI | Implemented | `npm test -w @ciro/cli` on 2026-11-22 passed. Register, invoice, check, pay, and receipt. A close name does not sign. A key file that is not mode 0600 is refused and the key is not printed |
| MCP | Implemented | `npm test -w @ciro/mcp` on 2026-11-22 passed. Check, prepare pay, and receipt. A close name returns no transaction. A planted key in the environment and in the tool arguments is not echoed |
| Web app | Implemented | `npm run build -w @ciro/web` passed on 2026-11-23. `npm run e2e -w @ciro/web` passed on 2026-11-23: 2 tests (`e2e/pay.test.js`, `e2e/public.test.js`). Public pages: landing with the asymmetric hero and a live name-check card (exact shows pay, close and none do not), the drawn dashboard preview, three steps, why-split, FAQ, docs teaser, invoice lookup; `#/docs` page; footer. Faucet: `POST /v1/tx/faucet`, 1,000 tUSD8. Add network: `wallet_addEthereumChain` from `session.meta` params. The chain id is checked in `broadcast` and the wallet is switched before signing |
| Public pages | Implemented | Landing, docs, pay, receipt. The app preview in `.stage` is a drawn dashboard; the previous recording showed the landing page itself and was removed until a real dashboard pass exists |
| Aevum deploy | Not done | No owner key in this environment. Do not invent one |

`npm test` at the repo root runs the shared, API, CLI, and MCP tests in that order. It passed on 2026-11-23 with `forge test` (11 passed) already green. Re-run it before calling a later edit done.

CLI `allow` and `revoke` use the same local signer as `register`. Their calldata is executed in the API test (set, revoke, pay within cap, cap exceeded). They were not given a separate CLI process test.

A row may say implemented only after a named command has passed.
