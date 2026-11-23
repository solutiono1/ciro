# Roadmap

Today is 2026-11-21. Submissions close 2026-12-11, 08:00 UTC. Demo day for the top five is 2026-12-15, 06:00 UTC, live. Judging is 12–14 December.

## Now, the contest

The owner set the build order on 2026-11-21: contract, API, CLI, and MCP, then the web app. See DECISIONS. Steps 1, 3, 4, 5, and 7 below are done as code and tests. Deploy is not.

1. Contract and tests. Register, exact pay, close refuses, none refuses, late refuses, double pay refuses, allowance pays and cannot withdraw, fee zero. Done.
2. Deploy to Aevum. Record address, commit, and the transaction hashes of one exact pay and one refused pay. Blocked on a key from the owner.
3. API over those reads and unsigned writes. Done, against a local chain. It has no deployed address yet.
4. Web app: the journey in UX.md, from landing and onboarding through dashboard, invoices, pay, receipt, history, wallet, profile, settings, and developers. A person can finish the happy path and can see a wrong name refuse. Done.
5. CLI over the API. Done.
6. README a judge can follow without us in the room: faucet, chain, one pay, one refusal, explorer links. Still needs the deployment and the web app.
7. MCP tools that prepare and do not sign. Done, because the owner included MCP in the backend pass.

Write this code in the window. Do not import the starter kit Checkout and rename it.

## Immediately after submission

- Freeze the API routes.
- MCP if it did not fit in the window.
- TypeScript SDK against the frozen routes.
- Second network design note: same invoice, USDC where a ramp already exists. No code until the route is chosen on purpose.

## The company, after the demo

Not scheduled as dates. Ordered so each step has the receipt underneath it.

1. Priced deployment. Fee 0.5%, shown before confirm, on a network where the token is real money.
2. A ramp partner for local currency. We send them a paid receipt. We do not issue the card or hold the bank license. This is the Talise-shaped partnership, not a Talise clone.
3. Selective proof of one paid invoice to one reader. Gloam already proved the cryptography. We add a proof of our receipt, not a second shielded pool, and only after the invoice is dull and correct.
4. Invoice splits into named buckets. Comparta's idea, after one payment reconciles. Not before.
5. An allowance that a payroll tool can drive for many invoices. Still not a payroll suite. Payclose-shaped: we prepare, their wallet signs.
6. A way to fund an invoice from credit so the payer need not sell another asset. A lender's job. Maren's job if they want the integration. Not our vault.

## What would mean we are wrong

Stop if a payer cannot tell, on one screen, whether the name matched. More features will not repair that. Stop if the API can mark an invoice paid without a transaction. That would make the receipt a story.
