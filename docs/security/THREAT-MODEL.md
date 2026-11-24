# Threat model

Confirmed from the PRD and architecture as of 2026-11-21. This is not a pentest.

## Assets

- The payer's tUSD8.
- The payee's registered name and invoices.
- Any local CLI key file on the operator's machine.

## What the server must not have

The API, the MCP server, and any future web host must not accept a private key, store one, or broadcast a transaction on the user's behalf. They return unsigned transactions. The CLI signs only with a key file the operator points at, and it does not print that key.

## Accepted behavior

- Anyone who knows an open invoice id can pay it with `pay`. That is the client paying the link. It is not a bug.
- A refused name reverts and leaves no payment event.
- The registered display name is public. Registration is the payee publishing the name they want payers to match.
- The allowance path can move the spender's tUSD8 only to the payee on that payee's invoices, up to the remaining cap, until expiry. It cannot transfer to an arbitrary address. The cap limits `payFromAllowance`, not a spender who chooses `pay` with its own wallet.
- A name is a confirmation check, not a global identity. Two payees can register the same name, so the payee address is shown on the pay page and the receipt.
- Non-ASCII names are rejected by the app and API. A direct contract call can still register one; the app refuses to pay an invoice whose stored name contains non-ASCII characters.
- Fee basis points are set at deploy and capped in the constructor. The contest deploy uses zero.

## Out of scope for v1

Issuer freeze of tUSD8, phishing of a wallet, a compromised machine with the CLI key, and chain reorgs. We do not claim to solve those.
