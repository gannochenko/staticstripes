import { findElementsByTagName, parseHTMLFile } from './parser.js';
import { FFmpegGenerator } from './ffmpeg-generator.js';
import { resolve, dirname } from 'path';
import { writeFile } from 'fs/promises';
import { generate } from 'css-tree';
import { generateFilterComplex } from './generator.js';
import { prepareProject } from './project.js';

console.log('Renderer application starting...');

async function main() {
  console.log('Renderer ready');

  // Parse the demo project HTML file
  const projectPath = resolve(__dirname, '../../../examples/demo/project.html');

  const fileContent = await parseHTMLFile(projectPath);
  const project = await prepareProject(fileContent, projectPath);

  console.log('\n=== Asset Index Mapping ===');
  for (const [assetName, index] of project.assetIndexMap) {
    console.log(`  ${assetName} -> ${index}:v`);
  }

  console.log('\nSequences:', project.sequences.length);
  project.sequences.forEach((seq, i) => {
    console.log(`  Sequence ${i}: ${seq.fragments.length} fragments`);
    seq.fragments.forEach((frag, j) => {
      const blendInfo = frag.blendModeLeft || frag.blendModeRight
        ? `, blendLeft="${frag.blendModeLeft}", blendRight="${frag.blendModeRight}"`
        : '';
      const transitionInfo = frag.transitionIn || frag.transitionOut
        ? `, transIn="${frag.transitionIn}"(${frag.transitionInDuration}ms), transOut="${frag.transitionOut}"(${frag.transitionOutDuration}ms)`
        : '';
      const objectFitInfo = frag.objectFit !== 'cover' ? `, objectFit="${frag.objectFit}"` : '';
      const overlayInfo = frag.overlayLeft !== 0 ? `, overlay=${frag.overlayLeft}ms` : '';
      console.log(`    Fragment ${j}: assetName="${frag.assetName}", duration=${frag.duration}ms${overlayInfo}, zIndex=${frag.zIndex}${blendInfo}${transitionInfo}${objectFitInfo}`);
    });
  });

  console.log('\n=== Filter Complex ===');
  const filterComplex = generateFilterComplex(project);
  console.log(filterComplex);

  //   // Generate FFmpeg command
  //   console.log('\n=== Generating FFmpeg Command ===\n');
  //   const projectDir = dirname(projectPath);
  //   const generator = new FFmpegGenerator(parsed);

  //   // Print summary
  //   console.log(generator.generateSummary());

  //   // Print FFmpeg command
  //   console.log('\n=== Generated FFmpeg Command ===\n');
  //   const command = generator.generate();
  //   console.log(command);

  //   // Save to executable script
  //   const scriptPath = resolve(projectDir, 'render.sh');
  //   const scriptContent = `#!/bin/bash
  // set -e

  // cd "$(dirname "$0")"

  // echo "Rendering video project..."
  // echo ""

  // ${command}

  // echo ""
  // echo "✓ Render complete! Output: ./output/for_youtube.mp4"
  // `;

  //   await writeFile(scriptPath, scriptContent, { mode: 0o755 });
  //   console.log(`\n✓ Saved executable script to: ${scriptPath}`);
  //   console.log(`  Run with: cd ${projectDir} && ./render.sh`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
