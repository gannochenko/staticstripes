import type { ParameterSchema } from "@gannochenko/viewer-tools";

export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    {
      name: "title",
      label: "Title",
      placeholder: "Grafrat – hidden gem of Solingen",
      defaultValue: "Grafrat – hidden gem of Solingen",
    },
    {
      name: "narration",
      label: "Narration",
      placeholder: "A quiet corner most locals don't even know about.",
      defaultValue: "A quiet corner most locals don't even know about.",
    },
  ],
};

export interface AppParams {
  title: string;
  narration: string;
  [key: string]: string;
}
