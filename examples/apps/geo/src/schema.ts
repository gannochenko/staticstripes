import type { ParameterSchema } from "@gannochenko/viewer-tools";

export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    {
      name: "text",
      label: "Location text",
      placeholder: "Prague, Czech Republic",
      defaultValue: "Prague, Czech Republic",
    },
  ],
};

export interface AppParams {
  text: string;
  [key: string]: string;
}
