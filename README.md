# opencode-voice

An [OpenCode](https://opencode.ai) plugin that adds text-to-speech capabilities to your agent. Works out of the box on macOS — **no API keys, no accounts, no billing, no configuration required**.

https://x.com/placeholder-demo-link

## What's Changed

**macOS `say` is now the default engine — zero config required**

The plugin has been updated to work immediately after install with no external dependencies:

* **Default fallback is macOS `say` CLI.** If no ElevenLabs API key is configured, the plugin automatically uses the built-in macOS `say` command for text-to-speech. No setup step, no secrets file, no signup.
* **No API keys needed.** The `speak` tool works right away. ElevenLabs is now strictly optional — add `~/.config/opencode/secrets/elevenlabs-key` only if you want expressive v3 voices.
* **Same API, both modes.** Audio tags like `[excited]`, `[laughs]`, `[whispers]` are stripped automatically when using `say`, so existing prompts work cleanly in either mode.
* **Smart fallback chain:** ElevenLabs v3 → macOS `say` → macOS notification via `osascript` when system volume is muted.
* **Optional voice selection for `say`.** Create `~/.config/opencode/secrets/elevenlabs-voice` with a macOS voice name like `Alex`, `Samantha`, `Daniel`, or `Karen` to customize. Delete or leave empty for system default. List voices with `say -v '?'`.
* **Setup script simplified.** No longer requires API key input — it clones, installs Bun deps, updates OpenCode config, and you're done. ElevenLabs key prompt is now optional / skippable.

> Install it and it speaks. Add an ElevenLabs key later only if you want the fancy expressive voices with audio tags.

## Features

- **Zero Config** — No API keys, accounts, or billing. Works immediately on macOS after install.
- **macOS Native fallback** — Uses built-in `say` command by default. Uses `afplay` only when ElevenLabs audio is returned.
- **Optional ElevenLabs v3** — Drop in an API key to auto-upgrade to expressive TTS with emotion tags. No code changes needed.
- **Audio Tags** — `[laughs]` `[sighs]` `[excited]` `[whispers]` etc. work in ElevenLabs mode, stripped gracefully in `say` mode.
- **Non-blocking** — Spawns audio in background, returns immediately.
- **Volume-aware** — Falls back to macOS notification if output volume is 0.

## Quick Install

Run this one-liner:

```bash
curl -fsSL https://raw.githubusercontent.com/anomalyco/opencode-voice/main/setup.sh | bash
```

The setup script will:
- Clone the plugin to `~/dev/opencode-voice`
- Install dependencies with Bun
- Update your OpenCode config to register the plugin

No API key prompt required. Restart OpenCode and use `speak()` right away.

## Manual Installation

<details>
<summary>Click to expand manual steps</summary>

1. Clone plugin:
```bash
git clone https://github.com/anomalyco/opencode-voice.git ~/dev/opencode-voice
cd ~/dev/opencode-voice
bun install
```

2. Register in OpenCode config `~/.config/opencode/opencode.json`:
```json
{
  "plugin": [
    "file:///Users/YOUR_USERNAME/dev/opencode-voice"
  ]
}
```

3. Restart OpenCode. Done — `speak` uses macOS `say` by default.

**Optional: enable ElevenLabs v3**

Only for expressive voices:

```bash
mkdir -p ~/.config/opencode/secrets
echo "YOUR_API_KEY" > ~/.config/opencode/secrets/elevenlabs-key
chmod 600 ~/.config/opencode/secrets/elevenlabs-key
```

Get key at https://elevenlabs.io/app/settings/api-keys . Plugin auto-detects on next call.

Optional fallback voice for `say`:
```bash
echo "Samantha" > ~/.config/opencode/secrets/elevenlabs-voice
# list: say -v '?'
```

</details>

## Usage

```ts
speak("[excited] Hello! [laughs] This is amazing!")
speak("[whispers] Something's coming... [sighs] I can feel it.")
speak("[dramatically] The code is complete.")
```

In `say` fallback mode tags are stripped automatically — you'll hear clean speech. In ElevenLabs mode tags control emotion.

### Audio Tags — ElevenLabs v3 only, stripped in fallback

| Category | Examples |
|----------|----------|
| Emotions | `[laughs]`, `[sighs]`, `[excited]`, `[sad]`, `[angry]`, `[happily]`, `[sarcastic]`, `[curious]` |
| Delivery | `[whispers]`, `[shouts]`, `[dramatically]`, `[calmly]`, `[nervously]` |
| Reactions | `[laughs harder]`, `[giggles]`, `[clears throat]`, `[gasps]`, `[gulps]` |
| Accents | `[strong French accent]`, `[British accent]`, `[Southern US accent]` |
| Sound FX | `[applause]`, `[gunshot]`, `[explosion]` |

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | string | required | Text with optional audio tags |
| `stability` | 0-1 | 0.5 | ElevenLabs only: lower = more expressive |
| `similarity_boost` | 0-1 | 0.75 | ElevenLabs only: voice similarity |
| `speed` | 0.5-2.0 | 1.0 | ElevenLabs only: speech speed |
| `volume` | 0-2 | 1.0 | Playback volume for both engines |

### Best Practices

- Use in short bursts for important state changes
- Good for: task completion, errors, questions needing input
- Keep concise — 1 to 2 sentences

Examples:
- `[excited] Done! The build succeeded.`
- `[curious] Should I proceed with the refactor?`
- `[sighs] I found 3 errors we need to fix.`
- `[whispers] Heads up — about to make a breaking change.`

## Configuration

### No configuration needed by default

Out of the box uses macOS `say`. No files, no env vars.

### Optional ElevenLabs

* API key path — optional: `~/.config/opencode/secrets/elevenlabs-key`
* Voice ID — edit `src/plugin.ts`: `const VOICE_ID = "YOq2y2Up4RgXP2HyXjE5"`
* Fallback voice for say — optional: `~/.config/opencode/secrets/elevenlabs-voice` with macOS voice name

If key file is missing or empty, plugin silently uses `say`. No errors.

## Fallback Behavior Explained

1. **ElevenLabs v3** — if API key exists and non-empty. Full tags, expressive model, saved to temp mp3, played via `afplay`.
2. **macOS `say`** — default. No key needed. Strips `[tags]`, sanitizes, spawns `say -v Voice? text` non-blocking detached.
3. **macOS notification** — if `osascript` reports output volume 0. Displays notification titled "Speak" via `osascript`.

All return `<speak_started>` immediately.

## Requirements

- macOS — uses built-in `say`, `afplay`, `osascript`. No extra installs.
- [Bun](https://bun.sh) runtime
- ElevenLabs API key — **optional only**. Not required for basic TTS functionality.

## License

MIT
