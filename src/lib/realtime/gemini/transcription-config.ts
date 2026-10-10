import { Modality, type LiveConnectConfig } from "@google/genai";

export const TRANSCRIPTION_MODEL = "gemini-3.5-transcribe-live";
export const transcriptionConfig: LiveConnectConfig = {
  responseModalities: [Modality.TEXT],
  inputAudioTranscription: {},
};
