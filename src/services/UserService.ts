import logger from "./logger";
import { prisma } from "./prisma";

export type UserParams = {
    telegramId: string;
    language: string;
    firstName: string;
    lastName: string;
}

export async function createOrUpdateUser(params: UserParams) {
    const { telegramId, language, firstName, lastName } = params;
    logger.info(`[createOrUpdateUser] Upserting user with telegramId=${telegramId}, language=${language}, firstName=${firstName}, lastName=${lastName}`);
    const user = await prisma.user.upsert({
        where: { telegramId },
        update: { language, firstName, lastName },
        create: { telegramId, language, firstName, lastName },
    });
    logger.info(`[createOrUpdateUser] Upserted user: ${JSON.stringify(user)}` );
    return user;
}