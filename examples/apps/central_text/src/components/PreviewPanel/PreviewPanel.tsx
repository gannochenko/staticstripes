import styles from "./PreviewPanel.module.css";

export interface ContentParams {
  title: string;
  date: string;
  tags: string;
  extra: string;
}

interface PreviewPanelProps {
  value: ContentParams;
  onChange: (value: ContentParams) => void;
}

export function PreviewPanel({ value, onChange }: PreviewPanelProps) {
  const set = (field: keyof ContentParams) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [field]: e.target.value });

  return (
    <div className={styles.panel}>
      <label className={styles.field}>
        <span className={styles.label}>Title</span>
        <input className={styles.input} value={value.title} onChange={set("title")} placeholder="Title" />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Date</span>
        <input className={styles.input} value={value.date} onChange={set("date")} placeholder="Dec 24 2025" />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Tags</span>
        <input className={styles.input} value={value.tags} onChange={set("tags")} placeholder="❄️ 🏔️ 🌨️" />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Extra text</span>
        <input className={styles.input} value={value.extra} onChange={set("extra")} placeholder="Thanks for watching!" />
      </label>
    </div>
  );
}
