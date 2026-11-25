# Go-to-market and pilot plan

Status: honest pre-traction plan, 2026-11-25. Ciro is on Aevum testnet. There
are no design partners, no logos, and no real volume yet. The goal is 5–10
testnet pilots before the mainnet launch, then 3 public case studies.

## Positioning

**The confirmation and receipt layer for stablecoin invoices.**

Ciro is not a wallet, a card, or a bank. It is the check that the payer is
paying the right name, and the receipt the payee can file. The name is the
wedge; the record is the retention.

## Who it is for

The first user is a freelancer, contractor, small agency, DAO contributor, or
small supplier who is already paid in stablecoins and has to prove the payment.

Best-fit profile:

- 1–50 invoices a month.
- Paid by clients or platforms in USDT/USDC/tUSD8.
- Reconciles by hand today: screenshots, spreadsheet rows, block explorer
  links, or “please send the hash again.”
- Has been burned by a wrong address, a wrong name, a wrong chain, or a payment
  that could not be matched to an invoice.

The payer is the client who opens the link. A marketplace, payroll tool, or
agent runtime is a later API caller, not a separate screen.

## The pilot offer

- Zero fee during the testnet pilot.
- White-glove onboarding: name registration, first invoice, a payer test.
- A short feedback call after the first three invoices.
- Early access to the mainnet contract and the team plan.
- No custody, no key sharing, no token.

What we ask in return:

- Use it for at least three real or realistic invoices.
- Tell us where the flow breaks.
- Allow an anonymized case study if it works (optional).

## Channels

1. **QDay ecosystem.** Builders, agencies, and merchants already on Aevum.
2. **Accountants and bookkeepers.** They see the reconciliation pain first and
   refer clients. Offer a co-branded receipt export.
3. **Crypto-native agencies and DAOs.** They already invoice in stablecoins and
   have a finance owner who can decide.
4. **Founder-led outbound.** Ten conversations a week, not a broad ad spend.
5. **SEO and templates.** “Stablecoin invoice,” “USDC invoice,” “confirmation
   of payee,” “crypto invoice receipt,” and free invoice templates.
6. **Demo Day and ecosystem visibility.** The Aevum Builder Challenge and QDay
   community are the first distribution surface.

## 30 / 60 / 90

### First 30 days

- 10 customer interviews (agencies, freelancers, DAOs).
- 5 pilot accounts on testnet.
- 3 completed invoice → payment → receipt loops per pilot.
- Publish one explainer: “Why a wallet address is not a confirmation of payee.”
- Add a pilot intake link to the README and the site footer.

### Days 31–60

- 10 pilots, 3 case studies, 1 accountant partner.
- Measure time to first invoice and invoice-to-payment conversion.
- Ship the highest-friction v2 item from pilot feedback: receipt PDF, reminders,
  address book, or team accounts.
- Test a 0.2–0.5% fee with a small group (on a priced deployment, not the
  zero-fee testnet reference).

### Days 61–90

- Mainnet readiness: contract v2 audit, stablecoin choice, migration guide.
- 3 public case studies and a waitlist for the team plan.
- One integration partner: a marketplace, payroll tool, or agent runtime.
- Decide the team-plan price and the free-tier boundary.

## Outreach template

Subject: **A stablecoin invoice that checks the name**

> Hi [name] — I’m building Ciro, a stablecoin invoice that only pays when the
> payer types the exact registered name. The amount, reference, and due date
> are locked, and the payee gets a receipt with the transaction hash.
>
> I’m looking for 5 agencies or freelancers who invoice in stablecoins to try it
> on Aevum testnet. It is free, non-custodial, and takes about five minutes:
> register a name, create one invoice, and have a client pay it.
>
> Would a 15-minute call this week be useful? I’ll show the close-name refusal
> first — that is the part that saves the payment.

## Interview questions

1. How do you invoice today, and in which asset?
2. How does the client know which address or name to pay?
3. What happens when the name, amount, or chain is wrong?
4. How do you prove the payment to an accountant or a client?
5. How many invoices a month, and what is the average size?
6. What do you pay today to collect an invoice (fee, time, tooling)?
7. Which part is more painful: the payment or the record?
8. Would you pay 0.2–0.5% for a confirmed name and a fileable receipt? Or a
   flat monthly plan?
9. What would make you switch from your current process?
10. Who else in your network has this problem?

## Pricing

- **Payer:** free. The payer should never need a Ciro account.
- **Payee:** 0.2–0.5% per paid invoice on mainnet, or a team SaaS plan for
  API keys, webhooks, exports, roles, and support.
- **Reads, SDK, CLI, MCP:** free. The integration path should be free.
- **Testnet:** zero fee, always the reference deployment.

## Metrics

- Time to first invoice.
- Invoice-to-payment conversion.
- Repeat payee rate (second invoice within 30 days).
- Close-name / refused-payment rate.
- API and MCP adoption.
- Support tickets per 100 invoices.
- Net revenue per paid invoice after the mainnet fee.

## Intake

Open a pilot request:

<https://github.com/solutiono1/ciro/issues/new?template=pilot.yml>

Do not post a private key, seed phrase, or API key in an issue. A GitHub handle
is enough for a first reply.

## Related

- [v2 plan](../product/V2_PLAN.md) — Control Room, account deletion,
  pause/suspension, and the growth backlog.
- [Submission copy](../submission/DORAHACKS.md) — judge-facing overview.
