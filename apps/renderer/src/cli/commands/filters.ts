import { Command } from 'commander';
import { VisualFilter } from '../../stream.js';

export function registerFiltersCommand(program: Command): void {
  program
    .command('filters')
    .description('List all available Instagram filters')
    .action(() => {
      console.log('\n📸 Available Instagram Filters:\n');

      const filters = Object.values(VisualFilter);
      filters.forEach((filter, index) => {
        console.log(`  ${(index + 1).toString().padStart(2, ' ')}. ${filter}`);
      });

      console.log(`\n✨ Total: ${filters.length} filters\n`);
      console.log('💡 Usage: Add filter="<filter-name>" to a <fragment> element in your project.html\n');
      console.log('Example:');
      console.log('  <fragment asset="photo.jpg" filter="instagram-nashville" duration="5s" />\n');
    });
}
