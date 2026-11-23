# Ciro documentation

Index for people and agents. Requirements live in the PRD. Current state lives in STATUS and HANDOFF. If a sentence here disagrees with those, those win.

Last reviewed: 2026-11-22. The contract, API, CLI, MCP, and web app exist and their tests have passed. The SDK and an Aevum deployment do not. Current state is STATUS, not this index.

## Product

- [PRD](product/PRD.md) — problem, user, the one flow, in and out of v1.
- [Research](operations/RESEARCH.md) — the payment gap and the four products we studied.
- [Hackathon](operations/HACKATHON.md) — Aevum Builder Challenge #1 rules and scorecard.
- [Roadmap](operations/ROADMAP.md) — contest order, then the company.

## Design and build

- [UX](design/UX.md) — landing through dashboard, including wallet, profile, history, settings.
- [Architecture](architecture/ARCHITECTURE.md) — contract, API, who signs.
- [Integrations](architecture/INTEGRATIONS.md) — API, CLI, MCP, SDK and the order.
- [Threat model](security/THREAT-MODEL.md) — keys, name visibility, allowance limits.
- [Tasks](development/TASKS.md) — implementation order.

## Operations

- [Decisions](operations/DECISIONS.md) — locked choices.
- [Status](operations/STATUS.md) — what is implemented.
- [Handoff](operations/HANDOFF.md) — how to continue.
- [Changelog](operations/CHANGELOG.md) — notable changes.

## Intentionally absent

No separate vision, persona, or wireframe files. The PRD and UX cover them. No database specification. The chain is the record. The API keeps a log index, described in the architecture. The frontend spec is UX. No SDK package until the API routes stop changing.
