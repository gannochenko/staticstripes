# ElevenLabs Integration Guide

This guide explains how to integrate ElevenLabs API with the karaoke_text app for automated video generation.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Input: Text                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               ElevenLabs API (Text-to-Speech)                │
│  • Converts text to speech audio                            │
│  • Returns character-level timing data                       │
│  • Output: MP3 audio + alignment JSON                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Character-to-Word Conversion (Local)               │
│  • Groups characters into words                              │
│  • Preserves timing boundaries                               │
│  • Format: [{text, start, end}, ...]                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Project HTML Generation (Local)                 │
│  • Embeds word timing in data-parameters                     │
│  • Escapes special characters for XML                        │
│  • Configures assets and duration                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Karaoke Text App (React)                    │
│  • Pre-processes words into chunks (200ms threshold)         │
│  • Manages paging windows per chunk                          │
│  • Highlights current word                                   │
│  • Hides text during pauses and after completion             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Renderer (FFmpeg)                          │
│  • Captures frames at 30fps                                  │
│  • Generates APNG with alpha transparency                    │
│  • Composites with background and audio                      │
│  • Outputs MP4 video                                         │
└─────────────────────────────────────────────────────────────┘
```

## API Options

### Option 1: Text-to-Speech with Timestamps (Recommended for New Content)

**Best for:** Creating new karaoke videos from scratch

**Pros:**
- Single API call generates both audio and timing
- No need for separate audio production
- Consistent voice quality

**Cons:**
- Returns character-level timing (requires conversion)
- Limited to ElevenLabs voices
- Uses TTS credits

**API Call:**
```javascript
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: "Your text here",
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
    }),
  }
);

const data = await response.json();
// data.audio_base64 - Base64 encoded audio
// data.alignment - Character-level timing array
```

### Option 2: Forced Alignment (Recommended for Existing Audio)

**Best for:** Adding karaoke to existing recordings or human voice

**Pros:**
- Returns word-level timing directly (no conversion needed)
- Works with any audio source
- More accurate for real speech patterns
- Supports 150+ languages

**Cons:**
- Requires existing audio file
- Separate process from audio generation
- Uses alignment credits

**API Call:**
```javascript
const formData = new FormData();
formData.append('file', audioBlob, 'audio.mp3');
formData.append('text', transcript);

const response = await fetch(
  'https://api.elevenlabs.io/v1/forced-alignment',
  {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: formData,
  }
);

const data = await response.json();
// data.words - Word-level timing array [{text, start, end, loss}, ...]
```

## Implementation Patterns

### Pattern 1: Simple CLI Tool (Current Implementation)

```bash
# One-shot generation
node generate-karaoke.js "Your text here"
node ../../apps/renderer/dist/cli.js generate -o output
```

**Use case:** Quick prototyping, manual content creation

### Pattern 2: Automated Pipeline

```javascript
// pipeline.js
async function createKaraokeVideo(text, outputName) {
  // 1. Generate speech + timing
  const { audio, words } = await generateSpeechWithTimestamps(text);

  // 2. Save audio
  fs.writeFileSync(`assets/${outputName}.mp3`, audio);

  // 3. Generate project
  const duration = words[words.length - 1].end + 1.5;
  const html = generateProjectHTML(words, duration, `${outputName}.mp3`);
  fs.writeFileSync('project.html', html);

  // 4. Render video
  await exec('node ../../apps/renderer/dist/cli.js generate -o ' + outputName);

  return `dst/${outputName}.mp4`;
}

// Batch processing
const jokes = ['joke1', 'joke2', 'joke3'];
for (const joke of jokes) {
  await createKaraokeVideo(joke, `video_${jokes.indexOf(joke)}`);
}
```

**Use case:** Batch content generation, automated workflows

### Pattern 3: Web Service API

```javascript
// server.js
const express = require('express');
const app = express();

app.post('/api/generate-karaoke', async (req, res) => {
  const { text, voiceId } = req.body;

  try {
    // Generate karaoke
    const { audio, words } = await generateSpeechWithTimestamps(text, voiceId);

    // Store in temporary location
    const jobId = crypto.randomUUID();
    await saveJob(jobId, { audio, words });

    // Trigger async rendering
    renderQueue.push(jobId);

    res.json({ jobId, status: 'processing' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/karaoke/:jobId', async (req, res) => {
  const status = await getJobStatus(req.params.jobId);
  if (status.completed) {
    res.json({ status: 'completed', videoUrl: status.url });
  } else {
    res.json({ status: 'processing' });
  }
});
```

**Use case:** SaaS application, user-facing service

### Pattern 4: Existing Audio Integration

```javascript
// align-existing.js
async function addKaraokeToExisting(audioPath, transcript, outputName) {
  // 1. Read existing audio
  const audioBuffer = fs.readFileSync(audioPath);

  // 2. Get word timing via Forced Alignment
  const words = await forcedAlignment(audioBuffer, transcript);

  // 3. Calculate duration from audio file
  const duration = await getAudioDuration(audioPath);

  // 4. Copy audio to assets
  fs.copyFileSync(audioPath, `assets/${outputName}.mp3`);

  // 5. Generate project
  const html = generateProjectHTML(words, duration, `${outputName}.mp3`);
  fs.writeFileSync('project.html', html);

  // 6. Render
  await exec('node ../../apps/renderer/dist/cli.js generate -o ' + outputName);

  return `dst/${outputName}.mp4`;
}

// Use with human recordings, podcast audio, etc.
await addKaraokeToExisting(
  './recordings/interview.mp3',
  'The full transcript text...',
  'interview_karaoke'
);
```

**Use case:** Podcast highlights, educational content with human narration

## Configuration Options

### Voice Selection

```javascript
// Available voice IDs from ElevenLabs Voice Library
const VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM',     // Calm, clear (default)
  domi: 'AZnzlk1XvdvUeBnXmlld',       // Strong, confident
  bella: 'EXAVITQu4vr4xnSDxMaL',      // Soft, pleasant
  antoni: 'ErXwobaYiN019PkySvjV',     // Well-rounded, pleasant
  elli: 'MF3mGyEYCl7XYWbV9V6O',       // Energetic
  josh: 'TxGEqnHWrfWFTfGW9XjX',       // Deep, resonant
  arnold: 'VR6AewLTigWG4xSOukaG',     // Crisp, distinctive
  adam: 'pNInz6obpgDQGcFmaJgB',       // Deep, authoritative
  sam: 'yoZ06aMxZJJ28mfd3POQ',        // Dynamic, engaging
};

// Use in generation
const { audio, words } = await generateSpeechWithTimestamps(text, VOICES.bella);
```

### Model Selection

```javascript
const MODELS = {
  multilingual_v2: 'eleven_multilingual_v2',  // Fast, 29 languages
  multilingual_v3: 'eleven_multilingual_v3',  // Better quality, 150+ languages
  turbo_v2: 'eleven_turbo_v2',                // Lowest latency
  turbo_v2_5: 'eleven_turbo_v2_5',            // Balanced speed/quality
};

// Specify in API call
body: JSON.stringify({
  text: "...",
  model_id: MODELS.multilingual_v3,
  // ...
})
```

### Output Format

```javascript
const FORMATS = {
  mp3_standard: 'mp3_44100_128',      // Default, good balance
  mp3_high: 'mp3_44100_192',          // Higher quality
  pcm_highest: 'pcm_44100',           // Lossless, large file
  ulaw_phone: 'ulaw_8000',            // Phone quality, small
};
```

### Window Size (Karaoke Display)

```javascript
// In project.html generation
data-parameters='{"words":"...","windowSize":"3"}'
//                                            ^^^

// Recommended values:
// 2 - Very short phrases, fast speech
// 3 - Default, good for most content
// 4-5 - Slower speech, more context
// 6+ - Display full sentences
```

### Pause Threshold (Chunk Detection)

```javascript
// In karaoke_text/src/App.tsx
const PAUSE_THRESHOLD_MS = 200;  // Default

// Adjust for different speech patterns:
// 150ms - More aggressive chunking (more pauses detected)
// 200ms - Default (natural pauses)
// 300ms - Conservative (only very obvious pauses)
// 500ms - Very conservative (dramatic pauses only)
```

## Error Handling

### API Errors

```javascript
try {
  const { audio, words } = await generateSpeechWithTimestamps(text);
} catch (error) {
  if (error.message.includes('401')) {
    console.error('Invalid API key');
  } else if (error.message.includes('429')) {
    console.error('Rate limit exceeded - wait and retry');
  } else if (error.message.includes('402')) {
    console.error('Insufficient credits');
  } else {
    console.error('API error:', error.message);
  }
}
```

### Retry Logic

```javascript
async function generateWithRetry(text, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await generateSpeechWithTimestamps(text);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Performance Optimization

### Caching

```javascript
const cache = new Map();

async function generateWithCache(text, voiceId) {
  const cacheKey = `${text}:${voiceId}`;

  if (cache.has(cacheKey)) {
    console.log('Using cached result');
    return cache.get(cacheKey);
  }

  const result = await generateSpeechWithTimestamps(text, voiceId);
  cache.set(cacheKey, result);
  return result;
}
```

### Parallel Processing

```javascript
// Process multiple jokes in parallel
const jokes = ['joke1', 'joke2', 'joke3'];
const results = await Promise.all(
  jokes.map(text => generateSpeechWithTimestamps(text))
);

// Render videos sequentially (FFmpeg is CPU-intensive)
for (const [index, { audio, words }] of results.entries()) {
  await renderVideo(audio, words, `output_${index}`);
}
```

### Streaming (For Real-time Applications)

```javascript
// Note: ElevenLabs supports streaming for TTS, but not with timestamps
// For karaoke, you need complete timing data upfront

// Alternative: Use websockets for progress updates
const ws = new WebSocket('wss://api.elevenlabs.io/v1/text-to-speech/...');
ws.on('data', chunk => {
  // Stream audio chunks for preview
  audioPreviewStream.write(chunk);
});
ws.on('end', data => {
  // Get final alignment data
  const words = processAlignment(data.alignment);
});
```

## Testing

### Unit Tests

```javascript
// test/character-to-word.test.js
const { convertCharacterAlignmentToWords } = require('../generate-karaoke');

test('converts character alignment to words', () => {
  const input = [
    { character: 'H', start: 0.0, end: 0.1 },
    { character: 'i', start: 0.1, end: 0.2 },
    { character: ' ', start: 0.2, end: 0.2 },
    { character: 't', start: 0.2, end: 0.3 },
    { character: 'here', start: 0.3, end: 0.5 },
  ];

  const expected = [
    { text: 'Hi', start: 0.0, end: 0.2 },
    { text: 'there', start: 0.2, end: 0.5 },
  ];

  expect(convertCharacterAlignmentToWords(input)).toEqual(expected);
});
```

### Integration Tests

```javascript
// test/integration.test.js
test('end-to-end karaoke generation', async () => {
  const text = 'Test joke here.';
  const { audio, words } = await generateSpeechWithTimestamps(text);

  expect(audio).toBeInstanceOf(Buffer);
  expect(audio.length).toBeGreaterThan(0);
  expect(words.length).toBeGreaterThan(0);
  expect(words[0]).toHaveProperty('text');
  expect(words[0]).toHaveProperty('start');
  expect(words[0]).toHaveProperty('end');
});
```

## Security Considerations

### API Key Protection

```javascript
// ❌ Bad: Hardcoded key
const API_KEY = 'sk_1234567890abcdef';

// ✅ Good: Environment variable
const API_KEY = process.env.ELEVENLABS_API_KEY;

// ✅ Better: Secret manager (for production)
const API_KEY = await getSecret('elevenlabs-api-key');
```

### Input Validation

```javascript
function validateInput(text) {
  if (typeof text !== 'string') {
    throw new Error('Text must be a string');
  }

  if (text.length === 0) {
    throw new Error('Text cannot be empty');
  }

  if (text.length > 5000) {
    throw new Error('Text too long (max 5000 characters)');
  }

  // Sanitize for injection attacks
  const sanitized = text
    .replace(/<script/gi, '')
    .replace(/javascript:/gi, '');

  return sanitized;
}
```

### Rate Limiting

```javascript
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async acquire() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.requests.push(now);
  }
}

// Usage
const limiter = new RateLimiter(10, 60000); // 10 requests per minute
await limiter.acquire();
const result = await generateSpeechWithTimestamps(text);
```

## Production Deployment

### Environment Setup

```bash
# .env
ELEVENLABS_API_KEY=sk_your_key_here
NODE_ENV=production
CACHE_DIR=/var/cache/karaoke
OUTPUT_DIR=/var/www/videos
MAX_CONCURRENT_RENDERS=2
```

### Monitoring

```javascript
// Log API usage
function logAPICall(duration, success, error) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'elevenlabs',
    duration_ms: duration,
    success,
    error: error?.message,
  }));
}

// Track costs
function trackCost(characters, model) {
  const costPerChar = 0.00003; // Example rate
  const cost = characters * costPerChar;

  metrics.increment('api.elevenlabs.cost', cost);
  metrics.increment('api.elevenlabs.characters', characters);
}
```

## Troubleshooting Guide

| Issue | Cause | Solution |
|-------|-------|----------|
| Words not aligning | Character grouping error | Use Forced Alignment API instead |
| Text visible during pauses | Pause threshold too high | Lower PAUSE_THRESHOLD_MS in App.tsx |
| Audio/video out of sync | Incorrect duration calculation | Verify audio duration matches project |
| API 401 error | Invalid API key | Check ELEVENLABS_API_KEY is set correctly |
| Empty word array | Text too short | Ensure minimum 2-3 words |
| Punctuation issues | Not handling special chars | Update character conversion logic |
| High API costs | Not caching results | Implement caching layer |

## Next Steps

1. **Test the integration**: Run `node examples/joke-workflow.js` to see the complete workflow
2. **Customize for your needs**: Modify voice, model, or window size settings
3. **Scale up**: Implement batch processing or web service pattern
4. **Optimize**: Add caching and retry logic
5. **Monitor**: Track API usage and costs

For more details, see:
- [README.md](./README.md) - Basic usage and setup
- [generate-karaoke.js](./generate-karaoke.js) - Main implementation
- [examples/joke-workflow.js](./examples/joke-workflow.js) - Complete example
