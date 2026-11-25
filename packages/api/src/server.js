import { getAddress, isAddress } from "viem";
import { createServer } from "./node-server.js";

const rpcUrl = process.env.CIRO_RPC_URL;
const address = process.env.CIRO_ADDRESS;
const chainId = Number(process.env.CIRO_CHAIN_ID ?? "44005");
const startBlock = BigInt(process.env.CIRO_START_BLOCK ?? "0");
const explorerUrl = (process.env.CIRO_EXPLORER_URL ?? "").replace(/\/$/, "");

if (!rpcUrl || !address || !isAddress(address) || !Number.isInteger(chainId) || chainId <= 0) {
  process.stderr.write("CIRO_RPC_URL, CIRO_ADDRESS, and CIRO_CHAIN_ID are required\n");
  process.exit(1);
}

const port = Number(process.env.PORT ?? "8787");
const host = process.env.HOST ?? "127.0.0.1";
const server = createServer({
  rpcUrl,
  address: getAddress(address),
  chainId,
  startBlock,
  explorerUrl,
});

server.listen(port, host, () => {
  process.stdout.write(`ciro api http://${host}:${port}\n`);
});
