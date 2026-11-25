# MCP agent example

An agent can read a name, prepare an invoice, prepare a payment, and read a
receipt. It cannot sign. This example uses the published MCP server and the live
Ciro API.

From the repo root:

```bash
node examples/mcp-agent.mjs
```

Live output:

```text
server ciro 0.1.0
tools ciro_check, ciro_prepare_invoice, ciro_prepare_pay, ciro_receipt
check exact
prepare_invoice Create invoice for 1.000000 tUSD8, reference Agent invoice, due 2026-12-31T23:59:59Z
prepare_pay Pay invoice 10, 1.000000 tUSD8, fee 0
receipt Elena Rossi 1.000000 0x003e61d3f9f802792a25f5720b039d31d9bec7dcc29343a49c948f5134f396cd
The agent prepared only. No key was shared and no transaction was signed.
```

The example defaults to the live API and invoice 10. Override them with:

```bash
CIRO_API_URL=https://ciro-a9s.pages.dev/api CIRO_AGENT_INVOICE=10 node examples/mcp-agent.mjs
```

## What the agent can and cannot do

- `ciro_check` reads the name. It does not pay.
- `ciro_prepare_invoice` returns an unsigned create-invoice transaction.
- `ciro_prepare_pay` returns an unsigned pay transaction only when the name is
  exact. A close or unknown name returns an error and no transaction.
- `ciro_receipt` reads a paid receipt.

The MCP server has no key and no signer. A human wallet or the CLI with a local
key signs the returned transaction. For delegated payments, the payee can grant
a capped, expiring allowance; the agent can only pay that payee's invoices
inside the cap, and the payee can revoke it.

The example is an integration example, not a recorder. It does not contain a
private key and does not call `eth_sendTransaction`.
