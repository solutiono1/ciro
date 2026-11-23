# Aevum Builder Challenge #1

Checked against public pages on 2026-11-21. If a page and this file disagree, the page wins and this file gets an entry in DECISIONS.

## The event we are entering

- Page: https://qday.io/builder-challenge
- Submission: https://dorahacks.io/hackathon/qday/detail
- Build window: 16 November 2026 through 11 December 2026, 08:00 UTC.
- Judging: 12–14 December 2026.
- Demo day: 15 December 2026, 06:00 UTC. Top five, live, 3 to 5 minutes. A recording does not replace attendance.
- Prize: $1,500 USDT. $800, $500, $200.
- Team: solo or 2 to 4.
- Asset: tUSD8 on Aevum testnet. Settlement on another chain does not count.

An older Google Form, linked from QDay in October 2026, describes a 24-hour event on 5–6 December, a $3,500 pool, and an ML-DSA bonus. That form is not the live rules. There is no ML-DSA requirement on the live scorecard.

## What they ask us to ship

One complete stablecoin payment flow.

- Public repository. DoraHacks also asks for a git host link. A demo video is badged required. The written rules require the live call for the top five, and the starter kit accepts a short video or a live URL. We will have a live URL and a short recording so either reading is satisfied.
- Evidence the app uses Aevum: contract address, commit, transaction hashes.
- A working demo, or a Docker image.
- Documentation: problem, architecture, flow, technologies.
- License: MIT or Apache-2.0. We use MIT unless we decide otherwise in DECISIONS.
- DoraHacks says all code is written in the build window. qday.io allows licensed boilerplate, and the starter kit says the DoraHacks rules override the kit. Libraries yes. Their Checkout, renamed, no.

Tracks that fit us: invoice payments, confirmation of payee. We do not need to enter as "native AI assistants" for the allowance to count under safety.

## Scorecard

Published on qday.io, out of 100.

| Points | Criterion | How Ciro answers |
|---|---|---|
| 20 | Innovation and originality | The payment refuses a name that does not match. A checkout clone does not. |
| 15 | User experience | One screen where the only decision is the name. Amount is locked. |
| 15 | Technical quality and platform integration | tUSD8 on Aevum. API and CLI are the reusable piece. No homemade paymaster. |
| 15 | Real-world utility | The invoice a freelancer can send and an accountant can screenshot. |
| 15 | Safety, trust, and controls | Exact amount, due time, name check, allowance cap, revoke. No custody. |
| 10 | Demo | Happy path and one refusal, with explorer hashes. |
| 10 | Documentation | This docs directory is that deliverable. |

DoraHacks adds an unscored eighth line: ecosystem contribution, meaning other builders can reuse it. The API is that line.

## Network facts we build against

| | |
|---|---|
| Chain id | 44005 |
| RPC | https://rpc-test.qday.info |
| Explorer | https://explorer-test.qday.info |
| Gas | tQDAY, 18 decimals |
| tUSD8 | 0x456569838f1d43009A91ebA4263147Afd7233483, 6 decimals |
| EVM | Shanghai |
| Logs | Query at most 1,000 blocks at a time |
| Faucet | https://faucet.qday.info/en and the Discord faucet for participants |

The build page lists a WebSocket URL. The starter kit says the RPC is HTTPS only. We use HTTPS until we have probed the socket.

tUSD8 on the explorer was an unverified proxy when checked. EIP-3009 and permit are claimed by the starter kit. v1 uses approve and transferFrom so we do not depend on an unverified extension.

## Organizers

QDay is a product of PQA Labs Limited, Hong Kong. Danny Lung is CEO. On DoraHacks the organization members are the account `otto` (owner), `pascalhk` (admin, profile says CTO at PQA Labs), and DoraHacks (admin). The PQA Labs team page names Pascal Lejolif as CTO. The DoraHacks profile does not print that legal name. No individual judge is named on the public challenge pages. Do not write copy aimed at a person who has not been named.

## Starter kit

https://github.com/qday-io/aevum-starter-kit

Use it for chain facts and for the warnings: Shanghai, log chunks, legacy transactions, no supported bundler. Do not fork Checkout as the product.

Sandbox facilitator, not on our critical path: https://signet.qday.info/supported advertises x402 and an ERC-4337 scheme. The paymaster address it names was empty when checked. `@qday/sdk` exists on npm while the wiki has said the official SDK is not on npm until Q1 2027. We do not take a dependency on either until we have sent a payment through it ourselves.
