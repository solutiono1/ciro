# Tasks

Updated 2026-11-21. Status values: todo, doing, done. Done requires a command that passed, named in STATUS.

## Milestone: backend

The owner asked for this before the frontend.

1. **Contract and unit tests.** `contracts/`. Shanghai, the calls in the architecture. Status: done. Evidence: `forge test`, 11 passed, 2026-11-21.
2. **HTTP API.** `packages/api`. Reads and unsigned writes from `docs/architecture/INTEGRATIONS.md`. No keys. Status: done. Evidence: `npm test -w @ciro/api`, 2026-11-21.
3. **CLI.** `packages/cli`. Commands in the integrations doc. Signs locally. Status: done. Evidence: `npm test -w @ciro/cli`, 2026-11-21. `allow` and `revoke` share that signer. Their chain behavior is in the API test.
4. **MCP.** `packages/mcp`. Prepare and read. Does not sign. Status: done. Evidence: `npm test -w @ciro/mcp`, 2026-11-21.
5. **Docs match the code.** STATUS, HANDOFF, CHANGELOG. Status: done for this milestone.

## Milestone: web app

The owner asked for this after the backend. Status: done.

1. **Build the screens in `docs/design/UX.md`.** The pay screen locks the amount. The name is the only decision. Close and unknown names have no pay button. Status: done. Design follows the Maren Finance system (www.marenfinance.xyz, DESIGN.md).
2. **Call the API for reads and for unsigned transactions.** A wallet signs. The page does not hold a key. Status: done.
3. **Prove the happy path and one refusal against a local chain, then say which command or browser pass was actually run.** Status: done, `npm run e2e -w @ciro/web` on 2026-11-21.

## Not started

- SDK.
- Deploy to Aevum. Needs a key the owner provides. Do not invent one.
- Non-zero fee deployment.

## Check

From `contracts/`: `forge test`.

From the repo root: `npm test`.

`contracts/out/` is gitignored. Run `forge build` in `contracts/` before `npm test` on a fresh checkout. Foundry must be on `PATH` (`~/.foundry/bin`).
