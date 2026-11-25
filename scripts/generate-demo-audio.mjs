// Writes the voiceover script for ElevenLabs, one file per scene, plus an SSML
// version and the target timings from the same timeline the recorder uses.
//
// Usage, from the repo root:
//   node scripts/generate-demo-audio.mjs
//
// It does not call ElevenLabs. It prepares the text and the timing, so you can
// generate each scene with the same voice and send the audio back for the edit.

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES, TOTAL_SECONDS } from "./demo-timeline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "demo/voiceover");

const xml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const cues = [];
let start = 0;

for (const [index, scene] of SCENES.entries()) {
  const number = String(index + 1).padStart(2, "0");
  const end = start + scene.target;
  await writeFile(path.join(outDir, `scene-${number}.txt`), `${scene.narration}\n`);
  cues.push({
    number,
    id: scene.id,
    title: scene.title,
    file: `scene-${number}.txt`,
    targetStart: start,
    targetEnd: end,
    targetSeconds: scene.target,
    narration: scene.narration,
  });
  start = end;
}

const allText = SCENES.map((scene, index) => {
  const number = String(index + 1).padStart(2, "0");
  return `## ${number} ${scene.title}\n\n${scene.narration}`;
}).join("\n\n");

const ssml = `<speak>\n${SCENES.map(
  (scene) => `  <p>${xml(scene.narration)}</p>\n  <break time="0.8s"/>`,
).join("\n")}\n</speak>\n`;

const readme = `# Ciro demo voiceover

Target length: **${Math.floor(TOTAL_SECONDS / 60)}m ${TOTAL_SECONDS % 60}s**.

Generate each scene separately in ElevenLabs, with the same voice, model, and
stability settings for all seven clips. Use the files in this order:

${cues.map((cue) => `- \`${cue.file}\` - ${cue.title} (${cue.targetSeconds}s target)`).join("\n")}

Export **WAV 44.1 kHz** or **MP3 320 kbps**. Name the files
\`scene-01.wav\` through \`scene-07.wav\`. Keep the voice close to the target
durations, but do not cut words to hit a number. The video edit will trim the
holds to the real clip lengths.

The recorder writes \`demo/video-cues.json\` with the matching scene starts. Send
the seven audio files back and I will concatenate them, level them, and mux them
against the silent recording.
`;

await writeFile(path.join(outDir, "all.txt"), `${allText}\n`);
await writeFile(path.join(outDir, "all.ssml"), ssml);
await writeFile(path.join(outDir, "cues.json"), `${JSON.stringify({ totalSeconds: TOTAL_SECONDS, cues }, null, 2)}\n`);
await writeFile(path.join(outDir, "README.md"), readme);

process.stdout.write(`Wrote ${outDir}\n`);
process.stdout.write(`Target ${Math.floor(TOTAL_SECONDS / 60)}m ${TOTAL_SECONDS % 60}s\n`);
for (const cue of cues) {
  process.stdout.write(`${cue.file}\t${cue.targetSeconds}s\t${cue.title}\n`);
}
