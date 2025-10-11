import { Bot } from "gramio";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

export const bot = new Bot(TELEGRAM_BOT_TOKEN);