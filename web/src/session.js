const API_KEY = "ciro.apiUrl";
const RPC_KEY = "ciro.rpcUrl";

// The live Aevum deployment. The web pins these addresses so a compromised
// API cannot move a signature to another contract or token.
export const AEVUM = {
  chainId: 44005,
  contract: "0x4aceb37ecace160b4363111460020c2d088c529c",
  token: "0x456569838f1d43009a91eba4263147afd7233483",
};

export function aevumDeployment(chainId) {
  return Number(chainId) === AEVUM.chainId ? AEVUM : null;
}

export function deploymentFor(chainId, meta = session.meta) {
  const pinned = aevumDeployment(chainId);
  if (pinned) return pinned;
  if (meta && Number(meta.chainId) === Number(chainId)) {
    return { chainId: Number(meta.chainId), contract: meta.contract, token: meta.token };
  }
  return null;
}

export const session = {
  account: null,
  chainId: null,
  meta: null,
  payee: null,
};

export function apiUrl() {
  const saved = localStorage.getItem(API_KEY);
  if (saved) return saved.replace(/\/$/, "");
  const baked = import.meta.env.VITE_API_URL;
  if (baked) return String(baked).replace(/\/$/, "");
  return "http://127.0.0.1:8787";
}

export function rpcUrl() {
  const saved = localStorage.getItem(RPC_KEY) || import.meta.env.VITE_RPC_URL || "";
  if (saved) return String(saved).replace(/\/$/, "");
  if (session.meta?.chainId === 44005) return "https://rpc-test.qday.info";
  return "";
}

export function setEndpoints(api, rpc) {
  localStorage.setItem(API_KEY, api.replace(/\/$/, ""));
  if (rpc) localStorage.setItem(RPC_KEY, rpc.replace(/\/$/, ""));
  else localStorage.removeItem(RPC_KEY);
}

export function chainName(id) {
  if (id === 44005) return "Aevum";
  if (id == null) return "No network";
  return `Chain ${id}`;
}

export function explorerTx(hash) {
  if (session.meta?.chainId !== 44005 || !hash) return null;
  return `https://explorer-test.qday.info/tx/${hash}`;
}

export function explorerAddress(address) {
  if (session.meta?.chainId !== 44005 || !address) return null;
  return `https://explorer-test.qday.info/address/${address}`;
}

export function faucetUrl() {
  return session.meta?.chainId === 44005 ? "https://faucet.qday.info/en" : null;
}

export function networkParams() {
  const id = session.meta?.chainId;
  if (!id) throw new Error("The Ciro API has not loaded the network yet.");
  // A wallet will only add a network it can reach over HTTPS. The real chain is
  // Aevum (44005). A local fixture exposes an http://127.0.0.1 RPC that a real
  // wallet rejects, so we refuse it here with a clear message instead of
  // handing the wallet an invalid URL.
  if (id !== 44005) {
    throw new Error(`Add network works on Aevum testnet. This build points at chain ${id}, which a real wallet cannot join.`);
  }
  return {
    chainId: `0x${id.toString(16)}`,
    chainName: "Aevum",
    nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
    rpcUrls: ["https://rpc-test.qday.info"],
    blockExplorerUrls: ["https://explorer-test.qday.info"],
  };
}
