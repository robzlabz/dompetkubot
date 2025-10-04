#!/usr/bin/env bun
import { DatabaseConfig, env } from './config/index.js';

async function main() {
  try {
    console.log('Starting Telegram Budget Bot...');

    // Connect to database
    await DatabaseConfig.connect();

    // Initialize bot (placeholder for now)
    console.log('Bot configuration loaded');
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Port: ${env.PORT}`);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down gracefully...');
      await DatabaseConfig.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Shutting down gracefully...');
      await DatabaseConfig.disconnect();
      process.exit(0);
    });

    console.log('Telegram Budget Bot started successfully');

  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();