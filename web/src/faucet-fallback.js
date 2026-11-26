// Shown only when the Ciro treasury is empty. The QDay Discord faucet comes
// first; the treasury address is a testnet-only way for volunteers to refill
// the shared faucet. This module stays pure so the copy can be tested.
export const QDAY_DISCORD_URL = "https://discord.gg/bYPhjmrSfK";
export const FAUCET_TREASURY = "0x09257929772176E9c832fC8056A0d9913Ef77a13";

export function faucetEmptyHtml(explorerHref = null) {
  const treasury = explorerHref
    ? `<a class="mono" href="${explorerHref}" target="_blank" rel="noopener">${FAUCET_TREASURY}</a>`
    : `<span class="mono">${FAUCET_TREASURY}</span>`;
  return `<span class="faucet-empty">`
    + "<strong>The Ciro faucet is empty right now.</strong>"
    + `<span>Use the QDay Discord faucet first: <a href="${QDAY_DISCORD_URL}" target="_blank" rel="noopener">join the QDay Discord</a> and run <code>/faucet 0xYourAddress</code>.</span>`
    + `<span>If you want to help refill Ciro for everyone, send test tUSD8 or tQDAY to ${treasury} on Aevum. Testnet only.</span>`
    + "</span>";
}
