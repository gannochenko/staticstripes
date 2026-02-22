import styles from "./FormatPanel.module.css";

export interface Format {
  label: string;
  width: number;
  height: number;
}

export const FORMATS: Format[] = [
  { label: "YouTube", width: 1920, height: 1080 },
  { label: "YT Shorts", width: 1080, height: 1920 },
];

interface FormatPanelProps {
  selected: Format;
  onSelect: (format: Format) => void;
}

export function FormatPanel({ selected, onSelect }: FormatPanelProps) {
  return (
    <div className={styles.panel}>
      {FORMATS.map((format) => (
        <button
          key={format.label}
          className={`${styles.button} ${selected.label === format.label ? styles.active : ""}`}
          onClick={() => onSelect(format)}
        >
          {format.label}
          <span className={styles.dims}>
            {format.width}×{format.height}
          </span>
        </button>
      ))}
    </div>
  );
}
