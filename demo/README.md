# Ciro demo pipeline

The demo has two layers: a silent recording of the real site and a separate
voiceover. Both use the same seven-scene timeline in
`scripts/demo-timeline.mjs`, so the scene boundaries line up in the edit.

## 1. Voiceover

```bash
node scripts/generate-demo-audio.mjs
```

This writes `demo/voiceover/`:

- `scene-01.txt` through `scene-07.txt`, one scene per file.
- `all.txt` and `all.ssml`.
- `cues.json`, with the target scene starts and lengths.
- `README.md`, with the ElevenLabs instructions.

Generate each scene separately with the same voice and settings. Export WAV
44.1 kHz or MP3 320 kbps. Send the seven files back. The target is 2m 50s, but
the real clip lengths win; the edit trims the video holds to the audio.

## 2. Silent video

```bash
node scripts/record-demo-video.mjs
```

This records the live site at `https://ciro-a9s.pages.dev`, not a mockup:

- 1440x810, 30 fps, no audio.
- A fresh ephemeral payee key is created in memory and funded with tQDAY from
  the deployer for gas.
- The deployer in `.deploy-key` is the payer. It needs at least 1.0 tUSD8 and
  gas for the payment.
- The payee registers `Ada Okonkwo`, creates a 1.0 tUSD8 invoice, switches to the
  payer, types a close name, shows no pay button, then the exact name, pays, and
  opens the verified receipt.
- The final scene shows the public developers page with the published API, CLI,
  MCP, and SDK.

Outputs:

- `demo/ciro-demo-silent.webm`
- `demo/ciro-demo-silent.mp4`
- `demo/video-cues.json` (scene starts relative to the recording)

The media and cue file are gitignored. The first 4.4 seconds are page load; the
timeline starts at the landing scene. If Chromium fails with
`libnspr4.so: cannot open shared object file` on WSL, install the Playwright
system dependencies once with `sudo npx playwright install-deps chromium`, or
point `LD_LIBRARY_PATH` at an extracted copy of the NSS/NSPR libraries.

## 3. Edit after the audio arrives

1. Trim the silent recording to the first scene start in `video-cues.json`.
2. Put the scene audio in timeline order.
3. For each scene, trim or hold the matching video segment to the real audio
   clip length. Keep the close-name and receipt holds long enough to read.
4. Add a short gap between scenes, level the voice to broadcast loudness, and
   mux H.264 video with AAC audio.
5. Output `demo/ciro-demo-final.mp4`.

The final file stays local for the DoraHacks upload unless it is small enough to
host beside the landing media.
