# Telegram Budget Bot

Indonesian Telegram bot for personal financial budgeting with AI-powered natural language processing.

## Features

- 🤖 Natural language expense and income tracking in Indonesian
- 💰 Budget management with real-time notifications
- 📊 Financial insights and analytics
- 🏦 Virtual wallet management
- 📸 Receipt image processing
- 🌐 Multi-language support (Indonesian/English)

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Bot Framework**: GramIO
- **AI**: OpenAI GPT
- **Validation**: Zod

## Getting Started

### Prerequisites

- Bun installed
- PostgreSQL database
- Telegram Bot Token
- OpenAI API Key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in `.env`

5. Set up the database:
   ```bash
   bun run db:push
   ```

6. Start the development server:
   ```bash
   bun run dev
   ```

## Project Structure

```
src/
├── config/          # Configuration files
├── interfaces/      # TypeScript interfaces
├── models/          # Data models with Zod validation
├── repositories/    # Data access layer
├── services/        # Business logic layer
├── utils/           # Utility functions
└── index.ts         # Application entry point
```

## Scripts

- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server
- `bun run build` - Build for production
- `bun run test` - Run tests
- `bun run db:generate` - Generate Prisma client
- `bun run db:push` - Push schema to database
- `bun run db:migrate` - Run database migrations
- `bun run db:studio` - Open Prisma Studio

## License

MIT