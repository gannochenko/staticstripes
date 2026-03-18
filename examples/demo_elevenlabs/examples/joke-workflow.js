#!/usr/bin/env node

/**
 * Complete Workflow Example: Physics Joke Karaoke Video
 *
 * This example demonstrates the complete workflow for generating
 * a karaoke-style video from a physics joke using ElevenLabs API.
 *
 * Steps:
 * 1. Define the joke text
 * 2. Call ElevenLabs to generate speech + timing
 * 3. Analyze pause detection and chunk boundaries
 * 4. Generate project.html
 * 5. Save audio file
 * 6. Display rendering instructions
 */

const fs = require('fs');
const path = require('path');

// Import functions from main script
const {
  generateSpeechWithTimestamps,
  generateProjectHTML,
} = require('../generate-karaoke.js');

// Physics jokes with natural pauses
const JOKES = {
  photon: "A photon checks into a hotel. The bellhop asks, 'Can I help you with your luggage?' The photon replies, 'No thanks, I'm traveling light.'",

  heisenberg: "Heisenberg is speeding down the highway. A cop pulls him over and says, 'Do you know how fast you were going?' Heisenberg replies, 'No, but I know exactly where I am!'",

  schrodinger: "Schrödinger gets pulled over by a cop. The cop asks, 'Do you know you have a dead cat in your trunk?' Schrödinger replies, 'Well I do now!'",

  atoms: "Why don't scientists trust atoms? Because they make up everything!",
};

async function analyzeChunks(words) {
  const PAUSE_THRESHOLD_MS = 200;
  const chunks = [];
  let currentChunk = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = words[i - 1];

    // Check for significant pause
    if (prevWord && (word.start - prevWord.end) >= PAUSE_THRESHOLD_MS / 1000) {
      const pauseDuration = ((word.start - prevWord.end) * 1000).toFixed(0);

      // Save current chunk
      if (currentChunk.length > 0) {
        chunks.push({
          words: currentChunk,
          text: currentChunk.map(w => w.text).join(' '),
          startTime: currentChunk[0].start,
          endTime: currentChunk[currentChunk.length - 1].end,
        });
      }

      console.log(`  [PAUSE: ${pauseDuration}ms between "${prevWord.text}" and "${word.text}"]`);

      currentChunk = [word];
    } else {
      currentChunk.push(word);
    }
  }

  // Add last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      words: currentChunk,
      text: currentChunk.map(w => w.text).join(' '),
      startTime: currentChunk[0].start,
      endTime: currentChunk[currentChunk.length - 1].end,
    });
  }

  return chunks;
}

async function generateJokeVideo(jokeKey) {
  const text = JOKES[jokeKey];

  if (!text) {
    console.error(`Unknown joke: ${jokeKey}`);
    console.error(`Available jokes: ${Object.keys(JOKES).join(', ')}`);
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  ElevenLabs Karaoke Workflow Example');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`Joke: ${jokeKey}`);
  console.log(`Text: "${text}"`);
  console.log('');

  // Step 1: Generate speech with timing
  console.log('Step 1: Generating speech with ElevenLabs...');
  const { audio, words } = await generateSpeechWithTimestamps(text);
  console.log(`✓ Generated audio with ${words.length} words`);
  console.log('');

  // Step 2: Display word timing
  console.log('Step 2: Word-level timing data:');
  words.forEach((word, i) => {
    const duration = ((word.end - word.start) * 1000).toFixed(0);
    console.log(`  ${String(i + 1).padStart(2)}. "${word.text.padEnd(15)}" @ ${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s (${duration}ms)`);
  });
  console.log('');

  // Step 3: Analyze chunk boundaries
  console.log('Step 3: Analyzing pause detection and chunks...');
  const chunks = await analyzeChunks(words);
  console.log('');
  console.log(`✓ Detected ${chunks.length} chunk(s):`);
  chunks.forEach((chunk, i) => {
    const duration = ((chunk.endTime - chunk.startTime) * 1000).toFixed(0);
    console.log(`  Chunk ${i + 1}: "${chunk.text}"`);
    console.log(`    └─ ${chunk.words.length} words, ${chunk.startTime.toFixed(2)}s - ${chunk.endTime.toFixed(2)}s (${duration}ms)`);
  });
  console.log('');

  // Step 4: Calculate duration and generate project
  const lastWord = words[words.length - 1];
  const speechDuration = lastWord.end;
  const totalDuration = speechDuration + 1.5; // Add 1.5s buffer

  console.log('Step 4: Generating project configuration...');
  console.log(`  Speech ends at: ${speechDuration.toFixed(2)}s`);
  console.log(`  Total duration: ${totalDuration.toFixed(2)}s`);

  const audioFilename = `${jokeKey}.mp3`;
  const projectHTML = generateProjectHTML(words, totalDuration, audioFilename);
  console.log('✓ Project HTML generated');
  console.log('');

  // Step 5: Save files
  console.log('Step 5: Saving files...');

  const baseDir = path.join(__dirname, '..');
  const assetsDir = path.join(baseDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const audioPath = path.join(assetsDir, audioFilename);
  fs.writeFileSync(audioPath, audio);
  console.log(`✓ Audio: ${audioPath}`);

  const projectPath = path.join(baseDir, 'project.html');
  fs.writeFileSync(projectPath, projectHTML);
  console.log(`✓ Project: ${projectPath}`);
  console.log('');

  // Step 6: Display next steps
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Next Steps');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('1. Ensure you have a background image:');
  console.log(`   cp /path/to/image.png ${path.join(assetsDir, 'bg.png')}`);
  console.log('');
  console.log('2. Render the video:');
  console.log(`   cd ${baseDir}`);
  console.log('   node ../../apps/renderer/dist/cli.js generate -o output');
  console.log('');
  console.log('3. View the result:');
  console.log(`   open dst/output.mp4`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
}

async function main() {
  const args = process.argv.slice(2);
  const jokeKey = args[0] || 'photon';

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('Error: ELEVENLABS_API_KEY environment variable is not set');
    console.error('');
    console.error('Set your API key:');
    console.error('  export ELEVENLABS_API_KEY="your_key_here"');
    console.error('');
    process.exit(1);
  }

  try {
    await generateJokeVideo(jokeKey);
  } catch (error) {
    console.error('');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
