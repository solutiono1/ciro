# Ciro business and readiness

Founder memo, 2026-11-26. This answers the questions a startup has to answer
before it asks anyone for money or real payment volume: how the money moves,
who pays, why they pay, how Ciro earns, what could kill it, and what "ready"
means.

This is a plan, not traction. Ciro has testnet usage and a working product. It
does not yet have paying customers.

## 1. How the payee gets paid

Ciro is not a wallet and not an escrow. It is a checkout and confirmation layer
that routes a stablecoin transfer directly from the payer to the payee.

The primary path:

```text
Payer wallet -> approve(tUSD8, Ciro, invoice amount)
Payer wallet -> Ciro.pay(invoiceId, typedName)
Ciro         -> checks name, due date, paid flag, chain
Ciro         -> tUSD8.transferFrom(payer, payee, amount - fee)
Ciro         -> tUSD8.transferFrom(payer, feeRecipient, fee)   # fee only
```

So:

- The payer signs an approval for the invoice amount, then signs the payment.
- The token moves from the payer's wallet to the payee's wallet in the same
  transaction that records the invoice as paid.
- Ciro never has a balance. The approval is an allowance, not a deposit, and it
  is consumed by the payment. The API resets a larger standing allowance before
  asking for the exact amount.
- On the testnet deployment the fee is 0, so the payee receives the full amount.
  On a priced deployment the payee receives `amount - fee`; the payer pays the
  invoice amount, not an extra fee on top.
- The receipt is built from the `Paid` event and the invoice state. There is no
  database holding the money or the receipt.

The optional delegated path also moves funds wallet-to-wallet. An approved
spender settles within a cap and expiry. Ciro still never holds the tokens.

**Why this is not a flaw.** Custody would add a regulator-sized trust problem, a
hack target, and a reconciliation job. Ciro's job is to answer "is this the
right name and the right invoice?" and then let the token do what it already
does. The chain is the ledger; Ciro is the check.

If the web app is down, the contract and the token still hold the invoice and
the funds. A technical payer can call the contract directly. The app is the
convenience layer, not the custodian.

## 2. Primary and secondary goals

**Mission:** make the name the check, not the label. A stablecoin invoice should
settle only when the payer types the name they were told, and both sides should
get a receipt they can file.

**Primary goal, next 12 months:** prove that payees will pay for exact-name
settlement and an on-chain receipt on mainnet. Proposed target:

- 25 paying teams,
- $2M/month in settled invoice volume,
- 0.3% blended take rate,
- under 1% wrong-name or disputed payments,
- at least 40% of payees creating a second invoice within 30 days.

These are targets to test, not forecasts.

**Secondary goal:** become the confirmation and receipt layer embedded in
marketplaces, payroll tools, and agent payment runtimes. The web app is the
reference customer; the API, SDK, and MCP are the distribution.

**Non-goals for v1 and v2:** custody, lending, fiat on-ramp, a token, a generic
checkout, or a wallet. Every one of those adds trust and regulatory surface
without proving the core thesis.

## 3. Who pays and why

The **payee** is the economic buyer. They choose Ciro because they want to be
paid correctly and to have a record that matches the invoice.

The **payer** is the user. They open a link, type a name, and sign. They do not
need an account or a Ciro balance. The fee is inside the invoice amount, so the
payer is not asked to pay extra at checkout.

The pain Ciro removes:

- the payer sends to the wrong name or the wrong network,
- the amount does not match the invoice,
- the payment exists but the invoice record does not,
- a freelancer or small supplier spends time matching a transfer to a customer.

Willingness to pay has to be tested, not assumed. The test is simple: does a
payee prefer a 0.3% fee with a verified receipt over a free transfer and a
manual reconciliation? If the answer is no, the product is a feature, not a
company.

## 4. Business model

**Primary: settlement fee on paid invoices.** The mainnet deployment can set a
fee at deploy, capped at 1%. The planned range is **0.2–0.5%**. Charge only when
an invoice settles. No subscription is required to create or read an invoice.

**Secondary: team and API plan.** A monthly plan for teams that need multiple
users, API keys, webhooks, accounting exports, roles, higher limits, and support.
This is the natural expansion after a payee has volume.

**Third: embedded and white-label.** A marketplace, payroll platform, or agency
can embed the confirmation and receipt flow. Revenue is a setup fee plus a
per-invoice or revenue-share fee.

**Fourth: agent payments.** An agent runtime can call the MCP/API, prepare a
payment within an allowance, and attach a receipt. Revenue is usage-based or a
platform subscription. This is later; it should not distract from the invoice
wedge.

**Free forever:** reads, the public API, the SDK, the CLI, the MCP server, and
single-user invoice creation. The fee is the product.

Revenue formula:

```text
revenue = settled volume × take rate
        + team/API subscriptions
        + embedded setup and per-invoice fees
        + agent usage
```

A simple unit-economics check:

| Scenario | Monthly settled volume | Take rate | Monthly revenue |
|---|---:|---:|---:|
| 20 small payees | $200k | 0.3% | $600 |
| 100 payees | $2M | 0.3% | $6,000 |
| 500 payees | $10M | 0.3% | $30,000 |

Costs are RPC/indexing, hosting, support, audits, legal review, and the founder's
time. The model works only if support and infrastructure stay cheap per invoice.
A minimum fee per invoice may be needed for very small invoices; test that
before mainnet.

**Why the fee is defensible:** the payer already pays a wire fee or a 3–5%
collection cost, and a wrong-name transfer is unrecoverable. A 0.2–0.5% fee for
the check and the receipt is cheap against that. The fee is shown before the
payer signs and is deducted from the payee's proceeds, not added silently.

**What is not the model:** spread on FX, custody float, lending against balances,
a token, or charging for reads. Those are different companies with different
risks.

## 5. Go-to-market

Beachhead: freelancers, small agencies, and suppliers already paid in
stablecoins, starting inside the QDay ecosystem.

Channels:

- QDay builders and the Aevum challenge,
- accountants and bookkeepers who reconcile client payments,
- agencies that invoice multiple clients,
- marketplaces and payroll tools that need an embedded confirmation step,
- MCP and agent directories for the delegated path.

First ten design partners: concierge onboarding, testnet first, then a mainnet
pilot with a clear fee and a case study. The ask is not "use my app"; it is
"bring one real invoice and let us compare the reconciliation before and after."

Metrics that matter:

- invoice created → paid conversion,
- time from link open to payment,
- paid volume and repeat payees,
- fee revenue and blended take rate,
- wrong-name attempts and refusals,
- support minutes per invoice,
- API and MCP usage,
- design partner retention.

## 6. Moat and defensibility

The contract is open source. The code is not the moat.

The moat is the workflow and the trust around it:

- a name check that payers and payees both understand,
- a receipt that an accountant accepts,
- integrations with the tools a payee already uses,
- distribution through QDay, agencies, and agent runtimes,
- a brand that means "this payment was checked, not just sent."

Switching costs grow with invoice history, team workflows, API keys, and
webhooks. The data is public, so the defensibility is in the workflow and the
distribution, not in locking data away.

## 7. Risks and honest kill criteria

| Risk | Why it matters | Mitigation |
|---|---|---|
| Payees do not care enough | A free transfer plus a spreadsheet may be "good enough" | Interview 20 payees; test a paid pilot; kill the fee if conversion is zero |
| Wallets add name checks | The confirmation feature becomes native | Move faster on receipts, team workflows, and embedded distribution |
| QDay mainnet slips | The real product waits on the chain | Keep the EVM path portable; do not depend on QDay-only features |
| Regulation | Payment facilitation, fees, and invoicing can trigger rules | Non-custodial design; legal review before mainnet; no fiat |
| Contract risk | Immutable code and real money | Independent audit, bug bounty, pause/guardian design in v2 |
| Phishing and fake invoices | Exact name does not prove the invoice is real | Verified merchant badges, domain-bound links, signed invoices, address display |
| Fee compression | 0.2% may be undercut | Sell the receipt and workflow, not just the name check |
| Support load | Small invoices can be unprofitable | Minimum fee, self-serve docs, API-first |
| Privacy | On-chain names and amounts are public | Be explicit; offer a private receipt option later if demanded |

Kill or pivot criteria to write down now:

- If 20 interviewed payees will not pay even 0.2%, the standalone fee model is
  not proven.
- If payers ignore the name check and pay anyway, the check is not the wedge;
  reconciliation or API distribution may be.
- If support cost per invoice is above the fee, the self-serve model is not
  viable.
- If a design partner will not bring a real invoice to a mainnet pilot, the
  demand signal is weak.

## 8. Is Ciro ready for users?

**Testnet users: yes.** The app, API, faucet, demo invoice, receipt, CLI, SDK,
and MCP are live on Aevum testnet. A builder or judge can use it now. The faucet
has a Discord fallback and a treasury contribution address when it runs dry.

**Paying users with real money: no.** Mainnet readiness needs:

- a new immutable mainnet deployment with a real stablecoin and a fee,
- an independent audit and a bug bounty,
- an indexer for invoice and receipt lists (the current event scan is capped),
- cancel/void and name deactivation,
- monitoring, alerting, an on-call path, and a status page,
- terms, privacy, sanctions, and legal review,
- a support and dispute policy,
- design-partner pilots and proof that payees pay.

The honest position: Ciro is a strong testnet product and a credible mainnet
prototype. It is not a production payment company yet.

## 9. Questions to keep asking

1. **Why would a payer trust a link from a stranger?** The link must show the
   payee address, the registered name, the amount, and the network before a
   signature. Verified merchant badges and domain-bound links are the next step.
2. **What if the payee name is common?** Names are a confirmation check, not a
   global identity. The address is still shown; duplicate names are allowed.
3. **What if the payer sends the wrong token or network?** The client pins the
   chain, contract, token, invoice, name, and amount before the wallet signs.
4. **What if the invoice is wrong?** v1 has no cancel; v2 adds payee-only
   cancel/void. Until then, a typo stays payable until due.
5. **Who pays the fee?** The payer pays the invoice amount; the fee comes out of
   the payee's proceeds. The payer sees it before signing.
6. **Why not just use a normal payment link?** A normal link does not check the
   name, lock the amount, or produce a chain receipt.
7. **Why not hold funds and make it easier?** Custody adds regulation, a hack
   target, and trust. Direct settlement is the safer product.
8. **How does Ciro make money on testnet?** It does not. Testnet is for proving
   the flow; the fee starts on mainnet.
9. **What is the wedge?** Confirmation of payee plus a receipt. The invoice is
   the container.
10. **What is the expansion?** Team workflows, API/webhooks, embedded
    marketplaces, and agent payments.
11. **What is the biggest risk?** Demand and distribution, not the contract.
12. **What would make us pivot?** Payees ignore the name check but ask for
    reconciliation or an API; then sell the receipt/indexing layer.
13. **What do we refuse to build?** Custody, lending, a token, fiat on-ramp, and
    a generic checkout.
14. **What does success look like in 12 months?** Paying teams, settled volume,
    repeat invoices, and a take rate that covers support and infrastructure.

## 10. Next 30 / 60 / 90 days

**30 days:** interview 20 payees; ship the mainnet readiness spec; scope the
indexer, cancel/void, and monitoring; test pricing at 0.2%, 0.3%, and 0.5%.

**60 days:** independent audit; mainnet deployment with a real stablecoin and a
fee; five design partners; support and incident runbooks.

**90 days:** twenty paying teams; case studies; team/API plan; decide whether the
agent path is a real second product or a feature.

## 11. What this means for the dashboard

The stats/dev dashboard should answer the questions above, not just look busy:

- paid volume, invoice count, unique payees, repeat payees,
- created → paid conversion, time to pay,
- fee revenue and blended take rate,
- wrong-name refusals and failed payments,
- faucet balance, claims, empty rate, unique claimants,
- API requests, errors, latency, RPC health, indexer lag,
- API keys, webhooks, usage, and logs for developers.

That dashboard is the next build after the business questions are settled.
