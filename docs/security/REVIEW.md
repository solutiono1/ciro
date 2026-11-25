# Security review: Ciro v1

First review, 24 November 2026. Testnet only.

## Scope

- `contracts/src/Ciro.sol`: registration, invoice creation, name matching, settlement, fees, allowances.
- `contracts/script/Deploy.s.sol`: constructor arguments and deployment.
- `packages/api/src/{app,chain,approval,summary,abi}.js`: unsigned transaction construction, reads, receipts, validation.
- `web/src/{wallet,tx-guard,pages,session}.js`: the signing boundary, pay page, receipt page, and endpoint pinning.
- Tests: `contracts/test/Ciro.t.sol`, `contracts/test/CiroAudit.t.sol`, `packages/api/test`, `web/test`, `web/e2e`.

Out of scope: tUSD8 and the QDay chain, wallet extensions, Cloudflare and Railway hosting, DNS, and the browser itself.

## Deployment

- Ciro: `0x4AceB37ecAce160B4363111460020c2d088C529C` on Aevum testnet, chain 44005.
- Token: tUSD8 `0x456569838f1d43009A91ebA4263147Afd7233483`.
- Fee: 0. Constructor cap: 100 bps.
- Deploy transaction: `0x48cb3cd4640ac251430de2f71fbcf8559236ab8cd3947c37c7ac5a872d0a8b6e`.
- Source is verified on the Aevum explorer: `https://explorer-test.qday.info/address/0x4AceB37ecAce160B4363111460020c2d088C529C?tab=contract`.

## Method

1. Manual review of the contract, deploy script, API transaction builders, and web signing path.
2. Four independent review lanes: name folding and math, settlement and allowances, invoice lifecycle and availability, API and web trust.
3. Pashov Solidity Auditor checklist: access control, arithmetic, execution trace, invariants, boundaries, economic security, first principles, asymmetry, trust gaps, flow gaps.
4. Foundry tests, including new boundary, partial-cap, fee-sum, and reentrancy cases.
5. API tests and web unit tests for the transaction guard.
6. Two browser end-to-end tests: the pay flow and the public pages at desktop and mobile.

Not run: Slither, Aderyn, Echidna, Medusa, and formal verification. Those tools are not installed in this environment. The findings below come from manual review and executable tests, not from a static analyzer.

## Summary

| ID | Severity | Area | Status |
|---|---|---|---|
| C1 | Critical (client trust) | API could change the invoice id while the page showed another amount | Fixed in the web |
| H1 | High (client trust) | Wallet signed arbitrary target, calldata, and chain from the API | Fixed in the web |
| M1 | Medium | Non-ASCII bytes are deleted by the fold, so a wrong name can settle | Mitigated at the app edge, contract unchanged |
| M2 | Medium | NFC and NFD forms of the same name fold differently | Mitigated by the same non-ASCII rule |
| M3 | Medium | One receipts request rescanned the chain about 100 times | Fixed in the API |
| L1 | Low | `pay` does not use the allowance cap | Documented as a soft control |
| L2 | Low | Fee-on-transfer and no-return tokens are not handled | Accepted, tUSD8 is fixed and standard |
| L3 | Low | Re-calling `allow` resets `remaining` to the full cap | Documented and tested |
| L4 | Low | A larger standing approval was left in place | Fixed in the API |
| L5 | Low | Due and expiry are inclusive at the exact second | Documented and tested |
| L6 | Low | Invoice lists grow without bound | API returns the newest 100; contract unchanged |
| L7 | Low | No cancel or void | Documented, v2 item |
| L8 | Low | `InvoiceCreated` does not carry the name snapshot | Documented, v2 item |
| L9 | Low | Control characters could reach a terminal | Rejected at the API; symbol sanitized |
| L10 | Low | Due and expiry had no upper date bound | Rejected above year 9999 |
| I1 | Info | `chainId` is stored but not enforced at settlement | No reachable impact today |
| I2 | Info | `paidAt == 0` is the unpaid sentinel | Unreachable on Aevum's clock |
| I3 | Info | Invoice memos and names are public | Documented |
| I4 | Info | No reentrancy mutex, but state is final before transfers | Test added |
| I5 | Info | The payee can pay their own invoice | Valid, visible in the receipt |
| I6 | Info | The constructor does not check token code or decimals | Deployment assumption |
| I7 | Info | `Close` does not mean exactly one character off | UX wording, never payable |

The contract itself has no Critical or High finding. The two highest findings are in the client and API trust boundary, and both are fixed.

## Critical and High

### C1. The pay page trusted the API for the invoice it displayed

`pay(id, name)` has no amount argument. Before this review, the pay page displayed the amount and payee returned by `/v1/invoices/:id`, then signed the calldata returned by `/v1/tx/pay`. A compromised API could show a small invoice and return calldata for a larger invoice with the same locked name. The wallet cannot show the amount because the amount is not in the calldata.

Fix:
- The pay page now reads `getInvoice(id)` from the chain and uses that amount, payee, due, memo, and paid state for display.
- The name check now calls `checkInvoice(id, name)` on the chain, not the API.
- The payee address is shown on the pay page and the receipt.
- `web/src/tx-guard.js` decodes every returned step and requires the pay calldata `id` and `name` to match the page, the target to be the pinned Ciro contract, the chain to be the pinned chain, and an approval to target Ciro for exactly the invoice amount or a zero reset.
- `broadcast` verifies every step before it sends the first one.

Evidence: `web/test/tx-guard.test.js` has a case for a different id, a different name, a different target, a different chain, and an approval with the wrong amount. The pay e2e still passes.

Residual: a compromised RPC can lie about the invoice. The Ciro contract still enforces the invoice id, name, due time, paid flag, and amount, so the final transfer cannot exceed the invoice the user signed. The wallet is the last check.

### H1. The wallet signed whatever target, calldata, and chain the API returned

Before this review, `broadcast` forwarded `to`, `data`, and `chainId` without decoding them. A malicious API could return an unlimited `approve` to an attacker, or move the wallet to another chain before signing.

Fix:
- The live Aevum contract and token are pinned in `web/src/session.js`.
- `ensureMeta` rejects a production build that is not on chain 44005 and rejects an API whose contract or token does not match the pinned addresses.
- `verifyStep` decodes the calldata for every write: register, create, pay, allow, revoke, approve, and the testnet mint. It rejects an unknown selector, an unknown target, a wrong chain, a wrong invoice, a wrong name, a wrong amount, a wrong spender, a wrong cap, or a wrong expiry.
- Each call site attaches the values the user saw, so the calldata must match the form or the page.

Residual: a development build on a local chain uses the API's meta for the target. That is intentional for the local fixture; the production build is pinned.

## Medium

### M1 and M2. Non-ASCII bytes and Unicode forms

`_fold` keeps only ASCII `a-z`, `0-9`, and space. Every other byte is deleted, not replaced by a separator. Confirmed on the deployed logic:
- `"José"` folds to `"jos"`, so the wrong name `"Jos"` settles.
- `"李雷"` cannot be registered at all.
- NFC `"José"` and NFD `"Jose\u0301"` fold to different bytes, so the visible name can fail to settle.

The deployed contract is immutable. The app now rejects non-ASCII registrations at the web form and the API, and the pay page refuses an invoice whose stored name contains non-ASCII characters. A direct contract call can still create such a name; the app will not pay it.

v2 should either preserve non-ASCII bytes in the hash or reject non-ASCII on chain. Replacing punctuation and non-ASCII with a space, then collapsing spaces, is another option, but it needs its own tests.

### M3. Receipts rescanned the chain per row

`GET /v1/payers/:address/receipts` scanned all `Paid` logs once to get the ids, then called `getReceipt` for each id, and each `getReceipt` scanned all logs again. With 100 receipts that is about 101 full scans for one unauthenticated request.

Fix: `paidLogsForPayer` returns the id and the decoded log together, and `getReceipt` accepts the known log. The route now scans once and reads the invoices. The API also uses the Aevum explorer's indexed logs when `CIRO_EXPLORER_URL` is set, because the RPC caps `eth_getLogs` at 1,000 blocks; the chunked RPC scan remains the fallback. On the live deployment the payer receipts request dropped from about 16 seconds to about one second.

Residual: the public API has no rate limit. A production deployment should add one at the proxy or the server.

## Low and informational

- L1: `pay` does not touch an allowance. The cap limits `payFromAllowance`, not the spender's own wallet. The README now says this. A hard spending limit needs a smart account, not this contract.
- L2: a fee-on-transfer token would make the receipt overstate the net. A no-return token would make every payment revert. tUSD8 is fixed at deploy and returns a boolean. Accepted.
- L3: `allow` sets a new budget, so a partially spent cap returns to the full new cap. The audit test records this. The UI copy should say "set", not "extend".
- L4: a standing allowance larger than the invoice is now reset to zero and then set to the exact amount. This costs one extra approval when the old allowance was larger, and leaves no residual.
- L5: payment at exactly `due` or exactly `expiry` succeeds; one second later it reverts. The API uses the same `>` comparison. Tests cover both sides.
- L6: `invoicesOf` returns the whole array. The API now returns the newest 100 and marks the result truncated. The contract still grows the array.
- L7: there is no cancel. A mistyped invoice stays payable until its due time. Use a short due date. A v2 cancel must be payee-only and must not break the paid flag.
- L8: `InvoiceCreated` does not include the name snapshot. `getInvoice` does, so the current API is correct, but a log-only indexer would need the snapshot. Add it in v2.
- L9: names and memos are now checked for control characters. The token symbol is stripped. The web escapes every string. The CLI still prints text, so a direct on-chain name can contain control characters; treat CLI output as untrusted.
- L10: the API rejects a due or expiry after `9999-12-31T23:59:59Z`, so a JavaScript date cannot throw a 502.
- I1: `chainId` is stored but not read by `pay`. An invoice exists only on one chain, so there is no cross-chain replay today.
- I2: a payment at block timestamp 0 would write `paidAt = 0` and look unpaid. Aevum's clock is far above zero; a v2 should use a separate paid flag or a sentinel that cannot collide.
- I3: invoice memos and payee names are public. The UI should say so on the create form.
- I4: `_settle` writes `payer`, `paidAt`, and the allowance before the two transfers. The reentrancy test in `CiroAudit.t.sol` proves a token callback cannot pay the same invoice twice. A future edit must keep that order.
- I5: a payee can pay their own invoice. The receipt shows the same address on both sides. The demo uses this so one testnet key can show both roles; a two-wallet demo is stronger.
- I6: the constructor does not check that the token has code, and the API assumes 6 decimals. Both are deployment-time assumptions for tUSD8.
- I7: `Close` is a UX classification, not a payment path. Two substitutions can be `Close`; one changed initial or a removed space can be `None`. `pay` requires `Exact`.

## What changed

- `contracts/test/CiroAudit.t.sol`: nine tests for due and expiry boundaries, partial caps, re-allow semantics, fee sums, zero caps, past expiry, and reentrancy.
- `packages/api/src/app.js`: newest 100 invoices, one log scan for payer receipts, net amount in receipts, date and id bounds, control-character rejection, non-ASCII names rejected, allowance cap and expiry validation.
- `packages/api/src/chain.js`: `paidLogsForPayer`, sanitized token symbol.
- `packages/api/src/approval.js`: reset a larger standing allowance to the exact amount.
- `web/src/tx-guard.js`: calldata and target verification for every write.
- `web/src/session.js`: pinned Aevum contract and token.
- `web/src/wallet.js`: on-chain invoice and name reads, chain time, verified broadcast.
- `web/src/pages.js`: pay page reads the chain, shows the payee address, blocks non-ASCII invoices, receipt page verifies the `Paid` log, non-ASCII registration guard, revoke summary, endpoint warning.
- `web/test/tx-guard.test.js`: ten tests for the signing boundary.
- `README.md`: verified source link, architecture diagram, configuration table, known limits, roadmap.

## Reproduction

```bash
cd contracts && forge test
cd ..
npm test
npm run e2e -w @getciro/web
```

Result on 24 November 2026: 20 Foundry tests, 3 API tests, 10 web unit tests, and 2 browser tests pass. The deployed contract source is verified, and the app was exercised against the deployed Aevum API.

## Residual risk

- The deployed contract cannot be changed. Non-ASCII folding, the missing cancel, the unbounded invoice array, the event gap, and the timestamp-zero sentinel remain on chain until a v2 deployment.
- The web pins the live deployment and verifies every calldata, but a compromised RPC can still lie about chain state. The contract and the wallet are the final enforcement.
- The public API has no rate limit. Receipts are now one scan per request, but a determined caller can still consume RPC quota.
- No static analyzer or formal verification was run.

## Post-review change: testnet faucet (26 November 2026)

A separate `/v1/faucet` endpoint was added after this review. It is outside the
invoice contract and the invoice signing path. It holds a dedicated
testnet-only treasury key in a Cloudflare secret and sends fixed tUSD8/tQDAY
amounts with a cooldown. It was not covered by this review. It must be included
in the v2 API and operations review. The invoice API remains keyless.

## v2 recommendations

1. Preserve non-ASCII bytes in the name hash or reject non-ASCII on chain.
2. Add a payee-only cancel before the due time.
3. Emit the name snapshot in `InvoiceCreated`, or add an indexer that reads `getInvoice`.
4. Replace the `paidAt == 0` sentinel with a separate paid flag.
5. Bound name and memo length on chain.
6. Add an indexer and pagination so invoice lists do not grow without bound.
7. Add rate limits and a response cache at the API edge.
8. Run Slither, Aderyn, and a stateful invariant campaign before mainnet.
