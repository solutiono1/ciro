import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { accessSync, constants, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bytesToHex, createPublicClient, createWalletClient, defineChain, http } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { createServer as createApi } from "../src/app.js";
import { tokenAbi } from "../src/abi.js";

// Anvil's published development mnemonic. These accounts are not secrets. Never use them on Aevum.
const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
export const ANVIL_KEYS = [0, 1, 2, 3, 4].map((index) =>
  bytesToHex(mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: index }).getHdKey().privateKey),
);

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function anvilPath() {
  const candidate = path.join(process.env.HOME ?? "", ".foundry", "bin", "anvil");
  try {
    accessSync(candidate, constants.X_OK);
    return candidate;
  } catch {
    return "anvil";
  }
}

function artifact(name) {
  const root = fileURLToPath(new URL("../../../contracts/out/", import.meta.url));
  return JSON.parse(readFileSync(path.join(root, name), "utf8"));
}

async function waitForRpc(rpcUrl) {
  const client = createPublicClient({ transport: http(rpcUrl) });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await client.getChainId();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("anvil did not start");
}

async function deploy(wallet, publicClient, file, args) {
  const json = artifact(file);
  const hash = await wallet.deployContract({
    abi: json.abi,
    bytecode: json.bytecode.object,
    args,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`deploy failed for ${file}`);
  }
  return receipt.contractAddress;
}

export async function sendUnsigned(wallet, publicClient, tx) {
  const hash = await wallet.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: BigInt(tx.value ?? 0),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`reverted: ${tx.summary}`);
  return receipt;
}

export async function startFixture() {
  const port = process.env.CIRO_FIXTURE_RPC_PORT ? Number(process.env.CIRO_FIXTURE_RPC_PORT) : await freePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const anvil = spawn(
    anvilPath(),
    ["--host", "127.0.0.1", "--port", String(port), "--chain-id", "31337"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let logs = "";
  anvil.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  anvil.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });
  try {
    await waitForRpc(rpcUrl);
  } catch (err) {
    anvil.kill("SIGTERM");
    throw new Error(`${err.message}\n${logs}`);
  }
  try {
    return await bootFixture(rpcUrl, anvil);
  } catch (err) {
    anvil.kill("SIGTERM");
    throw err;
  }
}

async function bootFixture(rpcUrl, anvil) {

  const chain = defineChain({
    id: 31337,
    name: "Anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const accounts = ANVIL_KEYS.map((key) => privateKeyToAccount(key));
  const deployer = createWalletClient({ account: accounts[0], chain, transport: http(rpcUrl) });
  const token = await deploy(deployer, publicClient, "MockUSD8.sol/MockUSD8.json", []);
  const ciro = await deploy(deployer, publicClient, "Ciro.sol/Ciro.json", [token, accounts[3].address, 0]);

  const api = createApi({ rpcUrl, address: ciro, chainId: 31337, startBlock: 0n });
  const wantedApiPort = process.env.CIRO_FIXTURE_API_PORT ? Number(process.env.CIRO_FIXTURE_API_PORT) : 0;
  await new Promise((resolve) => api.listen(wantedApiPort, "127.0.0.1", resolve));
  const apiAddress = api.address();
  const apiPort = typeof apiAddress === "object" && apiAddress ? apiAddress.port : 0;
  const apiUrl = `http://127.0.0.1:${apiPort}`;

  return {
    rpcUrl,
    apiUrl,
    chain,
    publicClient,
    token,
    ciro,
    keys: ANVIL_KEYS,
    accounts,
    async api(method, pathname, body) {
      const response = await fetch(`${apiUrl}${pathname}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await response.json();
      return { status: response.status, json };
    },
    signer(index) {
      return createWalletClient({ account: accounts[index], chain, transport: http(rpcUrl) });
    },
    async mint(index, amount) {
      const wallet = this.signer(index);
      const hash = await wallet.writeContract({
        address: token,
        abi: tokenAbi,
        functionName: "mint",
        args: [accounts[index].address, amount],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("mint failed");
    },
    async stop() {
      await new Promise((resolve) => api.close(resolve));
      anvil.kill("SIGTERM");
    },
  };
}
