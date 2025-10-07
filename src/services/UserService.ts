import { prisma } from "./prisma";

export type UserParams = {
    telegramId: string;
    language: string;
    firstName: string;
    lastName: string;
}

export async function createOrUpdateUser(params:UserParams) {
    const { telegramId, language, firstName, lastName } = params;
    const user = await prisma.user.upsert({
        where: { telegramId },
        update: { language, firstName, lastName },
        create: { telegramId, language, firstName, lastName },
    });
    return user;
}