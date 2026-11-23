import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { tokenAbi } from "../../api/src/abi.js";
import { startFixture } from "../../api/support/fixture.js";

const bin = fileURLToPath(new URL("../bin/ciro.js", import.meta.url));

function run(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], {
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function writeKey(dir, name, key, mode) {
  const file = join(dir, name);
  writeFileSync(file, `${key}\n`, { mode: 0o600 });
  chmodSync(file, mode);
  return file;
}

test("a world-readable key is refused and not printed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ciro-key-"));
  const key = `0x${"ab".repeat(32)}`;
  const keyPath = writeKey(dir, "open.key", key, 0o644);
  const config = join(dir, "config.json");
  writeFileSync(config, JSON.stringify({
    apiUrl: "http://127.0.0.1:9",
    rpcUrl: "http://127.0.0.1:9",
    chainId: 31337,
    keyPath,
  }));
  const result = await run(["register", "Ada Okonkwo", "--yes"], { CIRO_CONFIG: config, HOME: dir });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /mode 0600/);
  assert.equal(result.stdout.includes(key), false);
  assert.equal(result.stderr.includes(key), false);
  assert.equal(result.stdout.includes("ab".repeat(32)), false);
  assert.equal(result.stderr.includes("ab".repeat(32)), false);
});

test("cli signs locally and will not sign a close name", async (t) => {
  const fx = await startFixture();
  t.after(() => fx.stop());
  const dir = mkdtempSync(join(tmpdir(), "ciro-cli-"));
  const payeeKey = writeKey(dir, "payee.key", fx.keys[1], 0o600);
  const payerKey = writeKey(dir, "payer.key", fx.keys[2], 0o600);
  const configPath = join(dir, "config.json");
  const writeConfig = (keyPath) => {
    writeFileSync(configPath, JSON.stringify({
      apiUrl: fx.apiUrl,
      rpcUrl: fx.rpcUrl,
      chainId: 31337,
      keyPath,
    }));
  };
  const env = { CIRO_CONFIG: configPath, HOME: dir };
  writeConfig(payeeKey);

  let result = await run(["register", "Ada Okonkwo", "--yes"], env);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Register "Ada Okonkwo"/);
  assert.match(result.stdout, /0x[0-9a-f]{64}/);
  assert.equal(result.stdout.includes(fx.keys[1]), false);
  assert.equal(result.stderr.includes(fx.keys[1]), false);

  result = await run([
    "invoice",
    "--amount",
    "1",
    "--reference",
    "March design",
    "--due",
    "2026-12-31",
    "--yes",
  ], env);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Create invoice for 1\.000000 tUSD8/);

  writeConfig(null);
  const checkConfig = join(dir, "check.json");
  writeFileSync(checkConfig, JSON.stringify({
    apiUrl: fx.apiUrl,
    rpcUrl: fx.rpcUrl,
    chainId: 31337,
  }));
  result = await run(["check", "--payee", fx.accounts[1].address, "--name", "Ada Okonkwa"], {
    CIRO_CONFIG: checkConfig,
    HOME: dir,
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout.trim(), "close");

  await fx.mint(2, 1_000_000n);
  writeConfig(payerKey);
  const before = await fx.publicClient.readContract({
    address: fx.token,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: [fx.accounts[2].address],
  });
  result = await run(["pay", "1", "--name", "Ada Okonkwa", "--yes"], env);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /name_mismatch close/);
  assert.equal(result.stdout.includes(fx.keys[2]), false);
  assert.equal(result.stderr.includes(fx.keys[2]), false);
  const afterRefusal = await fx.publicClient.readContract({
    address: fx.token,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: [fx.accounts[2].address],
  });
  assert.equal(afterRefusal, before);

  result = await run(["pay", "1", "--name", "Ada Okonkwo", "--yes"], env);
  assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /Pay invoice 1, 1\.000000 tUSD8, fee 0/);
  assert.equal(result.stdout.includes(fx.keys[2]), false);

  result = await run(["receipt", "1"], env);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Payee: Ada Okonkwo/);
  assert.match(result.stdout, /Amount: 1\.000000 tUSD8/);
  assert.match(result.stdout, /Transaction: 0x[0-9a-f]{64}/);
});
