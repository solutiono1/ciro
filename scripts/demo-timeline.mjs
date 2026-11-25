// One timeline for the silent screen recording and the ElevenLabs voiceover.
//
// The recorder holds each scene for its target duration. The voiceover script
// writes one file per scene, so the editor can line each audio clip up with the
// matching video scene and trim the hold to the clip length.

export const SCENES = [
  {
    id: "landing",
    title: "The wrong-name problem",
    target: 16,
    narration:
      "A stablecoin payment knows the amount and the address. It does not know the invoice, the reference, or the name you agreed on. When the name is wrong, a person fixes it by hand. The transfer is final. Ciro makes the name the check.",
  },
  {
    id: "register",
    title: "Register the name",
    target: 20,
    narration:
      "The payee registers the name they want to be paid under. Capitals and extra spaces still match. Ciro folds the name, then writes it to the contract. The name is public. The wallet signs the registration, and Ciro never holds a key.",
  },
  {
    id: "create",
    title: "Create the invoice",
    target: 24,
    narration:
      "The invoice locks the amount, the reference, the due date, and the name. The payer does not set the amount. They only have to type the name they were told. A later name change does not rewrite an open invoice.",
  },
  {
    id: "close",
    title: "A close name does not pay",
    target: 26,
    narration:
      "This is the only decision. A close name looks plausible, but it does not match. Close means the initials and word count match and the length is within two characters. It still does not pay. There is no pay button, and the contract refuses it. The money does not move.",
  },
  {
    id: "pay",
    title: "The exact name pays",
    target: 32,
    narration:
      "The exact name matches. The amount is already locked. The payer sees the amount and the fee before signing. The wallet approves the exact amount, then signs the payment. The contract pulls it from the payer and sends it to the payee. The invoice is paid once.",
  },
  {
    id: "receipt",
    title: "The receipt",
    target: 24,
    narration:
      "The receipt carries the payer, the payee, the amount, and the transaction hash. Ciro reads the payment from the chain, not from a database. There is no database to trust. The transaction hash opens on the Aevum explorer.",
  },
  {
    id: "tools",
    title: "Build and safety",
    target: 28,
    narration:
      "The API, the CLI, the MCP server, and the SDK are published. The API and the MCP never hold a key. The CLI signs locally with a key you own. This is testnet only. Ciro holds no funds, and the contract is the record. The source is verified.",
  },
];

export const TOTAL_SECONDS = SCENES.reduce((sum, scene) => sum + scene.target, 0);

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(
    `${SCENES.length} scenes, ${TOTAL_SECONDS}s target (${Math.floor(TOTAL_SECONDS / 60)}m ${TOTAL_SECONDS % 60}s)\n`,
  );
  for (const scene of SCENES) {
    process.stdout.write(`${scene.id}\t${scene.target}s\t${scene.title}\n`);
  }
}
