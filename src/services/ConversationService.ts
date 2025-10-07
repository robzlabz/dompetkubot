import { prisma } from "./prisma";
import { MessageType, MessageRole, Conversation } from "@prisma/client";

export type CreateConversationArgs = {
  userId: number;
  message: string;
  role: MessageRole;
  messageType: MessageType;
  toolUsed?: string | null;
  coinsUsed?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
};

export async function createConversation(args: CreateConversationArgs): Promise<Conversation> {
  const created = await prisma.conversation.create({
    data: {
      userId: args.userId,
      message: args.message,
      role: args.role,
      messageType: args.messageType,
      toolUsed: args.toolUsed ?? null,
      coinsUsed: args.coinsUsed ?? null,
      tokensIn: args.tokensIn ?? null,
      tokensOut: args.tokensOut ?? null,
    },
  });
  return created;
}

export type CoversationByUserArgs = {
  userId: number;
  limit?: number | null;
};

// Note: function name intentionally follows user's request spelling: coversationByUser
export async function coversationByUser(args: CoversationByUserArgs): Promise<Conversation[]> {
  const take = typeof args.limit === "number" && args.limit > 0 ? args.limit : 20;
  const list = await prisma.conversation.findMany({
    where: { userId: args.userId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return list;
}

export type UpdateConversationArgs = {
  id: number;
  message?: string | null;
  role?: MessageRole | null;
  messageType?: MessageType | null;
  toolUsed?: string | null;
  coinsUsed?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
};

// Note: function name intentionally follows user's request spelling: updateConversation
export async function updateConversation(args: UpdateConversationArgs): Promise<Conversation> {
  const updated = await prisma.conversation.update({
    where: { id: args.id },
    data: {
      message: args.message ?? undefined,
      role: args.role ?? undefined,
      messageType: args.messageType ?? undefined,
      toolUsed: args.toolUsed ?? undefined,
      coinsUsed: args.coinsUsed ?? undefined,
      tokensIn: args.tokensIn ?? undefined,
      tokensOut: args.tokensOut ?? undefined,
    },
  });
  return updated;
}