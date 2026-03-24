import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execFileAsync = promisify(execFile);

export const getAssetDuration = async (path: string): Promise<number> => {
  try {
    // First try the standard duration query
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

    // Only return early if we got a valid positive duration
    // Otherwise, try special APNG handling below
    const hasValidDuration = !isNaN(durationSeconds) && durationSeconds > 0;

    // If duration is valid and positive, return it immediately
    if (hasValidDuration) {
      return Math.round(durationSeconds * 1000);
    }

    // If duration is NaN or 0, try special handling for APNG files
    if (path.toLowerCase().endsWith('.apng')) {
      console.log(`📊 APNG file detected, counting frames to determine duration...`);

      // Get frame count and FPS
      const { stdout: frameInfo } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-count_frames',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=nb_read_frames,r_frame_rate',
        '-of',
        'default=noprint_wrappers=1',
        path,
      ]);

      // Parse output like: r_frame_rate=100000/3333\nnb_read_frames=170
      const fpsMatch = frameInfo.match(/r_frame_rate=(\d+)\/(\d+)/);
      const framesMatch = frameInfo.match(/nb_read_frames=(\d+)/);

      if (fpsMatch && framesMatch) {
        const fpsNum = parseInt(fpsMatch[1], 10);
        const fpsDen = parseInt(fpsMatch[2], 10);
        const frameCount = parseInt(framesMatch[1], 10);
        const fps = fpsNum / fpsDen;
        const calculatedDuration = Math.round((frameCount / fps) * 1000);

        console.log(`   Frames: ${frameCount}, FPS: ${fps.toFixed(2)}, Duration: ${calculatedDuration}ms`);
        return calculatedDuration;
      }
    }

    console.warn(`⚠️  Could not parse duration for: ${path}`);
    return 0;
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
