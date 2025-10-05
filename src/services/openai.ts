import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
});