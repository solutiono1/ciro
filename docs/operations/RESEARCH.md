# Research

Captured 2026-11-21 from the planning conversation and the source check that followed it. This is the brief we did not want to lose. It is not a promise that every secondary article was re-verified by a second person. Where a cross-check disagreed, the disagreement is written down.

## The gap

The chain transfer is the cheap part of a stablecoin payment. The payment arrives without a name, an invoice, or a receipt. That is the hole.

Operators describe the failures at the seam, not inside the block: underpaid, overpaid, late, missing reference, unexpected sender, outside limits, and the wrong network. The wrong network is the one nobody fixes quickly. Sources: Lumx, 17 November 2026, "Failed stablecoin pay-ins"; Notabene's 2026 playbook as reported by Stablecoin Insider, which puts the open layers at trust, compliance, authorization, reconciliation, and reporting; Reap, citing an IMF study via BIS, where fiat rails and trading fees cost more than the chain transfer on a $200 example.

Freelancers describe 3–5% gone between a paid invoice and money they can spend (HackerNoon, 17 November 2026). A $3,000 contractor wire is still quoted at $25–$80 and one to three days (Nium, 18 November 2026). Self-custody removes a fintech's freeze. It does not remove a stablecoin issuer's ability to freeze an address, and a local bank still asks where a deposit came from.

Businesses in thin correspondent-banking corridors already settle suppliers in USDT or USDC and then lack the invoice and the receipt an accountant will file (Techeconomy, 20 November 2026).

Cards let the buyer undo a payment. Wires and stablecoin transfers do not, except for the undo written into a contract, plus the issuer's freeze. Merchants, freelancers, and traders do not want the same undo.

Agent registries are not the same thing as agents you can pay. An ERC-8004 index on 20 November 2026 showed on the order of 1.27 million raw registrations on Base and Ethereum, about 27,000 distinct agents, and about 2,900 live. Paying "an agent" with no cap is the new wrong-account transfer.

## Four products we studied

### Gloam — https://www.gloam.trade

Thesis: private by default, provable on demand. A shielded vault for stablecoins, and on Robinhood Chain for stock tokens. Proofs are made on the owner's device. Nobody else holds the key. Live on Robinhood Chain, Tempo, Base, Ethereum, Elysium, and BNB Chain. Deposits and private payments are free. Cash-out is 0.5%. Proofs include an exact balance, a minimum, a payment, and a payroll total that hides each payee. Agents can pay through x402, a proposed private method for Tempo's Machine Payments Protocol, and MCP.

They hide the postcard. They do not check a legal name before the money moves, and the accountant gets a proof rather than an invoice that refused to pay when the name was wrong. GENIUS still lets the issuer freeze, and Gloam says the design does not stop that.

We take, later: one proof of one paid invoice to one reader. We do not take the pool in v1.

### Talise — https://www.talise.io

Thesis: dollars should move like a message. USDsui on Sui. zkLogin, no seed phrase the user handles, gas sponsored, names like `maya@talise`, final in under a second. Cash-out to banks and mobile money in 36 countries, SWIFT elsewhere, a virtual card, yield on idle dollars. Copilot prepares a payment and the person approves. MCP can read the account and prepare a cash-out. An Agent Pass is an on-chain allowance with a daily limit and a 7, 30, or 90 day expiry. The agent pays inside it. Over the limit, the person approves. Revoke is one action. Private sends exist as an early shielded pilot. Amounts are still visible where funds enter and leave the pool. Talise says it is not a bank. The card sits with a provider.

We take: pay a name, and an allowance the chain enforces. We do not take the card or the 36-country cash-out. Those are the partner's license. See DECISIONS.

### Comparta — https://comparta.xyz

Thesis: a small team should have one place to receive USDC, invoice, get paid by link, run payroll, and split revenue into buckets. Built on Circle's Arc. Usernames. Invoices auto-mark paid when the amount settles. Payment links accept a card or a wallet. Buckets: Operating, Tax, Payroll, Savings. The published design is one Circle-custodied wallet per organization and a double-entry ledger in a database, reconciled against the chain. Fees are shown before confirm. They say a recipient name is confirmed before send.

We take: an invoice that is paid only when the settlement matches. We do not take custody, the payroll suite, or the yield buckets in v1. A platform that can freeze the wallet is the outage their users already fear from other fintechs.

### Maren Finance — https://www.marenfinance.xyz

Thesis: spend bitcoin without selling it. Deposit BTC on Mezo, borrow MUSD, pay an @handle. Non-custodial signing. A relayer pays gas on some calls and simulates before it pays. Five contracts source-verified. Pre-audit, testnet only. Liquidation at Mezo's 110%, with Maren's own line at 140%. Pooled depositors share one trove. They say that in plain language. The UI is the reference in UX.md: one job per screen, amount first, handle resolved before send, risk written on the page.

A separate project, Maren Labs (marenlabs.xyz), hires an agent with a budget. The agent cannot withdraw. Trades pay 1%. That rule, "the worker cannot take the money out," is the allowance rule we use. The bitcoin loan is not. It is another chain and another risk. See DECISIONS.

## Why a fee can exist

People will not pay 0.5% to move tokens between two wallets they already control. They will pay it on an invoice that checked the name, refused the wrong network, and left a receipt, because the alternatives are a wire, a 3–5% app, or a final payment to the wrong account. Gloam already charges 0.5% to cash out. Comparta charges where value is created and shows it first. Our fee sits in that band, on settlement only, and it is zero on the testnet demo.

## Why someone would integrate

Wallets, payroll tools, and agent runtimes need "create a bill, confirm the name, settle, emit a receipt." They do not need another wallet. The API is that object. MCP is how an agent prepares a payment without holding the treasury. A CLI is how a developer proves it in one sitting. An SDK is the same API once the routes are stable. QDay's testnet has a rail and a test coin. It does not have this invoice. That is the reason for them to feature it, the same shape as Mezo being visible through Maren and Sui through Talise.

## Hackathon cross-check

A separate source check (the deep-research run on 2026-11-21) confirmed the close time, the $1,500 split, the seven-part scorecard, the boilerplate conflict, the unnamed judges, and the gap between QDay's "live" agent stack and what is actually documented. It did not verify the pain articles in this file. Those remain readings of the articles named above. It added: tUSD8 is an unverified proxy with hundreds of holders; the sandbox facilitator names unverified EntryPoint, policy, and paymaster contracts; the paymaster had an empty balance; no completed x402 payment was observed; ERC-8004 was not at the usual addresses on Aevum.

## Regulation, only as a boundary

The GENIUS Act's main US rule packages were still proposals in mid-November 2026, with an effective date discussed as 18 January 2027 or 120 days after final rules. MiCA and GENIUS do not treat reserves the same way. A company that touches customer fiat in both places inherits that. Ciro v1 does not touch fiat. A ramp partner would.
