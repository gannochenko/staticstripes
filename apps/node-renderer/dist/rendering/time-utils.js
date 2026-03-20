"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDuration = formatDuration;
/**
 * Formats milliseconds to HH:MM:SS format
 * @param ms - Time in milliseconds
 * @returns Formatted time string (e.g., "01:23:45" or "00:05:30")
 */
function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
//# sourceMappingURL=time-utils.js.map