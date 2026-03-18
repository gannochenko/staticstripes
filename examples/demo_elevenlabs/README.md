# ElevenLabs Karaoke Integration

This example demonstrates how to automatically generate karaoke-style videos using the ElevenLabs API for text-to-speech with word-level timing data.

## Overview

The integration uses the **ElevenLabs Text-to-Speech with Timestamps API** to:
1. Convert text to speech audio
2. Obtain precise word-level timing data
3. Generate a `project.html` file compatible with the karaoke_text app
4. Render the final video with synchronized text highlighting

## Prerequisites

- Node.js 16+ (for fetch API support)
- ElevenLabs API key ([get one here](https://elevenlabs.io))
- Built karaoke_text app (`npm run build` in `examples/apps/karaoke_text`)
- Built renderer (`npm run build` in `apps/renderer`)

## Setup

1. Set your ElevenLabs API key:

```bash
export ELEVENLABS_API_KEY="your_api_key_here"
```

2. Prepare a background image:

```bash
mkdir -p assets
# Add your background image as assets/bg.png
```

## Usage

### Basic Usage

Generate a karaoke video from text:

```bash
node generate-karaoke.js "A photon checks into a hotel. The bellhop asks, 'Can I help you with your luggage?' The photon replies, 'No thanks, I'm traveling light.'"
```

### Custom Voice

Specify a different ElevenLabs voice:

```bash
node generate-karaoke.js "Your text here" "voice_id_here"
```

### Render the Video

After generating the project file:

```bash
node ../../apps/renderer/dist/cli.js generate -o output
```

The rendered video will be available at `dst/output.mp4`.

## How It Works

### 1. Text-to-Speech with Timestamps

The script calls the ElevenLabs API endpoint:

```
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps
```

**Request:**
```json
{
  "text": "Your text here",
  "model_id": "eleven_multilingual_v2",
  "output_format": "mp3_44100_128",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}
```

**Response:**
```json
{
  "audio_base64": "...",
  "alignment": [
    {"character": "A", "start": 0.0, "end": 0.15},
    {"character": " ", "start": 0.15, "end": 0.15},
    {"character": "p", "start": 0.15, "end": 0.2},
    ...
  ]
}
```

### 2. Character-to-Word Conversion

The script converts character-level timing to word-level format:

```javascript
[
  {text: "A", start: 0, end: 0.15},
  {text: "photon", start: 0.15, end: 0.5},
  {text: "checks", start: 0.5, end: 0.9},
  ...
]
```

### 3. Project Generation

Creates a `project.html` file with:
- Word timing data in JSON format (with proper XML escaping)
- Audio asset reference
- Background image asset
- Synchronized durations

### 4. Chunk Detection

The karaoke_text app automatically:
- Detects pauses >200ms between words
- Splits text into chunks at pause boundaries
- Displays each chunk with independent paging window
- Hides text during pauses and after completion

## Alternative: Forced Alignment API

If you already have audio and transcript, you can use the **Forced Alignment API** instead:

```javascript
const { forcedAlignment } = require('./generate-karaoke.js');

const audioBuffer = fs.readFileSync('audio.mp3');
const transcript = "Your transcript here";
const words = await forcedAlignment(audioBuffer, transcript);
```

The Forced Alignment API returns word-level timing directly:

```
POST https://api.elevenlabs.io/v1/forced-alignment
```

**Response:**
```json
{
  "words": [
    {"text": "A", "start": 0.0, "end": 0.15, "loss": 0.05},
    {"text": "photon", "start": 0.15, "end": 0.5, "loss": 0.03},
    ...
  ]
}
```

## API Comparison

| Feature | TTS with Timestamps | Forced Alignment |
|---------|---------------------|------------------|
| **Input** | Text only | Audio + Text |
| **Output** | Audio + Timing | Timing only |
| **Timing Level** | Character-level | Word-level |
| **Use Case** | Generate new speech | Align existing audio |
| **Cost** | TTS + timing | Alignment only |

## Example Output

```
Generating speech with word-level timing...
Text: "A photon checks into a hotel."
Voice ID: 21m00Tcm4TlvDq8ikWAM

✓ Speech generated successfully
✓ 6 words detected

Word timing:
  1. "A" @ 0.00s - 0.15s
  2. "photon" @ 0.15s - 0.50s
  3. "checks" @ 0.50s - 0.90s
  4. "into" @ 0.90s - 1.20s
  5. "a" @ 1.20s - 1.35s
  6. "hotel." @ 1.35s - 1.80s

✓ Audio saved to: /path/to/assets/speech.mp3
✓ Project file saved to: /path/to/project.html

✓ Done! You can now render the video with:
  cd /path/to/demo_elevenlabs
  node ../../apps/renderer/dist/cli.js generate -o output
```

## Configuration

### Voice Settings

Adjust voice parameters in `generate-karaoke.js`:

```javascript
voice_settings: {
  stability: 0.5,        // 0-1: Lower = more expressive, Higher = more stable
  similarity_boost: 0.75 // 0-1: How closely to match the voice
}
```

### Window Size

Modify the number of words displayed at once:

```javascript
data-parameters='{"words":"...","windowSize":"3"}'
//                                            ^^^
//                                            Change this value
```

### Pause Threshold

Modify chunk detection sensitivity in `karaoke_text/src/App.tsx:57`:

```typescript
const PAUSE_THRESHOLD_MS = 200; // Pauses longer than 200ms create a new chunk
```

## Limitations

1. **Character-level Conversion**: The TTS API returns character-level timing which must be converted to word-level. This may have slight inaccuracies at word boundaries.

2. **Punctuation**: The current implementation includes punctuation in words (e.g., "hotel." instead of "hotel"). This can be customized in `convertCharacterAlignmentToWords()`.

3. **Rate Limits**: ElevenLabs has API rate limits depending on your subscription tier.

4. **Audio Format**: Currently outputs MP3. Other formats can be specified via `output_format` parameter.

## Advanced Usage

### Programmatic API

```javascript
const { generateSpeechWithTimestamps, generateProjectHTML } = require('./generate-karaoke.js');

async function createKaraoke(text) {
  const { audio, words } = await generateSpeechWithTimestamps(text);
  const duration = words[words.length - 1].end + 1.5;
  const html = generateProjectHTML(words, duration, 'speech.mp3');
  return { audio, html };
}
```

### Custom Processing

```javascript
// Add custom word filtering or transformation
function preprocessWords(words) {
  return words
    .filter(w => w.text.length > 0) // Remove empty words
    .map(w => ({
      ...w,
      text: w.text.replace(/[.,!?]$/, ''), // Strip trailing punctuation
    }));
}
```

## Troubleshooting

**Error: ELEVENLABS_API_KEY environment variable is not set**
- Run `export ELEVENLABS_API_KEY="your_key"` before executing the script

**Error: ElevenLabs API error: 401**
- Check your API key is valid
- Ensure you have API credits available

**Error: Cannot find module 'fs'**
- Use Node.js 16+ which includes built-in modules

**Words not aligning correctly**
- Try the Forced Alignment API instead of TTS with Timestamps
- Adjust the character-to-word conversion logic

## Resources

- [ElevenLabs TTS with Timestamps API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
- [ElevenLabs Forced Alignment API](https://elevenlabs.io/docs/api-reference/forced-alignment/create)
- [Available Voices](https://elevenlabs.io/voice-library)
- [API Documentation](https://elevenlabs.io/docs)
