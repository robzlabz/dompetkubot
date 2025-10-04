import { z } from 'zod';

// Environment configuration schema with validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().default('gpt-3.5-turbo'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENCRYPTION_KEY: z.string().optional(), // 64 hex characters (32 bytes)
});

export type Environment = z.infer<typeof envSchema>;

class EnvironmentConfig {
  private static instance: Environment;

  public static getInstance(): Environment {
    if (!EnvironmentConfig.instance) {
      try {
        EnvironmentConfig.instance = envSchema.parse(process.env);
      } catch (error) {
        console.error('Environment validation failed:', error);
        throw new Error('Invalid environment configuration');
      }
    }
    return EnvironmentConfig.instance;
  }

  public static reset(): void {
    EnvironmentConfig.instance = undefined as any;
  }

  public static get isDevelopment(): boolean {
    return EnvironmentConfig.getInstance().NODE_ENV === 'development';
  }

  public static get isProduction(): boolean {
    return EnvironmentConfig.getInstance().NODE_ENV === 'production';
  }

  public static get isTest(): boolean {
    return EnvironmentConfig.getInstance().NODE_ENV === 'test';
  }
}

export { EnvironmentConfig };
export const env = EnvironmentConfig.getInstance();