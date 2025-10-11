import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
});

// Transcribe audio from a public URL using Whisper-1
export async function transcribeFromUrl(url: string, language: string = "id"): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const file = await OpenAI.toFile(new Uint8Array(arrayBuffer), "voice.ogg");
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language,
  } as any);
  const text: string = (transcription as any)?.text ?? "";
  return text;
}

// Transcribe audio from an ArrayBuffer (e.g., ctx.download()) using Whisper-1
export async function transcribeFromBuffer(buffer: ArrayBuffer, language: string = "id"): Promise<string> {
  const file = await OpenAI.toFile(new Uint8Array(buffer), "voice.ogg");
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language,
  } as any);
  const text: string = (transcription as any)?.text ?? "";
  return text;
}