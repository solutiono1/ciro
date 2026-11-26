# v1 test data

Ciro v1 is immutable and has no cancel or void. Test invoices created during
development stay on Aevum until they are paid or reach their due date. This page
records the ones that are still open, so nobody mistakes them for a live demo or
sends funds to the wrong one.

The chain is the record. Nothing here can delete an invoice from the v1
contract.

## Open invoices

| Invoice | Payee | Amount | Reference | Due (UTC) | Role |
|---|---|---|---|---|---|
| 6 | `0xDaCf93b7F0c9fA3AF61CD27C1Fe382F29ba4b724` | 1.0 tUSD8 | Studio deposit | 2026-12-31 23:59:59 | Legacy demo payment, no longer linked |
| 9 | `0xF69e6400b9c93B36d0730B3643f82fE54810498C` | 1.0 tUSD8 | Studio deposit | 2026-12-31 23:59:59 | Legacy demo payment, no longer linked |
| 10 | `0xF69e6400b9c93B36d0730B3643f82fE54810498C` | 1.0 tUSD8 | Demo invoice | 2027-12-31 23:59:59 | Old 1.0 demo, superseded by invoice 11 |
| 11 | `0xF69e6400b9c93B36d0730B3643f82fE54810498C` | 0.2 tUSD8 | Demo invoice | 2027-12-31 23:59:59 | Older 0.2 demo, fallback |
| 12 | `0xF69e6400b9c93B36d0730B3643f82fE54810498C` | 0.2 tUSD8 | Demo invoice | 2028-12-31 23:59:59 | Older 0.2 rotation reserve |
| 13 | `0xF69e6400b9c93B36d0730B3643f82fE54810498C` | 0.2 tUSD8 | Demo invoice | 2028-12-31 23:59:59 | Current public demo, served by `#/demo` |

`#/demo` picks the newest open 0.2 tUSD8 invoice with reference `Demo invoice`
and the demo payee above. It therefore serves invoice 13 while 11, 12, and 13
are open, and falls back to 12 or 11 if 13 is paid or expires. No code change is
needed to rotate.

Do not pay invoices 6, 9, or 10. They are kept only because v1 cannot cancel
them. They are not linked from the site, README, or submission copy.

## Legacy paid invoices

Invoices 1 through 8, 15, and 16 are paid test receipts. The earliest ones were
created by throwaway test wallets that registered a display name from before the
demo settled on **Elena Rossi**. Those names are on chain and cannot be edited.
They are not part of the demo and are not linked anywhere public. Invoice 8 is
the paid receipt used for screenshots and receipt checks. Invoice 15 was the
first 0.2 tUSD8 run through the updated flow; invoice 16 is the paid receipt in
the current narrated demo. The recording payer for invoice 16 is the local
testnet key in `.ciro-record/demo-payer-key`, which is gitignored.

## Public directory

The app keeps one current owner per folded name for new registrations. The v1
contract cannot enforce that rule, so a few build-period addresses still hold
the same folded name. The public directory hides those rows so old test data
does not read as real users; the `check` endpoint still treats the folded name
as taken. The hidden addresses are listed in
`packages/api/src/legacy.js` and are:

- `0x405dfE6F2c29e794B2799946ffcbeF4Da7D3eC70`
- `0x42365E1f1f2dD8815cC7B324f7D2b0Ed011c3292`
- `0x92cf6f88d9846C9aEcaE818cd811Ca45B9Ae90C7`
- `0x0B43c122422305FebDc59936c58C14c46625b97A`
- `0x8Ee4ECE52e9286958FF16C26035Cc73030F557B7`
- `0xDaCf93b7F0c9fA3AF61CD27C1Fe382F29ba4b724`

The demo payee `0xF69e6400b9c93B36d0730B3643f82fE54810498C` and the real
registered account stay visible. The explorer still shows every registration.

## v1 limits

- No `cancel` or `void`. A payee cannot close an open invoice.
- No name change. A registered display name is fixed.
- No deletion. Paid receipts and open invoices stay readable.
- The only exit is payment or the due date.

## v2 migration

The v2 contract adds payee-only `cancel(id)` and `void(id, reason)` for open
invoices, as described in [the v2 plan](../product/V2_PLAN.md). That does not
retroactively close these v1 invoices: v2 is a new deployment and cannot write
to the v1 contract.

Migration steps:

1. Keep `#/demo` on the newest open v1 invoice until v2 is live.
2. At cut-over, point `#/demo` at a v2 demo invoice and leave the v1 invoices
   readable as historical data.
3. Do not promise that v1 test invoices can be cancelled. They cannot.
4. If a v1 invoice must stop being payable before its due date, the only
   on-chain option is for the payer to pay it. There is no operator override in
   v1.

## Housekeeping

- The demo payee key is a local, gitignored testnet key (`.demo-payee-key*`).
- The demo recording payer key is a local, gitignored testnet key
  (`.ciro-record/demo-payer-key`).
- The faucet treasury key is a Cloudflare secret; see
  [FAUCET.md](FAUCET.md).
- Never send mainnet assets to any address on this page.
