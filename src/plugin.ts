import { tool, type Plugin } from "@opencode-ai/plugin";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawn, spawnSync } from "child_process";

/**
 * Voice ID for ElevenLabs TTS
 */
const VOICE_ID = "YOq2y2Up4RgXP2HyXjE5";

/**
 * ElevenLabs v3 model ID - most expressive with audio tag support
 */
const MODEL_ID = "eleven_v3";

/**
 * Path to the ElevenLabs API key secret file
 */
const API_KEY_PATH = join(
  process.env.HOME || "~",
  ".config/opencode/secrets/elevenlabs-key"
);

/**
 * Load API key from secrets file
 */
function loadApiKey(): string {
  try {
    return readFileSync(API_KEY_PATH, "utf-8").trim();
  } catch (error) {
    throw new Error(
      `Failed to read ElevenLabs API key from ${API_KEY_PATH}. ` +
        `Please create this file with your API key.`
    );
  }
}

/**
 * Play audio file using macOS afplay (non-blocking)
 */
function playAudio(filePath: string, volume: number): void {
  // Spawn afplay in background (non-blocking)
  const child = spawn("afplay", ["-v", String(volume), filePath], {
    detached: true,
    stdio: "ignore",
  });

  // Unref to allow parent process to exit independently
  child.unref();

  // Clean up temp file after playback completes
  child.on("exit", () => {
    try {
      unlinkSync(filePath);
    } catch {
      // Ignore cleanup errors
    }
  });
}

/**
 * Strip audio tags from text (e.g., [laughs], [excited], etc.)
 * These tags are only supported by ElevenLabs v3
 */
function stripAudioTags(text: string): string {
  return text.replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Validate voice name to prevent command injection
 * Only allows alphanumeric characters, spaces, hyphens, and parentheses
 */
function isValidVoiceName(voice: string): boolean {
  // Voice names like "Alex", "Samantha", "Daniel", "Fiona", "Moira", etc.
  // Also allow names with spaces like "Good News", "Bad News"
  return /^[a-zA-Z0-9\s\-()]+$/.test(voice) && voice.length <= 50;
}

/**
 * Sanitize text to remove potential shell metacharacters
 * While spawn() with array args is safe, this provides defense in depth
 */
function sanitizeText(text: string): string {
  // Remove null bytes and control characters (except newlines, tabs)
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Get the current system output volume (0-100).
 * Returns 50 (non-zero default) if unable to determine.
 */
function getSystemVolume(): number {
  try {
    const result = spawnSync("osascript", ["-e", "output volume of (get volume settings)"], {
      timeout: 2000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const vol = parseInt(result.stdout?.toString().trim() || "", 10);
    return isNaN(vol) ? 50 : vol;
  } catch {
    return 50;
  }
}

/**
 * Display a macOS notification via osascript (non-blocking).
 * Uses argv passing to prevent AppleScript injection.
 */
function notifyWithOsascript(text: string): void {
  const child = spawn("osascript", [
    "-e", "on run argv",
    "-e", 'display notification (item 1 of argv) with title "Speak"',
    "-e", "end run",
    "--", text,
  ], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

/**
 * Speak text using macOS say command (non-blocking fallback).
 * Falls back to a notification if system volume is zero.
 * Returns true if notification was used instead of speech.
 */
function speakWithSay(
  text: string,
  _volume: number,
  voice?: string
): boolean {
  const cleanText = stripAudioTags(text);
  const safeText = sanitizeText(cleanText);

  if (getSystemVolume() === 0) {
    notifyWithOsascript(safeText);
    return true;
  }

  let safeVoice: string | undefined;
  if (voice) {
    if (isValidVoiceName(voice)) {
      safeVoice = voice;
    } else {
      console.warn(`Invalid voice name rejected: ${voice}`);
      safeVoice = undefined;
    }
  }

  const args = safeVoice ? ["-v", safeVoice, safeText] : [safeText];
  const child = spawn("say", args, {
    detached: true,
    stdio: "ignore",
    shell: false,
  });
  child.unref();
  return false;
}

/**
 * Audio tag categories for reference in tool description
 */
const AUDIO_TAG_EXAMPLES = `
Audio Tags (v3 expressive features):
  Emotions: [laughs], [sighs], [whispers], [excited], [sad], [angry], [happily], [sarcastic], [curious]
  Delivery: [whispers], [shouts], [dramatically], [calmly], [nervously]
  Reactions: [laughs], [laughs harder], [giggles], [clears throat], [sighs], [gasps], [gulps]
  Accents: [strong French accent], [British accent], [Southern US accent]
  Sound FX: [applause], [gunshot], [explosion]

Example: "[whispers] Something's coming... [sighs] I can feel it."
Example: "[excited] We did it! [laughs] I can't believe it worked!"
`;

/**
 * The speak tool definition
 */
const speakTool = tool({
  description: `Convert text to speech using ElevenLabs v3 and play it on the device speakers (non-blocking).

Uses the expressive v3 model which supports inline audio tags for emotional control, 
delivery direction, non-verbal reactions, accents, and sound effects.

${AUDIO_TAG_EXAMPLES}

The audio plays in the background and control returns immediately.

USAGE GUIDANCE:
- Use in SHORT BURSTS to notify the user of important state changes
- Good for: task completion, errors requiring attention, questions needing user input
- Keep messages concise (1-2 sentences) - don't read entire responses aloud
- Examples of when to use:
  * "[excited] Done! The build succeeded."
  * "[curious] I have a question - should I proceed with the refactor?"
  * "[sighs] I found 3 errors we need to fix."
  * "[whispers] Heads up - I'm about to make a breaking change."`,

  args: {
    text: tool.schema
      .string()
      .describe(
        "The text to convert to speech. Can include audio tags like [laughs], [whispers], [excited], etc."
      ),

    stability: tool.schema
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        "Voice stability (0-1). Lower = more expressive/emotional range, higher = more consistent. Default: 0.5"
      ),

    similarity_boost: tool.schema
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        "How closely to match the original voice (0-1). Default: 0.75"
      ),

    speed: tool.schema
      .number()
      .min(0.5)
      .max(2.0)
      .optional()
      .describe("Speech speed multiplier (0.5-2.0). Default: 1.0"),

    volume: tool.schema
      .number()
      .min(0)
      .max(2)
      .optional()
      .describe("Playback volume (0-2). Default: 1.0"),
  },

  async execute(args) {
    const {
      text,
      stability = 0.5,
      similarity_boost = 0.75,
      speed = 1.0,
      volume = 1.0,
    } = args;

    // Load API key from secrets file
    const apiKey = loadApiKey();

    // If no API key, fall back to macOS say command or notification
    if (!apiKey) {
      const fallbackVoice = loadFallbackVoice();
      const usedNotification = speakWithSay(text, volume, fallbackVoice || undefined);

      const preview =
        text.length > 80 ? text.substring(0, 80) + "..." : text;

      if (usedNotification) {
        return `<speak_started>
Displayed notification (volume is muted): "${preview}"
Note: Using notification fallback (volume is 0, ElevenLabs API key not found)
</speak_started>`;
      }

      const voiceInfo = fallbackVoice ? ` (voice: ${fallbackVoice})` : "";
      return `<speak_started>
Playing speech with macOS say${voiceInfo} (non-blocking): "${preview}"
Note: Using fallback TTS (ElevenLabs API key not found)
</speak_started>`;
    }

    // Call ElevenLabs v3 API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: {
            stability,
            similarity_boost,
            style: 0,
            use_speaker_boost: true,
            speed,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ElevenLabs API error (${response.status}): ${errorText}`
      );
    }

    // Save audio to temp file
    const audioBuffer = await response.arrayBuffer();
    const tempFile = join(tmpdir(), `opencode-voice-${Date.now()}.mp3`);
    writeFileSync(tempFile, Buffer.from(audioBuffer));

    // Play audio in background (non-blocking)
    playAudio(tempFile, volume);

    // Return immediately with confirmation
    const preview =
      text.length > 80 ? text.substring(0, 80) + "..." : text;
    return `<speak_started>
Playing speech (non-blocking): "${preview}"
Voice: ${VOICE_ID}
Model: ${MODEL_ID} (v3 expressive)
</speak_started>`;
  },
});

/**
 * The main plugin export
 */
export const VoicePlugin: Plugin = async () => {
  return {
    tool: {
      speak: speakTool,
    },
  };
};
