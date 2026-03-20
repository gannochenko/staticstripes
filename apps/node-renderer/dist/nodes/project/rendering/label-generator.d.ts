/**
 * LabelGenerator - Generates unique labels for FFmpeg filter graph streams
 * Maintains a ledger of used labels to ensure uniqueness
 */
export declare class LabelGenerator {
    private usedLabels;
    /**
     * Generates a unique random label
     * Format: [a-z][0-999]
     * If collision occurs, regenerates until unique
     */
    generate(): string;
    /**
     * Generates a random label (may not be unique)
     */
    private generateRandom;
    /**
     * Marks a label as used (for external labels like '0:v', 'outv')
     */
    markUsed(label: string): void;
    /**
     * Checks if a label is already used
     */
    isUsed(label: string): boolean;
    /**
     * Clears all used labels (for testing or reset)
     */
    clear(): void;
    /**
     * Returns the count of used labels
     */
    getUsedCount(): number;
}
export declare const getLabel: () => string;
//# sourceMappingURL=label-generator.d.ts.map