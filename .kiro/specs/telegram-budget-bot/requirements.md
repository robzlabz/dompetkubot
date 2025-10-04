# Requirements Document

## Introduction

This feature involves creating a Telegram bot for personal financial budgeting targeted at Indonesian users, using Bahasa Indonesia as the primary language. The bot integrates with OpenAI (with configurable custom endpoint support) to provide intelligent routing and financial assistance through multiple input methods: text chat, voice messages, and receipt scanning. Users can manage coin balances to access premium AI features, with receipt scanning and voice processing requiring coin deduction due to higher AI costs. The system stores all conversation history for context-aware responses. Users can interact naturally in Bahasa Indonesia, and the AI will route their requests to appropriate tools for managing expenses, income, categories, budgets, balance management, and voucher redemption. The system tracks detailed transaction information including individual items and discounts, and supports one-time voucher redemption for rewards or credits. The bot will be built using Bun runtime, TypeScript for type safety, Zod for data validation, GramIO framework (https://gramio.dev/) for Telegram bot development, PostgreSQL database, Prisma ORM, and repository/service architecture pattern.

## Requirements

### Requirement 1

**User Story:** As an Indonesian user, I want to add expenses using natural Bahasa Indonesia text, so that I can quickly track my spending in my native language.

#### Acceptance Criteria

1. WHEN a user sends a message in Bahasa Indonesia about an expense THEN the AI SHALL route it to the create expense tool
2. WHEN a user says "beli kopi 25 ribu" THEN the system SHALL create an expense of Rp 25,000 for coffee
3. WHEN a user sends "bayar listrik 150000" THEN the system SHALL create an expense of Rp 150,000 for electricity
4. WHEN an expense is created THEN the system SHALL respond with a formatted confirmation including nanoid and personalized comment

### Requirement 2

**User Story:** As an Indonesian user, I want to add expenses using voice messages, so that I can quickly record transactions hands-free.

#### Acceptance Criteria

1. WHEN a user sends a voice message saying "beli cilok 2rb" THEN the system SHALL transcribe and create an expense of Rp 2,000 for cilok
2. WHEN processing voice input THEN the system SHALL convert speech to text using appropriate speech recognition
3. WHEN voice transcription is complete THEN the AI SHALL route the transcribed text to the appropriate expense tool
4. WHEN voice-based expense is created THEN the system SHALL respond with the same formatted confirmation as text input

### Requirement 3

**User Story:** As an Indonesian user, I want to scan shopping receipts, so that I can automatically record detailed transactions with all items and discounts.

#### Acceptance Criteria

1. WHEN a user uploads a receipt image THEN the system SHALL use OCR to extract transaction details
2. WHEN processing a receipt THEN the system SHALL identify individual items, quantities, prices, and discounts
3. WHEN a receipt shows "kopi 2x25.000" with discount THEN the system SHALL record each item separately and apply discounts
4. WHEN receipt processing is complete THEN the system SHALL create detailed expense records with itemized breakdown

### Requirement 4

**User Story:** As an Indonesian user, I want to manage my income using natural Bahasa Indonesia, so that I can track all my financial inflows.

#### Acceptance Criteria

1. WHEN a user mentions income in Bahasa Indonesia THEN the AI SHALL route it to the create income tool
2. WHEN a user says "gaji bulan ini 5 juta" THEN the system SHALL record income of Rp 5,000,000 for salary
3. WHEN a user mentions "dapat bonus 500rb" THEN the system SHALL record income of Rp 500,000 for bonus
4. WHEN income is recorded THEN the system SHALL respond with formatted confirmation in Bahasa Indonesia

### Requirement 5

**User Story:** As an Indonesian user, I want to set and manage budgets for different categories, so that I can control my spending in specific areas.

#### Acceptance Criteria

1. WHEN a user says "budget makanan 1 juta" THEN the system SHALL set a monthly budget of Rp 1,000,000 for food category
2. WHEN a user exceeds 80% of a category budget THEN the system SHALL send a warning notification in Bahasa Indonesia
3. WHEN a user exceeds 100% of a category budget THEN the system SHALL send an alert notification in Bahasa Indonesia
4. WHEN a user requests budget status THEN the system SHALL show current spending vs budget for each category

### Requirement 6

**User Story:** As an Indonesian user, I want automatic categorization of all transactions with default and personalized categories, so that my expenses and income are organized without manual effort.

#### Acceptance Criteria

1. WHEN any expense or income is recorded THEN the system SHALL automatically assign it to an appropriate category using AI
2. WHEN a user records "beli bensin 50rb" THEN the system SHALL automatically categorize it as "Transportasi"
3. WHEN a user records "gaji bulanan 5 juta" THEN the system SHALL automatically categorize it as "Gaji"
4. WHEN the system has default categories THEN it SHALL include common Indonesian categories like "Makanan", "Transportasi", "Tagihan", "Hiburan"
5. WHEN a user mentions category management THEN the AI SHALL route to the appropriate category tool
6. WHEN a user says "buat kategori investasi" THEN the system SHALL create a new personalized category
7. WHEN a user says "hapus kategori hiburan" THEN the system SHALL remove the specified category and reassign existing transactions
8. WHEN automatic categorization is uncertain THEN the system SHALL ask user for confirmation or use the most likely category

### Requirement 7

**User Story:** As an Indonesian user, I want to edit existing expenses, so that I can correct mistakes or update transaction details.

#### Acceptance Criteria

1. WHEN a user mentions editing an expense THEN the AI SHALL route to the edit expense tool
2. WHEN a user says "ubah pembelian kopi tadi jadi 30rb" THEN the system SHALL update the most recent coffee expense to Rp 30,000
3. WHEN an expense is edited THEN the system SHALL maintain transaction history and show updated confirmation
4. WHEN editing itemized expenses THEN the system SHALL allow modification of individual items and recalculate totals

### Requirement 8

**User Story:** As an Indonesian user, I want the bot to automatically calculate totals from mathematical expressions, so that I can easily record purchases with quantities and unit prices.

#### Acceptance Criteria

1. WHEN a user says "beli ayam 5kg, perkilonya 10rb" THEN the system SHALL calculate 5 × 10,000 = Rp 50,000 and record the expense
2. WHEN a user says "beli permen 5, satunya 200" THEN the system SHALL calculate 5 × 200 = Rp 1,000 and record the expense
3. WHEN processing mathematical expressions THEN the system SHALL handle various formats like "3x5000", "10 kali 2500", "4 @ 1500"
4. WHEN calculation is complete THEN the system SHALL show both the calculation and final amount in the confirmation

### Requirement 9

**User Story:** As an Indonesian user, I want to receive personalized AI responses with consistent formatting, so that I get engaging feedback about my financial activities.

#### Acceptance Criteria

1. WHEN any transaction is recorded THEN the system SHALL respond with format: "[check] berhasil tercatat! `nanoid()` [transaction details] [personalized comment]"
2. WHEN recording "beli kopi 25rb" THEN the response SHALL be "[check] berhasil tercatat! `nanoid()` beli kopi Rp. 25.000 wow, kamu suka banget ngopi pagi hari ya"
3. WHEN recording calculated purchases THEN the response SHALL show calculation like "[check] berhasil tercatat! `nanoid()` beli ayam 5kg @ Rp. 10.000 = Rp. 50.000 wah belanja daging nih, mau masak apa?"
4. WHEN recording itemized purchases THEN the response SHALL include "items:" section with detailed breakdown
5. WHEN providing comments THEN the AI SHALL generate contextual, friendly remarks in Bahasa Indonesia

### Requirement 10

**User Story:** As an Indonesian user, I want to view my spending summaries and reports, so that I can understand my financial patterns.

#### Acceptance Criteria

1. WHEN a user requests summary in Bahasa Indonesia THEN the system SHALL show current month spending by category
2. WHEN a user asks for reports THEN the system SHALL generate weekly or monthly spending reports
3. WHEN generating reports THEN the system SHALL include itemized breakdowns when available
4. WHEN displaying financial data THEN the system SHALL use Indonesian Rupiah formatting and Bahasa Indonesia labels

### Requirement 10

**User Story:** As an Indonesian user, I want secure authentication and data protection, so that my financial information remains private.

#### Acceptance Criteria

1. WHEN a new user starts the bot THEN the system SHALL require user registration with basic information
2. WHEN a user interacts with the bot THEN the system SHALL verify the user's Telegram ID
3. WHEN storing transaction data THEN the system SHALL encrypt sensitive financial information including itemized details
4. WHEN a user requests data deletion THEN the system SHALL completely remove all user data including transaction history

### Requirement 11

**User Story:** As an Indonesian user, I want to manage my coin balance, so that I can use premium AI features like receipt scanning and voice processing.

#### Acceptance Criteria

1. WHEN a user mentions adding balance THEN the AI SHALL route to the balance management tool
2. WHEN a user says "tambah saldo 50rb" THEN the system SHALL process balance addition and convert to coins
3. WHEN using receipt scanning THEN the system SHALL deduct appropriate coins from user balance
4. WHEN using voice processing THEN the system SHALL deduct appropriate coins from user balance
5. WHEN user has insufficient balance THEN the system SHALL inform them and suggest adding more balance
6. WHEN balance operations occur THEN the system SHALL show current balance in confirmation

### Requirement 12

**User Story:** As an Indonesian user, I want to redeem vouchers for rewards or credits, so that I can benefit from promotional offers or incentives.

#### Acceptance Criteria

1. WHEN a user mentions voucher redemption THEN the AI SHALL route to the voucher redemption tool
2. WHEN a user says "pakai voucher ABC123" THEN the system SHALL validate and redeem the voucher if valid and unused
3. WHEN a voucher is successfully redeemed THEN the system SHALL mark it as used and apply coins or benefits to user account
4. WHEN a voucher is already used or invalid THEN the system SHALL inform the user in Bahasa Indonesia
5. WHEN voucher redemption is successful THEN the system SHALL respond with confirmation and benefit details

### Requirement 13

**User Story:** As an Indonesian user, I want my conversation history to be saved, so that the AI can provide better context-aware responses and remember previous interactions.

#### Acceptance Criteria

1. WHEN a user sends any message THEN the system SHALL store the conversation in the database
2. WHEN processing AI responses THEN the system SHALL consider previous conversation context
3. WHEN a user refers to previous transactions THEN the AI SHALL access conversation history to understand context
4. WHEN storing conversations THEN the system SHALL maintain user privacy and data security
5. WHEN conversation history is used THEN the system SHALL provide more personalized and contextual responses

### Requirement 14

**User Story:** As an Indonesian user, I want to receive help and guidance in Bahasa Indonesia, so that I can effectively utilize all bot features.

#### Acceptance Criteria

1. WHEN a user sends "/start" THEN the system SHALL provide a welcome message in Bahasa Indonesia with basic instructions
2. WHEN a user needs help THEN the system SHALL provide guidance in Bahasa Indonesia about available features
3. WHEN a user sends unclear input THEN the system SHALL suggest correct usage in Bahasa Indonesia
4. WHEN a user is new THEN the system SHALL provide guided setup for initial budget and category configuration