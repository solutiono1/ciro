import test from "node:test";
import assert from "node:assert/strict";
import { FAUCET_TREASURY, QDAY_DISCORD_URL, faucetEmptyHtml } from "../src/faucet-fallback.js";

test("an exhausted faucet offers Discord before the treasury", () => {
  const html = faucetEmptyHtml("https://explorer-test.qday.info/address/0xabc");
  assert.match(html, /Ciro faucet is empty/);
  assert.ok(html.indexOf(QDAY_DISCORD_URL) < html.indexOf(FAUCET_TREASURY));
  assert.match(html, /\/faucet 0xYourAddress/);
  assert.match(html, /test tUSD8 or tQDAY/);
  assert.match(html, /Testnet only/);
  assert.match(html, /explorer-test\.qday\.info\/address\/0xabc/);
});

test("the treasury still renders without an explorer link", () => {
  const html = faucetEmptyHtml();
  assert.match(html, new RegExp(FAUCET_TREASURY));
  assert.doesNotMatch(html, /href="null"/);
});
