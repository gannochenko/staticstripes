/**
 * LabelGenerator - Generates unique labels for FFmpeg filter graph streams
 * Maintains a ledger of used labels to ensure uniqueness
 */
export class LabelGenerator {
  private usedLabels: Set<string> = new Set();

  /**
   * Generates a unique random label
   * Format: [a-z][0-999]
   * If collision occurs, regenerates until unique
   */
  generate(): string {
    let label: string;
    let attempts = 0;
    const maxAttempts = 10000; // Safety limit

    do {
      label = this.generateRandom();
      attempts++;

      if (attempts >= maxAttempts) {
        // Fallback: use timestamp-based label to guarantee uniqueness
        label = `t${Date.now()}${Math.random().toString(36).substring(2, 5)}`;
        break;
      }
    } while (this.usedLabels.has(label));

    this.usedLabels.add(label);
    return label;
  }

  /**
   * Generates a random label (may not be unique)
   */
  private generateRandom(): string {
    const letter = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a-z
    const num = Math.floor(Math.random() * 1000);
    return `${letter}${num}`;
  }

  /**
   * Marks a label as used (for external labels like '0:v', 'outv')
   */
  markUsed(label: string): void {
    this.usedLabels.add(label);
  }

  /**
   * Checks if a label is already used
   */
  isUsed(label: string): boolean {
    return this.usedLabels.has(label);
  }

  /**
   * Clears all used labels (for testing or reset)
   */
  clear(): void {
    this.usedLabels.clear();
  }

  /**
   * Returns the count of used labels
   */
  getUsedCount(): number {
    return this.usedLabels.size;
  }
}
