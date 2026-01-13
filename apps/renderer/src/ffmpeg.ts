import type { ProjectStructure } from './type';

/**
 * Generates the complete ffmpeg command for rendering the project
 */
export function generateFFmpegCommand(
  project: ProjectStructure,
  filterComplex: string,
): string {
  const parts: string[] = ['ffmpeg'];

  // Overwrite output file without asking
  parts.push('-y');

  // Add input files in order of their index mapping
  const inputsByIndex = new Map<number, string>();
  for (const [assetName, index] of project.assetIndexMap) {
    const asset = project.assets.get(assetName);
    if (asset) {
      inputsByIndex.set(index, asset.path);
    }
  }

  // Add inputs in sorted order
  const sortedIndices = Array.from(inputsByIndex.keys()).sort((a, b) => a - b);
  for (const index of sortedIndices) {
    const path = inputsByIndex.get(index);
    if (path) {
      parts.push(`-i "${path}"`);
    }
  }

  // Add filter_complex
  if (filterComplex) {
    parts.push(`-filter_complex "${filterComplex}"`);
  }

  // Map the output video stream
  // TODO: Handle audio streams as well
  parts.push('-map "[outv]"');

  // Increase buffer queue size for complex filter graphs
  parts.push('-max_muxing_queue_size 4096');

  // Add output parameters
  const { width, height } = project.output.resolution;
  parts.push(`-s ${width}x${height}`);
  parts.push(`-r ${project.output.fps}`);
  parts.push('-pix_fmt yuv420p'); // Standard pixel format for compatibility
  parts.push('-preset ultrafast'); // Fast encoding for quick results

  // Add output path
  parts.push(`"${project.output.path}"`);

  return parts.join(' ');
}
