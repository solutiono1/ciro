// Boots the local fixture chain + API, registers a payee, creates one invoice,
// funds two dev accounts, prints the details, and stays alive so the link works.
import { decodeEventLog, parseAbiItem } from "viem";
import { sendUnsigned, startFixture } from "./fixture.js";

const created = parseAbiItem(
  "event InvoiceCreated(uint256 indexed id, address indexed payee, uint256 amount, uint64 due, string memo)",
);

const fx = await startFixture();
const wallet = fx.signer(0);
const pub = fx.publicClient;
const payee = fx.accounts[0].address;

const reg = await fx.api("POST", "/v1/tx/register", { name: "Elena Rossi" });
if (reg.status !== 200) throw new Error("register failed: " + JSON.stringify(reg.json));
await sendUnsigned(wallet, pub, reg.json);

const inv = await fx.api("POST", "/v1/tx/invoice", {
  amount: "1000000",
  reference: "March design",
  due: "2026-12-31",
});
if (inv.status !== 200) throw new Error("invoice failed: " + JSON.stringify(inv.json));
const receipt = await sendUnsigned(wallet, pub, inv.json);

let id = null;
for (const log of receipt.logs ?? []) {
  try {
    const decoded = decodeEventLog({ abi: [created], data: log.data, topics: log.topics });
    if (decoded.eventName === "InvoiceCreated") id = decoded.args.id.toString();
  } catch {
    // not this event
  }
}

await fx.mint(0, 100_000_000n);
await fx.mint(1, 100_000_000n);

console.log("RESULT " + JSON.stringify({ apiUrl: fx.apiUrl, rpcUrl: fx.rpcUrl, payee, invoiceId: id }));
setInterval(() => {}, 1 << 30);
