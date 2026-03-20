"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssetDuration = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = require("fs");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const getAssetDuration = async (path) => {
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
    }
    catch (error) {
        if (!(0, fs_1.existsSync)(path)) {
            console.error(`❌ File not found: ${path}`);
        }
        else {
            console.error(`❌ Failed to get duration for: ${path}`);
            if (error.message) {
                console.error(`   ${error.message}`);
            }
        }
        return 0;
    }
};
exports.getAssetDuration = getAssetDuration;
//# sourceMappingURL=ffprobe.js.map