# Agent instructions

Read this file before changing Ciro. Then read the documents for the area you are touching. Do not rely on chat history.

## Source of truth

When two documents disagree, stop and use this order. Do not silently pick one.

1. An explicit decision from the project owner, recorded in `docs/operations/DECISIONS.md`.
2. `docs/product/PRD.md`.
3. `docs/design/UX.md` and `docs/architecture/ARCHITECTURE.md`.
4. The code and tests that actually pass.
5. `docs/operations/HANDOFF.md` and older notes.
6. An agent's guess.

If the conflict is not already recorded, add it to `docs/operations/HANDOFF.md` and ask the owner.

## Before you write code

1. Read this file.
2. Read `docs/product/PRD.md`.
3. Read `docs/operations/STATUS.md` and `docs/operations/HANDOFF.md`.
4. Read the architecture, UX, or integration doc for the layer you are changing.
5. Inspect the code. Documentation can lag. The tests are the proof of what runs.

## While you work

- Do not widen scope, milestones, or requirements on your own. The backend milestone is done. The next milestone is the web app in `web/`, from `docs/design/UX.md`, calling the API. Do not start the SDK, a deploy, or a second product.
- Do not rename the product. The name is Ciro.
- Do not add cards, bank cash-out, yield, payroll, or a bitcoin loan.
- Do not put a private key, mnemonic, or API secret in a document, a test fixture committed as a real key, or a log.
- Update docs when behavior, decisions, or status actually change. Skip doc edits for a comment or a rename inside a function.
- `docs/operations/DECISIONS.md` gets a new dated entry when a real decision changes.
- `docs/development/TASKS.md` and `docs/operations/STATUS.md` move when a milestone moves.
- `docs/operations/CHANGELOG.md` records notable changes.
- `docs/operations/HANDOFF.md` must be enough for a new agent to continue without the chat.

## Before you say something is done

Run the tests for the layer you changed and read the output. A feature is done only when the code exists and the command you name has passed. If you could not run a test, say so.

## Layout

| Path | What it is |
|---|---|
| `docs/README.md` | Index |
| `docs/product/PRD.md` | Requirements |
| `docs/design/UX.md` | Flows and sections |
| `docs/architecture/ARCHITECTURE.md` | Contract, API, clients |
| `docs/architecture/INTEGRATIONS.md` | CLI, MCP, SDK order |
| `docs/security/THREAT-MODEL.md` | What we defend against |
| `docs/development/TASKS.md` | Build order and state |
| `docs/operations/DECISIONS.md` | Locked choices |
| `docs/operations/STATUS.md` | Where the repo is today |
| `docs/operations/HANDOFF.md` | Continue here |
| `docs/operations/CHANGELOG.md` | Notable changes |
| `docs/operations/ROADMAP.md` | Contest, then company |
| `docs/operations/HACKATHON.md` | Aevum rules |
| `docs/operations/RESEARCH.md` | Why this product |
| `contracts/` | Solidity |
| `packages/api` | HTTP API |
| `packages/cli` | `ciro` CLI |
| `packages/mcp` | MCP server |

The SDK and the web app are not in this repo yet. Do not create them until the owner asks.
