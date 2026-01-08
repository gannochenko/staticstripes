console.log('Renderer application starting...');

async function main() {
  console.log('Renderer ready');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
