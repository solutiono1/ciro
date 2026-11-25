# Ciro demo voiceover

Target length: **2m 50s**.

Generate each scene separately in ElevenLabs, with the same voice, model, and
stability settings for all seven clips. Use the files in this order:

- `scene-01.txt` - The wrong-name problem (16s target)
- `scene-02.txt` - Register the name (20s target)
- `scene-03.txt` - Create the invoice (24s target)
- `scene-04.txt` - A close name does not pay (26s target)
- `scene-05.txt` - The exact name pays (32s target)
- `scene-06.txt` - The receipt (24s target)
- `scene-07.txt` - Build and safety (28s target)

Export **WAV 44.1 kHz** or **MP3 320 kbps**. Name the files
`scene-01.wav` through `scene-07.wav`. Keep the voice close to the target
durations, but do not cut words to hit a number. The video edit will trim the
holds to the real clip lengths.

The recorder writes `demo/video-cues.json` with the matching scene starts. Send
the seven audio files back and I will concatenate them, level them, and mux them
against the silent recording.
