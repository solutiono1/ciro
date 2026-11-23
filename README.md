# Ciro

A stablecoin invoice that will not pay unless the payee's name matches, the amount is exact, and the network is the one on the bill. The receipt is the record a person can keep.

Ciro is the short name of a chirograph: a deed cut in two so each party holds a matching half. The product is that match. The name you were told, and the name registered to the account, have to be the same half before tUSD8 moves.

The contract, HTTP API, CLI, MCP, and the web app are in this repo. The SDK and an Aevum deployment are not yet. Agents start with the documents below.

Agents start at [AGENTS.md](AGENTS.md). The documentation index is [docs/README.md](docs/README.md). Current work is [docs/operations/HANDOFF.md](docs/operations/HANDOFF.md).

## Read this first

| Doc | What it settles |
|---|---|
| [docs/product/PRD.md](docs/product/PRD.md) | Who it is for, the one flow, what v1 refuses to be |
| [docs/operations/DECISIONS.md](docs/operations/DECISIONS.md) | Name, scope cuts, fee, chain, which tools ship first |
| [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | Contracts, API, and how money moves |
| [docs/design/UX.md](docs/design/UX.md) | Screens, using Maren as the reference and where we depart |
| [docs/architecture/INTEGRATIONS.md](docs/architecture/INTEGRATIONS.md) | API, CLI, MCP, SDK: order and shape |
| [docs/operations/ROADMAP.md](docs/operations/ROADMAP.md) | Contest build, then the company |
| [docs/operations/HACKATHON.md](docs/operations/HACKATHON.md) | Aevum Builder Challenge #1 rules and scorecard |
| [docs/operations/RESEARCH.md](docs/operations/RESEARCH.md) | Gap, comparables, ecosystem, sources |

## Status

Tests pass: `forge test` in `contracts/` (11 tests), `npm test` at the repo root (shared, API, CLI, MCP, web unit) and `npm run e2e -w @ciro/web` (pay flow and public pages). The web app exists and follows the Maren design system. Nothing is deployed. Submission window closes **11 December 2026, 08:00 UTC**.

## Chain, for the contest

QDay Aevum testnet, chain id `44005`. Settlement asset tUSD8 at `0x456569838f1d43009A91ebA4263147Afd7233483` (6 decimals). The company is not locked to that chain. See decisions.
