# PRD

Product: Ciro. Status: planning, 2026-11-21.

## Problem

A stablecoin transfer is a sender, a receiver, and an amount. It does not carry the invoice, it does not check the name the payer was given, and it does not leave a receipt an accountant can file. When the amount is short, the name is wrong, the network is wrong, or the payment is late, a person repairs it by hand. The wrong network often cannot be repaired. The transfer is final.

People already pay 3–5% to collect a freelance invoice, or $25–$80 and one to three days for a contractor wire, or they pay a supplier in USDT and then cannot show the books. The chain fee is the cheap part. The missing record is the product.

## Who it is for

The first user is someone who gets paid in stablecoins and has to prove the payment: a freelancer, a contractor, a small supplier.

The payer is the client who opens the link. They are not a separate product.

A marketplace, a payroll tool, or an agent runtime is a later caller of the API. They are not the v1 screen.

## The one flow

1. The payee registers a display name against their address. The name is what a payer must type or confirm.
2. The payee creates an invoice: amount, reference, network, due time.
3. The payer opens the invoice. They see the registered name, the amount, the network, and the due time. They confirm the name.
4. The contract accepts the payment only when the confirmed name matches the registered name, the token amount is exact, the network is the invoice's network, and the due time has not passed.
5. Both sides can read a receipt: invoice id, amount, payer, payee name, network, transaction hash, time.

A second key, including an agent, may pay invoices for that payee only inside a cap and an expiry. The owner can revoke it. The cap is in the contract. The agent cannot withdraw.

## v1 includes

- Payee registration and a match result of exact, close, or none. Close does not pay. It warns.
- One invoice, one exact payment, one receipt.
- A link the payee can send.
- A web app a person can finish without reading a contract.
- An HTTP API and a CLI that perform the same flow.
- Fee parameter, set to zero on the testnet deployment.
- Settlement in tUSD8 on Aevum testnet.

## v1 excludes

- Card issuing, bank cash-out, and mobile-money payouts.
- Yield, savings buckets, and tax sweeps.
- Payroll batches and approval chains.
- Borrowing against bitcoin or any other collateral.
- A shielded pool or a new zero-knowledge circuit.
- ERC-4337, a paymaster, and ERC-8004.
- Custody of user funds.
- A token of our own.

## Done, for the contest

A judge can, on Aevum, with a wallet and faucet tokens:

- Register a name.
- Create an invoice and open it in a second session.
- See a matching name pay, and see a wrong name, a short amount, and a late invoice refuse.
- Read the receipt and the transaction on the explorer.
- Run the same happy path from the CLI.

## Done, for the company

A third party can create an invoice and learn that it was paid without hosting our website. That is the API. The CLI is the first proof. MCP and the SDK are the same API in two more shapes, after the API is stable.

## Fee

Shown before confirm. Zero on the contest deployment. 0.5% is the planned price on a priced deployment. A transfer that does not go through an invoice is not charged, because we never see it.

## Success that is not the prize

The $1,500 pool is not the business. The business is other tools calling the invoice. The contest is the first public proof that the match works on a real testnet.
