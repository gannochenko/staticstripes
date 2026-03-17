import type { ParameterSchema } from "@gannochenko/viewer-tools";

export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    {
      name: "title",
      label: "Title",
      placeholder: "Grafrat – hidden gem",
      defaultValue: "Grafrat – hidden gem",
    },
    {
      name: "verticalOffset",
      label: "Vertical Offset (%)",
      placeholder: "20",
      defaultValue: "20",
    },
    {
      name: "fontSize",
      label: "Font Size (rem)",
      placeholder: "4.5",
      defaultValue: "4.5",
    },
  ],
};

export interface AppParams {
  title: string;
  verticalOffset: string;
  fontSize: string;
  [key: string]: string;
}
