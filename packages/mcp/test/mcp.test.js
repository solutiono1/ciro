import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { sendUnsigned, startFixture } from "../../api/support/fixture.js";

const bin = fileURLToPath(new URL("../bin/ciro-mcp.js", import.meta.url));
const DUE = BigInt(Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60);

class Session {
  constructor(env) {
    this.child = spawn(process.execPath, [bin], { env });
    this.pending = [];
    this.buffer = "";
    this.stderr = "";
    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString();
      let index;
      while ((index = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, index);
        this.buffer = this.buffer.slice(index + 1);
        if (!line.trim()) continue;
        this.pending.push(JSON.parse(line));
      }
    });
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk.toString();
    });
    this.nextId = 1;
  }

  request(method, params) {
    const id = this.nextId++;
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return this.wait(id);
  }

  async wait(id) {
    const started = Date.now();
    while (Date.now() - started < 10_000) {
      const index = this.pending.findIndex((message) => message.id === id);
      if (index >= 0) return this.pending.splice(index, 1)[0];
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`timed out waiting for ${id}: ${this.stderr}`);
  }

  stop() {
    this.child.kill("SIGTERM");
  }
}

function toolText(message) {
  return message.result.content[0].text;
}

test("mcp prepares a payment and does not sign or echo a key", async (t) => {
  const fx = await startFixture();
  const planted = `0x${"11".repeat(32)}`;
  const session = new Session({
    ...process.env,
    CIRO_API_URL: fx.apiUrl,
    CIRO_PRIVATE_KEY: planted,
  });
  t.after(() => {
    session.stop();
    return fx.stop();
  });

  const payee = fx.signer(1);
  let res = await fx.api("POST", "/v1/tx/register", { name: "Elena Rossi" });
  await sendUnsigned(payee, fx.publicClient, res.json);
  res = await fx.api("POST", "/v1/tx/invoice", {
    amount: "1000000",
    reference: "March design",
    due: DUE.toString(),
  });
  await sendUnsigned(payee, fx.publicClient, res.json);

  const init = await session.request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "ciro-test", version: "0" },
  });
  assert.equal(init.result.serverInfo.name, "ciro");

  const listed = await session.request("tools/list", {});
  const names = listed.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, ["ciro_check", "ciro_prepare_invoice", "ciro_prepare_pay", "ciro_receipt"]);
  assert.equal(names.includes("ciro_sign"), false);

  const exact = await session.request("tools/call", {
    name: "ciro_check",
    arguments: { payee: fx.accounts[1].address, name: "Elena Rossi", privateKey: planted },
  });
  assert.equal(exact.result.isError, false);
  assert.equal(JSON.parse(toolText(exact)).result, "exact");
  assert.equal(toolText(exact).includes(planted), false);
  assert.equal(session.stderr.includes(planted), false);

  const refused = await session.request("tools/call", {
    name: "ciro_prepare_pay",
    arguments: { id: "1", name: "Elena Rossa", privateKey: planted },
  });
  assert.equal(refused.result.isError, true);
  const refusedBody = JSON.parse(toolText(refused));
  assert.equal(refusedBody.error, "name_mismatch");
  assert.equal(refusedBody.result, "close");
  assert.equal("data" in refusedBody, false);
  assert.equal(toolText(refused).includes(planted), false);

  const prepared = await session.request("tools/call", {
    name: "ciro_prepare_pay",
    arguments: { id: "1", name: "Elena Rossi" },
  });
  assert.equal(prepared.result.isError, false);
  const preparedBody = JSON.parse(toolText(prepared));
  assert.match(preparedBody.data, /^0x/);
  assert.equal(preparedBody.summary, "Pay invoice 1, 1.000000 tUSD8, fee 0");
  assert.equal(JSON.stringify(prepared.result).includes("privateKey"), false);

  const receipt = await session.request("tools/call", {
    name: "ciro_receipt",
    arguments: { id: "1" },
  });
  assert.equal(receipt.result.isError, true);
  assert.equal(JSON.parse(toolText(receipt)).error, "not_paid");
});
