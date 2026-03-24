import type { ParameterSchema } from "@gannochenko/viewer-tools";

export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    {
      name: "words",
      label: "Word Timing Data (JSON)",
      placeholder: '[{"word":"Hello","start":0,"end":0.5}]',
      defaultValue: '[{"word":"Welcome","start":0,"end":0.5},{"word":"to","start":0.5,"end":0.8},{"word":"karaoke","start":0.8,"end":1.5},{"word":"mode!","start":1.5,"end":2.0}]',
    },
    {
      name: "windowSize",
      label: "Words on Screen",
      placeholder: "3",
      defaultValue: "3",
    },
    {
      name: "fontSize",
      label: "Font Size",
      placeholder: "72",
      defaultValue: "72",
    },
    {
      name: "textColor",
      label: "Text Color",
      placeholder: "#ffffff",
      defaultValue: "#ffffff",
    },
    {
      name: "highlightColor",
      label: "Highlight Color",
      placeholder: "#ffff00",
      defaultValue: "#ffff00",
    },
  ],
};

export interface WordTiming {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface AppParams {
  words: string; // JSON string of WordTiming[]
  windowSize: string;
  fontSize: string;
  textColor: string;
  highlightColor: string;
  [key: string]: string;
}
