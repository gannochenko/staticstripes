import type { ParameterSchema } from "@gannochenko/viewer-tools";

export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    {
      name: "text",
      label: "Text",
      placeholder: "Grafrat, Solingen",
      defaultValue: "Grafrat, Solingen",
    },
    {
      name: "subtext",
      label: "Subtext",
      placeholder: "hidden gem",
      defaultValue: "hidden gem",
    },
  ],
};

export interface AppParams {
  text: string;
  subtext: string;
  [key: string]: string;
}
