# Ciro v2 plan

Status: proposed, 2026-11-25. This consolidates the v2 items in
[the audit](../security/REVIEW.md), the roadmap in the README, and the
operations work needed before a mainnet deployment.

The v1 contract is immutable and stays the reference deployment for the
hackathon. v2 is a **new deployment** with a migration path, not a quiet edit
to the live contract.

## 1. What must stay true

These are invariants, not features. Every v2 change must preserve them.

- **Non-custodial.** Ciro never holds a key that can move user funds.
- **Chain is the record.** A receipt is read from the chain, not invented by a
  database.
- **No admin seizure.** An operator can pause or suspend a name, but cannot
  move, freeze, or redirect a user's tokens.
- **Exact-name payment.** A close or unknown name never settles.
- **Least privilege.** A session, an API key, or an operator gets the smallest
  authority that does the job.
- **Testnet first.** v2 is exercised on Aevum before any mainnet deployment.

## 2. v1 items carried into v2

These come from [REVIEW.md](../security/REVIEW.md) and the README's known limits.

| Item | Why it matters | v2 direction |
|---|---|---|
| No cancel or void | A typo stays payable until due | Payee-only `cancel(id)` while open; paid receipts are immutable |
| `InvoiceCreated` has no name snapshot | A log-only indexer cannot show the name | Emit the folded name hash and display name, or an indexed snapshot |
| `paidAt = 0` sentinel | A block timestamp of zero looks unpaid | Separate `paid` flag or a non-colliding sentinel |
| ASCII-only folding | Non-ASCII names can be registered directly on chain | Preserve bytes or reject on chain; one canonical rule shared by contract and API |
| Unbounded invoice array | `payees[address].invoices` grows without limit | Index events; keep bounded per-account views off chain |
| Event scan from `CIRO_START_BLOCK` | Lists are slow and capped at 100 | Envio or The Graph indexer; paginated read model |
| Fee set at deploy only | Mainnet pricing needs a controlled change | Deploy-time fee with a 1% cap, or a timelocked fee setter |
| No name deactivation | A name cannot be retired or suspended | Payee `deactivateName()` and guardian suspension with an appeal path |

## 3. Contract v2

### 3.1 New deployment, not a proxy by default

The v1 contract is immutable. A proxy adds an upgrade key and a permanent
attack surface. The default is a **new immutable deployment** with a migration
window:

1. Deploy `CiroV2` and verify the source.
2. Run both deployments in read-only mode; the UI shows which one an invoice
   belongs to.
3. New invoices go to v2 after a published cut-over block.
4. Old receipts stay readable forever.

A proxy is only considered if a paying customer requires upgradeability. If it
is used: transparent proxy, 2-of-3 multisig, 48-hour timelock, separate
upgrade audit, and a public upgrade log.

### 3.2 Functions to add

- `cancel(uint256 id)` — payee only, open only, emits `InvoiceCancelled`.
  A paid invoice cannot be cancelled.
- `void(uint256 id, bytes32 reason)` — payee only, open only, for a mistaken
  invoice that should never be paid. Same accounting as cancel.
- `deactivateName()` — payee retires their name. Existing open invoices keep
  the snapshot name and remain payable unless the payee also voids them.
  New invoices cannot be created without an active name.
- `reactivateName()` — payee restores a name they deactivated, if the hash is
  still free under the v2 collision policy.
- `setFee(uint16 bps)` — only if the deployment uses a fee; capped at 100 bps,
  timelocked, emits `FeeChanged`.
- `pause()` / `unpause()` — see section 5.
- `suspendName(address payee, bytes32 reason)` / `reinstateName(address payee)`
  — guardian only, for sanctions, fraud, or a court order. It does not move
  funds and does not erase receipts.
- `getInvoiceView(id)` — one call that returns the invoice, the name snapshot,
  the paid flag, and the cancel state, so clients do not guess.

### 3.3 Events and indexing

- `InvoiceCreated(id, payee, amount, due, memo, nameHash, displayName)`.
- `InvoiceCancelled(id, payee, reason)`.
- `NameDeactivated(payee, nameHash)`, `NameSuspended(payee, reason)`,
  `NameReinstated(payee)`.
- `Paused(account, scope)`, `Unpaused(account, scope)`.
- `FeeChanged(oldBps, newBps)`.

Every event is indexer-friendly: indexed payee and id where useful, no
unbounded arrays in the hot path.

### 3.4 Name rules

- One normalization function in Solidity and one in the shared package.
- v2 either preserves non-ASCII bytes in the hash or rejects them on chain.
  The current "drop non-ASCII" rule is not allowed to diverge between clients.
- Duplicate names remain allowed, because a name is a confirmation check, not a
  global identity. The UI always shows the payee address next to the name.
- A suspended or deactivated name cannot settle a new payment. The invoice's
  historical name remains visible on receipts.

### 3.5 ERC-8004 and ERC-4337

The starter kit recommends ERC-8004 for Confirmation of Payee and ERC-4337 for
smart accounts. At build time the canonical ERC-8004 registry was not deployed
on Aevum, and QDay's ERC-4337 paymaster docs and addresses were not published.
v1 therefore uses a native registry and plain EOAs with capped allowances.

v2 keeps the native registry as the source of truth and adds:

- an **ERC-8004 adapter** that reads a canonical registry when one is
  published, and maps `address -> identity` into the same confirmation check;
- an optional **smart-account path** for passkeys and session keys, without
  making the core invoice flow depend on a bundler or paymaster.

The adapter is a read layer. It must not weaken the exact-name check.

## 4. Account deletion and data lifecycle

"Delete my account" cannot mean "erase the blockchain." v2 makes the boundary
explicit before the user confirms.

### 4.1 What can be deleted

| Data | Where | v2 action |
|---|---|---|
| Email, display profile, support notes | Off-chain database | Delete or anonymize |
| API keys, webhooks, notification endpoints | Off-chain database | Revoke and delete |
| Sessions and device tokens | Off-chain | Revoke |
| Analytics identifiers | Analytics | Delete or anonymize |
| Name registration | On chain | Deactivate; the historical hash remains |
| Open invoices | On chain | Cancel or void before deactivation |
| Paid invoices and receipts | On chain | **Cannot be deleted**; retain and explain |
| Transaction hashes | On chain | **Cannot be deleted** |

### 4.2 User flow

1. **Re-authenticate.** Wallet signature plus a fresh session.
2. **Show the split.** A plain-language screen lists what will be deleted, what
   will be deactivated, and what stays on chain forever.
3. **Export.** Offer JSON, CSV, and a receipt PDF before anything changes.
4. **Settle the chain state.**
   - revoke every active allowance;
   - cancel or void every open invoice;
   - deactivate the name;
   - confirm there is no open invoice that can still be paid.
5. **Delete the off-chain account.** Remove PII, keys, webhooks, sessions, and
   notification endpoints. Anonymize analytics.
6. **Grace period.** Seven days where the user can undo. After that, the
   off-chain deletion is final.
7. **Confirm and audit.** Send a final email if one is still permitted, and
   write an append-only audit record with no PII.

### 4.3 Backups and legal holds

- Backups are purged on a 30-day rotation; the deletion job records the date.
- A legal hold pauses deletion for the specific records named in the hold. The
  user is told what is retained and why, unless a court order forbids it.
- On-chain data is never represented as deleted. The privacy policy says this
  in one sentence, not in a footnote.

### 4.4 Admin deletion

Only trust and safety or legal can delete an off-chain account, with a second
approver, a written reason, and an audit record. A suspended account keeps its
on-chain name and receipts until the appeal is resolved.

## 5. Pause and suspension

Pause is a safety control, not a business control. It must never become a way
to take user funds.

### 5.1 Scope matrix

| Control | Who | What it stops | What it cannot do |
|---|---|---|---|
| Global emergency pause | 2-of-3 guardian multisig | New registrations, invoices, allowances; optionally payments | Move or seize tokens; rewrite receipts |
| Maintenance mode | Ops | Hosted UI writes; API writes; new sessions | Stop direct contract calls |
| Account suspension | Trust and safety | Hosted UI, API keys, webhooks for one account | Touch the on-chain name or funds |
| Name suspension | Guardian multisig | New payments to a suspended name | Move funds; delete receipts |
| Invoice cancel/void | Payee | One open invoice | Cancel a paid invoice |
| Invoice flag | Support | Nothing on chain; UI warning only | Mark paid or unpaid |

### 5.2 Contract pause design

- OpenZeppelin-style `Pausable` with `PAUSER_ROLE` held by a 2-of-3 multisig.
- `pause(scope)` where scope is `REGISTER`, `CREATE`, `PAY`, `ALLOW`, or `ALL`.
  Payments are paused only for a critical exploit, because a paused payment can
  strand a legitimate payer at the signing step. The status page says which
  scope is paused.
- `unpause` requires the multisig and a 24-hour timelock after the incident is
  understood. A break-glass pause is immediate; unpause is deliberate.
- Every pause emits an event and a public status-page entry.
- Pause does not change balances, paid flags, or receipts.

### 5.3 Name suspension and appeals

- A guardian can suspend a name for a sanctions match, confirmed fraud, or a
  valid court order.
- The suspension is a flag on the payee record. Payments to that name revert
  with `NameSuspended`; the payer sees a plain-language message.
- The payee can appeal through support. A second reviewer decides. The decision,
  reason code, and dates are audited.
- Reinstatement restores the name if the hash is still available. If not, the
  payee registers a new name and the receipt history keeps the old one.

### 5.4 Account suspension

- Off-chain only: block hosted writes, revoke API keys, disable webhooks, and
  show a notice.
- On-chain reads and direct contract calls remain possible; Ciro is not a
  custodian and cannot freeze a wallet.
- Evidence, notice, appeal, duration, and reviewer are recorded.
- A suspended account can still export its data and close its account.

### 5.5 Roles and governance

- `DEFAULT_ADMIN`: 3-of-5 multisig, no single EOA.
- `PAUSER`: 2-of-3 guardian multisig.
- `SUSPENDER`: 2-of-3 trust-and-safety multisig.
- `TREASURER`: fee recipient only; no pause or name power.
- Any role change is timelocked and announced.
- A public `security.txt` and status page list the current signers by role, not
  by personal details.

## 6. Control Room: stats and developer dashboard

The Control Room has two faces: a public stats page and a private operations
console. Both read the same indexer; neither can move funds.

### 6.1 Public stats page (`/stats`)

Aggregate only, no PII, minimum cohort size of 10 before a segment is shown.

- Service status: API uptime, current incident, chain head, indexer lag, RPC
  latency.
- Product: invoices created, invoices paid, settled volume, unique payees,
  unique payers, median time to first invoice.
- Name check: exact / close / unknown counts, and the share of pay attempts
  that were refused.
- Reliability: payment success rate, failed transaction rate, median
  confirmation time.
- Latest public receipts: amount, name, time, transaction hash; no payer
  address unless the receipt is already public on chain.
- Links: status page, changelog, API status, audit report.

### 6.2 Private operations console (`/admin`)

Roles: viewer, support, ops, trust-and-safety, admin, security. SSO plus
WebAuthn/2FA; IP allowlist for admin; every action requires a reason.

**Overview**

- Activation funnel: landing → connect → register → create → share → pay →
  receipt.
- Payments: volume, success rate, failed transactions, pending confirmations,
  gas spend.
- Chain: head, lag, RPC error rate, reorg watch, explorer health.
- API: requests, p50/p95/p99 latency, 4xx/5xx, rate-limit hits, top error codes.
- Indexer: lag, missing logs, reorg handling, backfill progress.
- Support: open tickets, time to first response, top issues.
- Cost: RPC, hosting, email, per-payment cost.

**Accounts**

- Search by address, name, invoice id, transaction hash, or email.
- Profile: payee name, registration state, suspension state, created date.
- Invoices and receipts with explorer links.
- Allowances: spender, cap, expiry, revoked.
- API keys, webhooks, notification endpoints, last seen.
- Actions: resend link, add a support note, suspend (with reason), delete
  off-chain account (two-person approval), export.

**Invoices and payments**

- Filter by status, due date, amount, payee, payer.
- View the exact on-chain state and the indexer's view; flag a mismatch.
- Cancel/void only when the payee has authorized it; support cannot mark paid.
- Failed payment triage: revert reason, gas, nonce, wallet, retry guidance.
- Reconciliation: compare chain events to the read model; repair with an
  audited job, never by editing a receipt.

**API and integrations**

- Key issuance, rotation, scopes, last used, rate limits.
- Webhook deliveries, retries, signatures, replay.
- SDK/CLI/MCP versions in use; deprecation notices.
- OpenAPI diff and breaking-change alerts.

**Trust and safety**

- Abuse reports, evidence, sanctions matches, suspension history, appeals.
- A decision log with reviewer, reason code, and dates.

**Feature flags and maintenance**

- Pause new registrations or invoices from the UI/API.
- Maintenance banner and status-page incident.
- Fee preview before a contract change; no silent fee change.
- Emergency links to the pause runbook and the multisig.

**Audit log**

Append-only. Actor, role, action, target, reason, before/after, timestamp,
request id. Exportable for an audit. No PII in the log.

### 6.3 Architecture

- Cloudflare Pages Functions for the API and the public stats endpoint.
- Postgres (Neon or Supabase) for accounts, API keys, webhooks, audit log, and
  the read model. D1 is acceptable for a single-region beta; Postgres is the
  mainnet target.
- Envio or The Graph for event indexing; a backfill job from the deployment
  block; reorg-safe checkpoints.
- Cloudflare KV/Redis for rate limits and idempotency keys.
- Sentry for errors, Logpush for structured logs, Grafana or Cloudflare
  Analytics for dashboards.
- Cloudflare Access for admin SSO; WebAuthn/2FA; no shared passwords.
- Synthetic checks every minute from two regions.
- Alerts: API 5xx > 1% for 5 min, p95 > 1s for 10 min, indexer lag > 60s, RPC
  error rate > 2%, payment failure spike, pause event, new admin login.

### 6.4 SLOs

| Signal | Target |
|---|---|
| API availability | 99.9% monthly |
| Read latency | p95 < 500 ms |
| Write preparation latency | p95 < 800 ms |
| Indexer lag | < 30 s p95 |
| Payment success (valid input) | > 99% |
| Incident acknowledgement | < 15 min |
| Status-page update | < 30 min from incident |

## 7. API and product work

- Accounts and teams: owner, admin, member; per-team API keys and audit log.
- Idempotency keys for every write; safe retries for wallet and API timeouts.
- Webhooks with HMAC signatures, retries, and a replay tool.
- OpenAPI 3.1, generated SDK types, versioned `/v2`.
- Pagination and cursor-based lists; remove the 100-row scan cap.
- Email and Telegram notifications: invoice sent, viewed, paid, overdue.
- Receipt PDF and CSV export; accounting exports for Xero/QuickBooks.
- Recurring invoices and reminders (v2.1, after the core is stable).
- Partial payments and credits (v3; they complicate the exact-amount rule).
- A hosted team dashboard and a read-only public invoice view.
- A mobile PWA; the current web app is responsive but not installable.

## 7.5 Growth backlog: v1 now, v2 next

The first four are in v1 now. Everything else is scheduled, not promised for
the hackathon. The go-to-market and pilot plan is in
[docs/growth/GTM.md](../growth/GTM.md).

| Growth item | v1 now | v2 phase | Success signal |
|---|---|---|---|
| Live invoice + add-network/faucet onboarding | Done | — | A first-time visitor reaches the pay screen without a funded wallet |
| Receipt CSV and print | Done | PDF in 2.1 | A payee files a receipt without a screenshot |
| MCP agent example and transcript | Done | x402 and scoped session keys in 2.3 | An agent prepares; a human signs |
| Pilot intake and GTM plan | Done | Case studies in phases 1–2 | 5–10 pilots, then 3 studies |
| QR codes and OG invoice previews | — | 2.1 | Shared-link click-through |
| Email and Telegram viewed/paid/overdue notices | — | 2.1 | Overdue recovery |
| Address book, saved clients, duplicate invoice | — | 2.1 | Time to repeat invoice |
| Receipt PDF and accounting export (Xero/QuickBooks) | — | 2.2 | Export adoption |
| Team accounts, roles, approvals, audit log | — | 2.2 | Team activation |
| Recurring invoices and reminders | — | 2.2 | Repeat conversion |
| Partial payments, credits, and refunds | — | 2.3 | Reconciliation completeness |
| Webhooks, embedded checkout, partner API | — | 2.2 | API adoption |
| PWA, WalletConnect, passkeys, smart accounts | — | 2.3 | Mobile completion |
| Agent x402 and scoped session keys | — | 2.3 | Agent-paid volume |
| Public stats and the Control Room | — | 2.1 | Trust and support load |
| SEO, templates, case studies, design partners | — | Ongoing | Organic traffic and pipeline |
| Team pricing and the fee experiment | — | 2.3 | Net revenue per paid invoice |

## 8. Growth and mainnet

- **Mainnet:** QDay mainnet is scheduled for Q1 2027. Deploy the audited v2
  contract with the mainnet stablecoin, a fee of 0.2–0.5%, and a published
  migration guide.
- **First users:** freelancers, contractors, small suppliers, and agencies that
  already invoice in stablecoins; QDay builders; DAOs paying contributors.
- **Distribution:** QDay ecosystem, accountant and bookkeeper referrals,
  templates for common invoices, API/MCP integrations, and a design-partner
  program with 10 agencies.
- **Monetization:** settlement fee on paid invoices; free reads, SDK, CLI, and
  MCP; paid team plan for API keys, webhooks, exports, and support.
- **Trust:** audit v2, bug bounty, status page, incident reports, and a public
  security.txt.
- **Metrics:** time to first invoice, invoice-to-payment conversion, repeat
  payees, API adoption, support tickets per 100 invoices, and net revenue per
  paid invoice.

## 9. Delivery phases

### Phase 0 — hackathon (now to 11 Dec 2026)

- Ship the final demo, README, screenshots, and submission copy.
- No contract changes.
- Public stats can start as a static page fed by the API; the full Control Room
  is v2.

### Phase 1 — beta operations (Dec 2026 to Jan 2027)

- Indexer and paginated read model.
- Public `/stats` page.
- Read-only `/admin` console with accounts, invoices, payments, API usage, and
  audit log.
- Off-chain account deletion with export and grace period.
- Status page, Sentry, synthetic checks, on-call rota.

### Phase 2 — contract v2 (Jan to Feb 2027)

- Audit the v2 contract: cancel/void, name deactivation, pause, fee switch,
  event snapshot, paid flag, non-ASCII rule.
- Deploy to Aevum testnet; migration window; UI support for both contracts.
- Name suspension and appeal runbook; guardian multisig.
- End-to-end account deletion including on-chain deactivation.
- Admin actions with two-person approval and audit.

### Phase 3 — mainnet (Q1 2027)

- Mainnet deployment, fee, stablecoin support, team plan.
- Design-partner onboarding and a public launch.
- Incident review and a second audit before scale.

## 10. Acceptance criteria

- A user can delete their account and see exactly what remains on chain.
- A payee can cancel an open invoice and cannot cancel a paid one.
- A guardian can pause new invoices and registrations; a payer can still read
  every receipt; no pause path can move funds.
- A suspended name cannot receive a new payment, and the appeal is auditable.
- The public stats page shows aggregate volume and reliability without PII.
- The admin console can answer "why did this payment fail?" in under two
  minutes, with a transaction hash and a revert reason.
- Every admin action has an actor, a reason, and a before/after record.
- The indexer lag is under 30 seconds at p95, and a mismatch between chain and
  read model is detectable and repairable.
