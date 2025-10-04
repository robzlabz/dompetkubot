// Telegram bot interfaces and types
export interface ITelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ITelegramMessage {
  message_id: number;
  from?: ITelegramUser;
  date: number;
  chat: ITelegramChat;
  text?: string;
  photo?: ITelegramPhotoSize[];
  document?: ITelegramDocument;
}

export interface ITelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface ITelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface ITelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface ITelegramInlineKeyboard {
  inline_keyboard: ITelegramInlineKeyboardButton[][];
}

export interface ITelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface ITelegramCallbackQuery {
  id: string;
  from: ITelegramUser;
  message?: ITelegramMessage;
  data?: string;
}

// Bot handler interfaces
export interface IBotHandler {
  handleMessage(message: ITelegramMessage): Promise<void>;
  handleCallbackQuery(callbackQuery: ITelegramCallbackQuery): Promise<void>;
  handlePhoto(message: ITelegramMessage): Promise<void>;
}

export interface IBotCommand {
  command: string;
  description: string;
  handler: (message: ITelegramMessage) => Promise<void>;
}

export interface IBotMiddleware {
  execute(message: ITelegramMessage, next: () => Promise<void>): Promise<void>;
}