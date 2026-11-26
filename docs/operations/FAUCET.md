# Testnet faucet runbook

The Ciro faucet is a testnet convenience, separate from the invoice API. It
sends a fixed amount of tUSD8 and tQDAY from a dedicated treasury so a user can
try the flow without leaving the app or holding mainnet ETH.

## Treasury and amounts

- Treasury: `0x09257929772176E9c832fC8056A0d9913Ef77a13`
- Default claim: **0.2 tUSD8 + 0.01 tQDAY**
- Token: tUSD8 `0x456569838f1d43009A91ebA4263147Afd7233483`
- Network: Aevum testnet, chain 44005
- The treasury currently holds **1.0 tUSD8**, so it can serve five claims.

The endpoint is `POST /api/v1/faucet` with `{ "address": "0x…" }`.

## Limits

- **Per address:** one claim per 24 hours. This is checked against the
  treasury's tUSD8 transfer history from the Aevum explorer, so it survives
  isolate restarts. It is not only an in-memory map.
- **Global:** a two-minute throttle between treasury claims.
- **In-memory fallback:** a two-minute per-address map covers explorer outages
  and the gap before a transaction is indexed.
- **Already funded:** if the address already has the token amount and gas, the
  endpoint returns `already_funded` without sending.
- **Empty:** if the treasury lacks the token or gas, it returns `faucet_empty`
  and the UI points to the official QDay faucet as a fallback.

The on-chain/explorer history is the durable limit. A KV or D1 store would add
another dependency without improving the current testnet scale.

## Refill

Send test tUSD8 or tQDAY to the treasury address. Nothing else is required; the
endpoint reads the balances on the next request. Do not send mainnet assets.

If the treasury is empty:

1. The app shows `faucet_empty` and offers the official QDay faucet.
2. Refill the treasury from the project's test allocation.
3. Confirm the token and gas balances with the explorer.
4. Re-run a single claim from a test wallet before announcing it.

## Key handling

`CIRO_FAUCET_KEY` is a Cloudflare Pages secret for the production environment.
It is a dedicated testnet key for the faucet treasury, not the deployer key.

- It can only send fixed testnet amounts to a requested address.
- It cannot sign invoices, move user funds, or run on mainnet.
- It is never in the repository or its history.
- Rotate it by sending the remaining balance to a new treasury, updating the
  secret, and redeploying. Do not reuse the deployer key.

The invoice API remains keyless. The security review has a dated addendum for
this exception.

## Demo invoice rotation

The public “See a live invoice” link points to an open **0.2 tUSD8** invoice
(invoice 11) so it matches the faucet amount. If it is paid, it becomes a
receipt and the onboarding link loses the pay screen.

To rotate:

1. Create a new 0.2 tUSD8 invoice from the demo payee.
2. Update the two `#/pay/10` / `#/pay/11` links in `web/src/pages.js`, the README,
   and the submission copy.
3. Rebuild and deploy.
4. Check the landing “See a live invoice” link in a logged-out browser.

v1 cannot cancel the old invoice; it stays open until its due date. That is
acceptable testnet data.

## Monitoring

Watch:

- treasury tUSD8 balance,
- treasury tQDAY balance,
- `faucet_empty` rate,
- `faucet_failed` rate,
- explorer latency/errors for the claim-history check,
- claims per address/IP.

Add these to the v2 Control Room with an empty-treasury alert. For now, a manual
weekly check is enough.

## Common failures

| Symptom | Cause | Action |
|---|---|---|
| `faucet_empty` | Treasury token or gas below the claim | Refill, or use the QDay fallback |
| `faucet_rate_limited` | Global two-minute throttle | Wait and retry |
| `faucet_already_claimed` | Address claimed in the last 24h | Use the QDay fallback or wait |
| `faucet_offline` | Missing/disabled key, wrong chain, no RPC | Check the Pages secret and env |
| `faucet_failed` | RPC send/receipt failure | Check treasury gas and RPC, then retry |
| Balances stale after a claim | UI refresh race | The endpoint waits for receipts; reload if an RPC read failed |
