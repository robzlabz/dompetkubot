# Implementation Plan

- [x] 1. Set up project structure and core interfaces
  - Create directory structure for models, services, repositories, and API components
  - Set up Bun + TypeScript + Zod configuration
  - Configure Prisma with PostgreSQL connection
  - Define interfaces that establish system boundaries
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1, 13.1, 14.1_

- [-] 2. Implement database schema and core data models
- [x] 2.1 Create Prisma schema with all entities
  - Define User, Expense, Income, Category, Budget, Wallet, Voucher, Conversation models
  - Set up relationships and constraints
  - Configure float precision for coins and monetary values
  - _Requirements: 1.1, 4.1, 5.1, 6.1, 11.1, 12.1, 13.1_

- [x] 2.2 Implement Zod validation schemas
  - Create validation schemas for all data models
  - Add input validation for API endpoints
  - Implement mathematical expression validation
  - _Requirements: 1.1, 8.1, 8.2, 8.3_

- [ ]* 2.3 Write unit tests for data models and validation
  - Create unit tests for Zod schemas
  - Test model relationships and constraints
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1, 13.1, 14.1_

- [x] 3. Create repository layer with Prisma
- [x] 3.1 Implement base repository pattern
  - Create generic BaseRepository with CRUD operations
  - Implement error handling and transaction support
  - _Requirements: 1.1, 4.1, 5.1, 6.1, 11.1, 12.1, 13.1_

- [x] 3.2 Implement specific repositories
  - Create ExpenseRepository, IncomeRepository, CategoryRepository
  - Implement BudgetRepository, WalletRepository, VoucherRepository
  - Add ConversationRepository for chat history
  - _Requirements: 1.1, 4.1, 5.1, 6.1, 11.1, 12.1, 13.1_

- [ ]* 3.3 Write repository unit tests
  - Test CRUD operations with test database
  - Test complex queries and relationships
  - _Requirements: 1.1, 4.1, 5.1, 6.1, 11.1, 12.1, 13.1_

- [x] 4. Implement core service layer
- [x] 4.1 Create mathematical calculation service
  - Implement expression parser for "5kg @ 10rb" format
  - Handle various Indonesian number formats and expressions
  - Support multiplication, addition, and unit calculations
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 4.2 Implement expense management service
  - Create ExpenseService with CRUD operations
  - Integrate mathematical calculations
  - Handle itemized expenses from receipts
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4_

- [x] 4.3 Implement income management service
  - Create IncomeService for income tracking
  - Support automatic categorization
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4.4 Implement category service with AI categorization
  - Create CategoryService with default Indonesian categories
  - Implement AI-powered automatic categorization
  - Support custom category creation and management
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ]* 4.5 Write service layer unit tests
  - Test business logic with mocked repositories
  - Test mathematical calculations and categorization
  - _Requirements: 1.1, 4.1, 6.1, 7.1, 8.1_

- [x] 5. Implement budget and wallet services
- [x] 5.1 Create budget management service
  - Implement BudgetService with budget setting and monitoring
  - Add budget alert system (80% and 100% thresholds)
  - Calculate spending vs budget ratios
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5.2 Implement wallet and coin system
  - Create WalletService with float-based coin support
  - Implement balance addition and coin deduction
  - Add insufficient balance handling
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 5.3 Create voucher redemption service
  - Implement VoucherService with one-time redemption
  - Add voucher validation and usage tracking
  - Support different voucher types (coins, balance, discount)
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 5.4 Write budget and wallet service tests
  - Test budget calculations and alerts
  - Test coin deduction and balance management
  - Test voucher redemption logic
  - _Requirements: 5.1, 11.1, 12.1_

- [x] 6. Set up OpenAI integration and AI routing
- [x] 6.1 Create OpenAI service with configurable endpoint
  - Set up OpenAI client with custom endpoint support
  - Implement conversation context management
  - Add error handling and fallback strategies
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 6.2 Implement AI tool registry and routing system
  - Create Tool interface and ToolRegistry
  - Implement AI router that maps Indonesian text to tools
  - Add conversation context for better routing decisions
  - _Requirements: 1.1, 4.1, 6.5, 7.1, 11.1, 12.1_

- [x] 6.3 Create AI tools for each feature
  - Implement CreateExpenseTool, EditExpenseTool, CreateIncomeTool
  - Create SetBudgetTool, AddBalanceTool, RedeemVoucherTool
  - Add CategoryManagementTool for category operations
  - _Requirements: 1.1, 4.1, 5.1, 6.5, 6.6, 6.7, 7.1, 11.1, 12.1_

- [ ]* 6.4 Write AI integration tests
  - Test tool routing with sample Indonesian phrases
  - Test conversation context handling
  - Mock OpenAI responses for consistent testing
  - _Requirements: 1.1, 4.1, 6.1, 7.1, 11.1, 12.1_

- [x] 7. Implement response formatting system
- [x] 7.1 Create response formatter with nanoid integration
  - Implement the specific response format: "[check] berhasil tercatat! `nanoid()` [details] [comment]"
  - Add personalized AI comment generation in Bahasa Indonesia
  - Support itemized response formatting for receipts
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 7.2 Implement calculation display in responses
  - Show mathematical calculations in responses
  - Format Indonesian Rupiah properly
  - Display itemized breakdowns for complex purchases
  - _Requirements: 8.4, 9.3_

- [ ]* 7.3 Write response formatting tests
  - Test response format consistency
  - Test Indonesian localization
  - Test calculation display formatting
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8. Set up GramIO bot framework
- [x] 8.1 Initialize GramIO bot with TypeScript
  - Set up GramIO bot instance with proper configuration
  - Configure middleware for logging and error handling
  - Set up message routing for different input types
  - _Requirements: 1.1, 2.1, 3.1, 14.1, 14.2, 14.3, 14.4_

- [x] 8.2 Implement text message handling
  - Create handlers for natural language text input
  - Integrate with AI routing system
  - Add conversation storage for context
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 8.3 Add voice message processing
  - Implement speech-to-text integration
  - Add coin deduction for voice processing
  - Route transcribed text through AI system
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 11.3, 11.4_

- [x] 8.4 Implement photo/receipt processing
  - Add OCR integration for receipt scanning
  - Parse itemized receipt data with discounts
  - Deduct coins for OCR processing
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 11.3, 11.4_

- [ ]* 8.5 Write bot integration tests
  - Test message handling workflows
  - Test voice and photo processing
  - Test coin deduction for premium features
  - _Requirements: 1.1, 2.1, 3.1, 11.3, 11.4_

- [-] 9. Implement user management and authentication
- [ ] 9.1 Create user registration and authentication
  - Implement user registration on first interaction
  - Add Telegram ID verification
  - Set up user preferences and default categories
  - _Requirements: 10.1, 10.2, 14.4_

- [ ] 9.2 Add data encryption and privacy features
  - Implement sensitive data encryption
  - Add user data deletion functionality
  - Ensure conversation privacy
  - _Requirements: 10.3, 10.4, 13.4_

- [ ]* 9.3 Write authentication and privacy tests
  - Test user registration flow
  - Test data encryption and deletion
  - Test privacy controls
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 10. Create reporting and summary features
- [ ] 10.1 Implement spending summaries and reports
  - Create monthly spending summaries by category
  - Generate weekly and monthly reports
  - Include itemized breakdowns when available
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 10.2 Add budget status reporting
  - Show current spending vs budget for each category
  - Display budget alerts and warnings
  - Format all data in Indonesian Rupiah and Bahasa Indonesia
  - _Requirements: 5.4, 9.4_

- [ ]* 10.3 Write reporting feature tests
  - Test summary generation accuracy
  - Test budget status calculations
  - Test Indonesian formatting
  - _Requirements: 5.4, 9.1, 9.2, 9.3, 9.4_

- [ ] 11. Add help system and user guidance
- [ ] 11.1 Implement help commands and guidance
  - Create /start command with Indonesian welcome message
  - Add comprehensive help system in Bahasa Indonesia
  - Implement guided setup for new users
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 11.2 Add error handling and user feedback
  - Implement user-friendly error messages in Bahasa Indonesia
  - Add suggestions for unclear input
  - Create fallback responses for AI failures
  - _Requirements: 14.3_

- [ ]* 11.3 Write help system tests
  - Test help command responses
  - Test error message localization
  - Test guided setup flow
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 12. Set up external service integrations
- [ ] 12.1 Integrate OCR service for receipt processing
  - Set up OCR service (Google Vision API or similar)
  - Implement receipt data extraction and parsing
  - Handle OCR errors and fallbacks
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 12.2 Integrate speech-to-text service
  - Set up STT service for voice message processing
  - Handle audio format conversion if needed
  - Implement STT error handling
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ]* 12.3 Write external service integration tests
  - Test OCR processing with sample receipts
  - Test STT processing with sample audio
  - Test error handling and fallbacks
  - _Requirements: 2.1, 3.1_

- [ ] 13. Final integration and deployment preparation
- [ ] 13.1 Integrate all components and test end-to-end workflows
  - Connect all services and test complete user journeys
  - Test multi-modal input processing (text, voice, receipt)
  - Verify coin deduction and balance management
  - Test AI routing and response formatting
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1, 13.1, 14.1_

- [ ] 13.2 Add comprehensive error handling and logging
  - Implement application-wide error handling
  - Add structured logging for debugging
  - Set up monitoring and alerting
  - _Requirements: All requirements for production readiness_

- [ ] 13.3 Performance optimization and caching
  - Optimize database queries and add indexes
  - Implement caching for frequently accessed data
  - Add rate limiting for expensive operations
  - _Requirements: Performance and scalability_

- [ ]* 13.4 Write comprehensive integration tests
  - Test complete user workflows from start to finish
  - Test error scenarios and edge cases
  - Test performance under load
  - _Requirements: All requirements for system reliability_