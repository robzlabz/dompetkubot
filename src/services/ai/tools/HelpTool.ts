import { z } from 'zod';
import { Tool, ToolResult } from '../ToolRegistry.js';
import { HelpService } from '../../HelpService.js';

const HelpToolSchema = z.object({
    topic: z.string().optional().describe('Help topic to get information about (e.g., pengeluaran, pemasukan, budget, laporan, koin, voucher, privasi)'),
    query: z.string().optional().describe('Specific question or unclear input from user')
});

export class HelpTool implements Tool {
    name = 'help_tool';
    description = 'Provides help information and guidance for users, especially when input is unclear or user needs assistance';
    parameters = HelpToolSchema;

    private helpService: HelpService;

    constructor(helpService: HelpService) {
        this.helpService = helpService;
    }

    async execute(params: z.infer<typeof HelpToolSchema>, userId: string): Promise<ToolResult> {
        try {
            const { topic, query } = params;

            // If user has a specific query, provide contextual help
            if (query) {
                const suggestions = this.helpService.generateHelpSuggestions(query);
                const helpContent = this.helpService.getHelpContent(topic);

                let response = `🤔 **Sepertinya Anda butuh bantuan...**\n\n`;
                
                if (suggestions.length > 0) {
                    response += `💡 **Mungkin maksud Anda:**\n${suggestions.slice(0, 3).map(s => `• ${s}`).join('\n')}\n\n`;
                }

                response += `📖 **${helpContent.title}**\n\n${helpContent.content}`;

                // Add examples if available
                if (helpContent.examples && helpContent.examples.length > 0) {
                    response += `\n\n**Contoh:**\n${helpContent.examples.slice(0, 3).map(ex => `• ${ex}`).join('\n')}`;
                }

                return {
                    success: true,
                    data: { helpProvided: true, topic: topic || 'contextual' },
                    message: response
                };
            }

            // Provide general help for specific topic
            const helpContent = this.helpService.getHelpContent(topic);
            let response = `**${helpContent.title}**\n\n${helpContent.content}`;

            // Add examples if available
            if (helpContent.examples && helpContent.examples.length > 0) {
                response += `\n\n**Contoh:**\n${helpContent.examples.map(ex => `• ${ex}`).join('\n')}`;
            }

            // Add available topics if showing main help
            if (!topic || topic === 'main') {
                const topics = this.helpService.getAvailableTopics();
                response += `\n\n**Topik bantuan lainnya:**\n${topics.map(t => `• /help ${t}`).join('\n')}`;
            }

            return {
                success: true,
                data: { helpProvided: true, topic: topic || 'main' },
                message: response
            };

        } catch (error) {
            console.error('Error in HelpTool:', error);
            
            return {
                success: false,
                error: 'Maaf, terjadi kesalahan saat mengambil informasi bantuan. Ketik /help untuk panduan lengkap.',
                data: { helpProvided: false }
            };
        }
    }
}