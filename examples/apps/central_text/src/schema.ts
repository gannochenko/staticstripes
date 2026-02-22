import type { ParameterSchema } from "@gannochenko/viewer-tools";

export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    {
      name: "title",
      label: "Title",
      placeholder: "Central Text",
      defaultValue: "Central Text",
    },
    {
      name: "date",
      label: "Date",
      placeholder: "2025-01-15",
      defaultValue: "",
    },
    {
      name: "tags",
      label: "Tags",
      placeholder: "travel,vlog",
      defaultValue: "",
    },
    {
      name: "extra",
      label: "Extra text",
      placeholder: "Thanks for watching!",
      defaultValue: "",
    },
  ],
};

export interface AppParams {
  title: string;
  date: string;
  tags: string;
  extra: string;
  [key: string]: string;
}
