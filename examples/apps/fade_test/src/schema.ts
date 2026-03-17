import type { ParameterSchema } from "@gannochenko/viewer-tools";

export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    {
      name: "text",
      label: "Text",
      placeholder: "Animated Text",
      defaultValue: "Animated Text",
    },
  ],
};

export interface AppParams {
  text: string;
  [key: string]: string;
}
