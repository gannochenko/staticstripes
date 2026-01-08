import { parseHTMLFile, findElementsByTagName, getComputedStyles } from './parser.js';
import { resolve } from 'path';

console.log('Renderer application starting...');

async function main() {
  console.log('Renderer ready');

  // Parse the demo project HTML file
  const projectPath = resolve(
    __dirname,
    '../../../examples/demo/project.html'
  );

  console.log(`\nParsing project file: ${projectPath}`);
  const parsed = await parseHTMLFile(projectPath);

  console.log('\n=== Project Structure ===');

  // Find all sequences
  const sequences = findElementsByTagName(parsed.ast, 'sequence');
  console.log(`\nFound ${sequences.length} sequence(s):`);

  sequences.forEach((seq, idx) => {
    console.log(`\n  Sequence ${idx + 1}:`);
    const fragments = findElementsByTagName(seq, 'fragment');
    console.log(`    Fragments: ${fragments.length}`);

    fragments.forEach((frag, fragIdx) => {
      const styles = getComputedStyles(frag, parsed.elements);
      const classAttr = frag.attrs.find((a) => a.name === 'class');
      console.log(
        `      ${fragIdx + 1}. ${classAttr?.value || '(no class)'}`
      );
      console.log(`         Styles:`, styles);
    });
  });

  // Find all assets
  const assets = findElementsByTagName(parsed.ast, 'asset');
  console.log(`\n=== Assets (${assets.length}) ===`);
  assets.forEach((asset) => {
    const name = asset.attrs.find((a) => a.name === 'name')?.value;
    const path = asset.attrs.find((a) => a.name === 'path')?.value;
    console.log(`  - ${name}: ${path}`);
  });

  // Find all outputs
  const outputs = findElementsByTagName(parsed.ast, 'output');
  console.log(`\n=== Outputs (${outputs.length}) ===`);
  outputs.forEach((output) => {
    const name = output.attrs.find((a) => a.name === 'name')?.value;
    const resolution = output.attrs.find((a) => a.name === 'resolution')?.value;
    const fps = output.attrs.find((a) => a.name === 'fps')?.value;
    console.log(`  - ${name}: ${resolution} @ ${fps}fps`);
  });

  console.log('\n✓ Parsing complete!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
