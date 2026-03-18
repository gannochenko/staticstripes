#!/usr/bin/env node

/**
 * ElevenLabs Karaoke Generator
 *
 * This script demonstrates how to integrate ElevenLabs API to automatically
 * generate word-level timing data for the karaoke_text app.
 *
 * Usage:
 *   node generate-karaoke.js "Your text here" [voice_id]
 *
 * Environment variables:
 *   ELEVENLABS_API_KEY - Your ElevenLabs API key
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice
const OUTPUT_DIR = path.join(__dirname, 'assets');
const PROJECT_FILE = path.join(__dirname, 'project.html');

/**
 * Call ElevenLabs Text-to-Speech with Timestamps API
 *
 * @param {string} text - The text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID
 * @returns {Promise<{audio: Buffer, words: Array<{text: string, start: number, end: number}>}>}
 */
async function generateSpeechWithTimestamps(text, voiceId = DEFAULT_VOICE_ID) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Convert character-level alignment to word-level
  // ElevenLabs TTS with Timestamps returns character-level data,
  // so we need to group characters into words
  const words = convertCharacterAlignmentToWords(data.alignment, text);

  // Decode base64 audio
  const audioBuffer = Buffer.from(data.audio_base64, 'base64');

  return { audio: audioBuffer, words };
}

/**
 * Alternative: Use Forced Alignment API (if you already have audio)
 *
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} text - Transcript text
 * @returns {Promise<Array<{text: string, start: number, end: number}>>}
 */
async function forcedAlignment(audioBuffer, text) {
  const url = 'https://api.elevenlabs.io/v1/forced-alignment';

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
  formData.append('text', text);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // ElevenLabs Forced Alignment API returns word-level data directly
  return data.words.map(word => ({
    text: word.text,
    start: word.start,
    end: word.end,
  }));
}

/**
 * Convert character-level alignment to word-level timing
 *
 * @param {Array<{character: string, start: number, end: number}>} charAlignment
 * @param {string} originalText
 * @returns {Array<{text: string, start: number, end: number}>}
 */
function convertCharacterAlignmentToWords(charAlignment, originalText) {
  const words = [];
  let currentWord = '';
  let wordStart = null;
  let wordEnd = null;

  for (let i = 0; i < charAlignment.length; i++) {
    const char = charAlignment[i];
    const isWhitespace = /\s/.test(char.character);

    if (isWhitespace) {
      // End current word if exists
      if (currentWord) {
        words.push({
          text: currentWord,
          start: wordStart,
          end: wordEnd,
        });
        currentWord = '';
        wordStart = null;
        wordEnd = null;
      }
    } else {
      // Add character to current word
      currentWord += char.character;
      if (wordStart === null) {
        wordStart = char.start;
      }
      wordEnd = char.end;
    }
  }

  // Add last word if exists
  if (currentWord) {
    words.push({
      text: currentWord,
      start: wordStart,
      end: wordEnd,
    });
  }

  return words;
}

/**
 * Generate project.html with word timing data
 *
 * @param {Array<{text: string, start: number, end: number}>} words
 * @param {number} duration - Total duration in seconds
 * @param {string} audioFilename - Name of the audio file
 */
function generateProjectHTML(words, duration, audioFilename) {
  // Escape apostrophes and quotes for XML attributes
  const wordsJSON = JSON.stringify(words)
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');

  const durationMs = Math.ceil(duration * 1000);

  const html = `<!DOCTYPE html>
<html>
<body>
  <sequence>
    <fragment class="bg_image" />
    <fragment class="karaoke_text">
      <app
        src="../apps/karaoke_text/dst"
        data-parameters='{"words":"${wordsJSON}","windowSize":"3"}'
      />
    </fragment>
  </sequence>

  <style>
    .bg_image {
      -asset: bg_image;
      -duration: ${durationMs}ms;
    }
    .karaoke_text {
      -duration: ${durationMs}ms;
    }
  </style>

  <assets>
    <asset name="bg_image" src="./assets/bg.png" />
    <asset name="audio" src="./assets/${audioFilename}" />
  </assets>

  <config>
    <timeline>
      <audio src="audio" />
    </timeline>
  </config>
</body>
</html>`;

  return html;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node generate-karaoke.js "Your text here" [voice_id]');
    console.error('');
    console.error('Example:');
    console.error('  node generate-karaoke.js "A photon checks into a hotel."');
    console.error('');
    console.error('Environment variables:');
    console.error('  ELEVENLABS_API_KEY - Your ElevenLabs API key (required)');
    process.exit(1);
  }

  if (!ELEVENLABS_API_KEY) {
    console.error('Error: ELEVENLABS_API_KEY environment variable is not set');
    process.exit(1);
  }

  const text = args[0];
  const voiceId = args[1] || DEFAULT_VOICE_ID;

  console.log('Generating speech with word-level timing...');
  console.log(`Text: "${text}"`);
  console.log(`Voice ID: ${voiceId}`);
  console.log('');

  try {
    // Generate speech with timestamps
    const { audio, words } = await generateSpeechWithTimestamps(text, voiceId);

    console.log('✓ Speech generated successfully');
    console.log(`✓ ${words.length} words detected`);
    console.log('');

    // Print word timing data
    console.log('Word timing:');
    words.forEach((word, i) => {
      console.log(`  ${i + 1}. "${word.text}" @ ${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s`);
    });
    console.log('');

    // Calculate total duration
    const duration = words.length > 0 ? words[words.length - 1].end + 1.5 : 5.0;

    // Save audio file
    const audioFilename = 'speech.mp3';
    const audioPath = path.join(OUTPUT_DIR, audioFilename);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(audioPath, audio);
    console.log(`✓ Audio saved to: ${audioPath}`);

    // Generate project.html
    const projectHTML = generateProjectHTML(words, duration, audioFilename);
    fs.writeFileSync(PROJECT_FILE, projectHTML);
    console.log(`✓ Project file saved to: ${PROJECT_FILE}`);
    console.log('');

    console.log('✓ Done! You can now render the video with:');
    console.log(`  cd ${__dirname}`);
    console.log('  node ../../apps/renderer/dist/cli.js generate -o output');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateSpeechWithTimestamps,
  forcedAlignment,
  convertCharacterAlignmentToWords,
  generateProjectHTML,
};
