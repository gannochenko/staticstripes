// This file is kept for backward compatibility
// For CLI usage, use the 'staticstripes' command instead
// Example: npx staticstripes generate -p ./examples/demo

export { HTMLParser } from './html-parser.js';
export { HTMLProjectParser } from './html-project-parser.js';
export { Project } from './project.js';
export { makeFFmpegCommand, runFFMpeg } from './ffmpeg.js';
export { getAssetDuration } from './ffprobe.js';
