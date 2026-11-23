# Handoff

Updated: 2026-11-23. Read `AGENTS.md`, the PRD, and this file before writing code.

## What the owner asked

Build the backend first: smart contract, HTTP API, CLI, and MCP. Then plan, design, and build the frontend and wire it to this backend and the contract.

The product name is Ciro. The folder is `/home/solution/ciro`.

## What is true right now

The backend milestone is implemented and the commands in `docs/operations/STATUS.md` passed on 2026-11-21. Nothing is deployed. The web app exists. It follows the Maren design system, including the landing page with the live name-check card, FAQ, docs page, and faucet/add-network actions. There is no SDK. General Sans is self-hosted and active; the licensed Neue Montreal files are still missing, so the `neueMontreal` stack entry falls through to General Sans. See `docs/design/UX.md` for the exact file names.

Foundry 1.10.0 is at `~/.foundry/bin`. Put that directory on `PATH` before `forge` or `anvil`. Node is v26. The root `npm test` needs `contracts/out/` from `forge build` (that directory is gitignored).

## What to build next

- The SDK, a typed client of `/v1`. Do not give it a second way to encode calls, and do not put a wallet in it. The caller signs.
- The pay screen is the product: the amount is locked, the payer's only decision is the name, and a close or unknown name has no pay button. `POST /v1/invoices/:id/check` is the snapshot check. `POST /v1/check` is the payee's current name. Payment uses the snapshot.
- Do not add cards, cash-out, yield, payroll, or a loan. Do not deploy to Aevum until the owner provides a key.

## How to run what exists

From the repo root, with Foundry on `PATH`:

```shell
cd contracts && forge test
cd .. && npm test
```

The web app's pay-flow test: `npm run e2e -w @ciro/web`. On this machine the system lacks the libraries the browser needs (`libnspr4.so`, `libnss3.so`, `libnssutil3.so`); run it as

```shell
LD_LIBRARY_PATH=/tmp/opencode/chromedeps/extract/usr/lib/x86_64-linux-gnu npm run e2e -w @ciro/web
```

The debs were downloaded with `apt-get download libnspr4 libnss3` and extracted to `/tmp/opencode/chromedeps/extract`.

API process, after a contract address exists:

```shell
CIRO_RPC_URL=... CIRO_ADDRESS=0x... CIRO_CHAIN_ID=44005 PORT=8787 npm start -w @ciro/api
```

There is no default API URL. Nothing has been deployed, so the CLI has nothing public to point at. Config file `CIRO_CONFIG`, or `~/.ciro/config.json`:

```json
{
  "apiUrl": "http://127.0.0.1:8787",
  "rpcUrl": "https://rpc-test.qday.info",
  "chainId": 44005,
  "keyPath": "/absolute/path/to/key"
}
```

The key file is one hex private key, mode 0600. The CLI refuses a looser mode and does not print the key. Signing commands need `--yes` when stdin is not a terminal. They print the summary, then sign, then broadcast through `rpcUrl`. The API never broadcasts.

MCP is a stdio process: `node packages/mcp/bin/ciro-mcp.js`. It speaks newline-delimited JSON-RPC. Set `CIRO_API_URL`. It has no signing tool. `npm start -w @ciro/api` is only the HTTP server.

## Contract names the compiler forced

Solidity will not compile a variable named `reference`. The invoice field and the `InvoiceCreated` argument are `memo`. JSON and the CLI still say reference.

The revert after `revoke` is `AllowanceIsRevoked`. The event is `AllowanceRevoked`. The API code for that revert is `allowance_revoked`.

## Amounts

The API takes base units as a decimal string. Six decimals. `"1000000"` is 1 tUSD8. The CLI `--amount` and `--cap` are human amounts: `1` and `1.5` and `0.000001`. A date flag `YYYY-MM-DD` is 23:59:59 UTC that day. The API also accepts unix seconds.

`POST /v1/tx/pay` may include `approvals` when `payer` is set and the token allowance is short. The first payment approves the exact invoice amount. A non-zero allowance that is still too small is reset to zero, then set to the exact amount. `payFromAllowance` does the same when `spender` is set. The cap and expiry are still enforced by the contract.

## Conflict already resolved

The architecture said a stranger cannot read the display name. The PRD says the payer sees the registered name. The PRD wins. `displayName` is public, and `GET /v1/payees/:address` returns it. Recorded in `docs/operations/DECISIONS.md`.

An earlier roadmap built the web app before MCP and treated deploy as step two. The owner later asked for contract, API, CLI, and MCP before the frontend. That sequence is what shipped. Deploy is still blocked on a key. The decision is in `docs/operations/DECISIONS.md`.

## Allowance meaning

`allow` is called by the payee. `payFromAllowance` pulls tUSD8 from the spender and only pays that payee's invoices, up to the cap. The spender cannot send to an arbitrary address. `pay` remains open to any payer. If the owner wanted the agent to pull from the payee's own balance, that is a different contract and needs a new decision.

There is no `LICENSE` file yet. The Solidity sources say `SPDX-License-Identifier: MIT`. The contest accepts MIT or Apache-2.0. Do not invent a copyright holder. Ask the owner before adding the license file.

## Web app chain rule

Every transaction the web app signs goes through `broadcast` in `web/src/wallet.js`. It reads `chainId` from the API transaction, calls `switchTo(chainId)` when the wallet is elsewhere, and adds the chain first if the wallet says 4902. `switchTo` tries the switch again after adding, because `wallet_addEthereumChain` does not always switch. The chain id is put in the `eth_sendTransaction` params. So a wallet on mainnet gets a signature for Aevum, and MetaMask quotes the Aevum gas (tQDAY), not mainnet ETH. Do not broadcast transactions without checking the chain: testnet can revert for a stale chain id.

## Newer builds to know about

- The landing page has the asymmetric hero with a live name-check card on the right, the drawn dashboard preview in `.stage`, the three steps with line icons, the why-split with one credited photo, the FAQ, the docs teaser, the invoice lookup, and the footer. The hero card types "Ada Okonkwo", resolves exact, close, or none with the shared fold, and shows the pay button only on exact; `e2e/public.test.js` covers it.
- The faucet endpoint is `POST /v1/tx/faucet` with `{ address }`. It returns an unsigned `mint` on the test token, 1,000 tUSD8, testnet only. It is disabled on a priced deployment (`feeBps !== 0` returns `not_found`) and rate-limited per address (60s in-memory cooldown). On the local `MockUSD8` the `mint` is public, so it works. On Aevum the real tUSD8 may not expose a public `mint`, in which case the button reverts and the official faucet is the fallback. The button lives in the sidebar (`#side-faucet`) and the mobile sheet (`#sheet-faucet`).
- Add network is for Aevum only. `networkParams()` refuses a non-44005 chain with a clear message, because a real wallet cannot add an `http://127.0.0.1` local RPC.
- Docs: `#/docs` lists every API route. The app preview placeholder is in `.stage`.
- The app preview does not play a video today. `web/public/media/ciro-demo.webm` recorded the landing page itself, so it showed Ciro inside Ciro and the `<video>` was removed. `node scripts/record-demo.mjs` (needs `anvil` on PATH and `contracts/out/` built) can produce a real dashboard pass at that path; wire it back over the drawn preview only after you have watched it and confirmed it is not the landing page.
- Fonts: General Sans (Fontshare, free) is self-hosted as the active face. Neue Montreal and SF Pro Rounded are the target, waiting on licensed files in `web/public/fonts/`. See `docs/design/UX.md` for the exact names.

## SDK decision

The SDK stays frozen until the API routes stop changing. The routes are not yet proven stable against a live Aevum deployment (there is no deploy yet), the contest scores the web app and the demo, not the SDK, and a typed client is a short job once the contract is locked. Freeze `/v1` after the deploy, then build `packages/sdk` against the locked route list in `docs/architecture/INTEGRATIONS.md`.

## Do not

- Create a private key to deploy, or write a key, mnemonic, or API secret into a document.
- Claim a layer done without a passing command in `docs/operations/STATUS.md`.
- Mark an invoice paid from the API. Only the contract can.
