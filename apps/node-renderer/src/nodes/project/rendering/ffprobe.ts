import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execFileAsync = promisify(execFile);

export const getAssetDuration = async (path: string): Promise<number> => {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      path,
    ]);

    const durationSeconds = parseFloat(stdout.trim());
    if (isNaN(durationSeconds)) {
      console.warn(`⚠️  Could not parse duration for: ${path}`);
      return 0;
    }

    return Math.round(durationSeconds * 1000);
  } catch (error: any) {
    if (!existsSync(path)) {
      console.error(`❌ File not found: ${path}`);
    } else {
      console.error(`❌ Failed to get duration for: ${path}`);
      if (error.message) {
        console.error(`   ${error.message}`);
      }
    }
    return 0;
  }
};
