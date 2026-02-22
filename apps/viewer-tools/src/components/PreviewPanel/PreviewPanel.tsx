import styles from "./PreviewPanel.module.css";

// Base standard parameters that are always available
export interface StandardParams {
  title: string;
  date: string;
  tags: string;
}

// Generic content params that can be extended
export type ContentParams = Record<string, string>;

// Parameter schema definition
export interface ParameterField {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
}

export interface ParameterSchema {
  fields: ParameterField[];
}

interface PreviewPanelProps<T extends ContentParams = ContentParams> {
  value: T;
  onChange: (value: T) => void;
  schema?: ParameterSchema;
}

// Default schema with standard parameters
const DEFAULT_SCHEMA: ParameterSchema = {
  fields: [
    { name: "title", label: "Title", placeholder: "Title", defaultValue: "" },
    { name: "date", label: "Date", placeholder: "2025-01-15", defaultValue: "" },
    { name: "tags", label: "Tags", placeholder: "travel,vlog", defaultValue: "" },
  ],
};

export function PreviewPanel<T extends ContentParams = ContentParams>({
  value,
  onChange,
  schema = DEFAULT_SCHEMA,
}: PreviewPanelProps<T>) {
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [field]: e.target.value } as T);

  return (
    <div className={styles.panel}>
      {schema.fields.map((field) => (
        <label key={field.name} className={styles.field}>
          <span className={styles.label}>{field.label}</span>
          <input
            className={styles.input}
            value={value[field.name] || ""}
            onChange={set(field.name)}
            placeholder={field.placeholder || ""}
          />
        </label>
      ))}
    </div>
  );
}
