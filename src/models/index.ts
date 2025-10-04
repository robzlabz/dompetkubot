// Domain models with validation schemas using Zod
import { z } from 'zod';

// Mathematical expression validation
export const MathExpressionSchema = z.string().refine(
  (expr) => {
    // Allow Indonesian number formats and mathematical expressions
    // Examples: "5kg @ 10rb", "3x5000", "10 kali 2500", "4 @ 1500"
    const patterns = [
      /^\d+(\.\d+)?\s*(kg|gram|g|pcs|buah|biji|botol|kaleng|pack|dus|box)\s*[@x*×]\s*\d+(\.\d+)?(rb|ribu|k|jt|juta|m)?$/i,
      /^\d+(\.\d+)?\s*[@x*×]\s*\d+(\.\d+)?(rb|ribu|k|jt|juta|m)?$/i,
      /^\d+(\.\d+)?\s*(kali|dikali)\s*\d+(\.\d+)?(rb|ribu|k|jt|juta|m)?$/i,
      /^\d+(\.\d+)?\s*\+\s*\d+(\.\d+)?(rb|ribu|k|jt|juta|m)?$/i,
      /^\d+(\.\d+)?(rb|ribu|k|jt|juta|m)?$/i, // Simple number
    ];
    return patterns.some(pattern => pattern.test(expr.trim()));
  },
  {
    message: "Invalid mathematical expression format. Use formats like '5kg @ 10rb', '3x5000', or '10 kali 2500'",
  }
);

// Indonesian currency validation
export const IndonesianCurrencySchema = z.string().refine(
  (value) => {
    // Allow formats like: 25rb, 25ribu, 25k, 1jt, 1juta, 1m, or plain numbers
    const pattern = /^\d+(\.\d+)?(rb|ribu|k|jt|juta|m)?$/i;
    return pattern.test(value.trim());
  },
  {
    message: "Invalid Indonesian currency format. Use formats like '25rb', '1jt', or plain numbers",
  }
);

// Telegram ID validation
export const TelegramIdSchema = z.string().refine(
  (id) => /^\d+$/.test(id) && id.length >= 5 && id.length <= 15,
  {
    message: "Invalid Telegram ID format",
  }
);

// User model schema
export const UserSchema = z.object({
    id: z.string().cuid(),
    telegramId: TelegramIdSchema,
    username: z.string().min(1).max(32).optional(),
    firstName: z.string().min(1).max(64).optional(),
    lastName: z.string().min(1).max(64).optional(),
    language: z.string().length(2).default('id'),
    timezone: z.string().default('Asia/Jakarta'),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const CreateUserSchema = UserSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateUserSchema = UserSchema.partial().omit({
    id: true,
    telegramId: true,
    createdAt: true,
    updatedAt: true,
});

// Expense model schema
export const ExpenseItemSchema = z.object({
    id: z.string().cuid(),
    expenseId: z.string().cuid(),
    name: z.string().min(1).max(255),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    totalPrice: z.number().positive(),
});

export const CreateExpenseItemSchema = ExpenseItemSchema.omit({
    id: true,
    expenseId: true,
});

export const ExpenseSchema = z.object({
    id: z.string().cuid(),
    userId: z.string().cuid(),
    amount: z.number().positive(),
    description: z.string().min(1).max(500),
    categoryId: z.string().cuid(),
    calculationExpression: MathExpressionSchema.optional(),
    receiptImageUrl: z.string().url().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    items: z.array(ExpenseItemSchema).optional(),
});

export const CreateExpenseSchema = ExpenseSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
}).extend({
    items: z.array(CreateExpenseItemSchema).optional(),
});

export const UpdateExpenseSchema = ExpenseSchema.partial().omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
}).extend({
    items: z.array(CreateExpenseItemSchema).optional(),
});

// Income model schema
export const IncomeSchema = z.object({
    id: z.string().cuid(),
    userId: z.string().cuid(),
    amount: z.number().positive(),
    description: z.string().min(1).max(500),
    categoryId: z.string().cuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const CreateIncomeSchema = IncomeSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateIncomeSchema = IncomeSchema.partial().omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});

// Category model schema
export const CategoryTypeSchema = z.enum(['EXPENSE', 'INCOME']);

export const CategorySchema = z.object({
    id: z.string().cuid(),
    name: z.string().min(1).max(100),
    type: CategoryTypeSchema,
    isDefault: z.boolean().default(false),
    userId: z.string().cuid().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const CreateCategorySchema = CategorySchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateCategorySchema = CategorySchema.partial().omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

// Budget model schema
export const BudgetPeriodSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

export const BudgetSchema = z.object({
    id: z.string().cuid(),
    userId: z.string().cuid(),
    categoryId: z.string().cuid(),
    amount: z.number().positive(),
    period: BudgetPeriodSchema,
    startDate: z.date(),
    endDate: z.date(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const CreateBudgetSchema = BudgetSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateBudgetSchema = BudgetSchema.partial().omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});

// Wallet model schema
export const WalletSchema = z.object({
    id: z.string().cuid(),
    userId: z.string().cuid(),
    balance: z.number().nonnegative().default(0),
    coins: z.number().nonnegative().default(0), // Float to support fractional coins
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const CreateWalletSchema = WalletSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateWalletSchema = WalletSchema.partial().omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});

// Conversation model schema
export const ConversationTypeSchema = z.enum(['EXPENSE_ENTRY', 'INCOME_ENTRY', 'BUDGET_SETUP', 'GENERAL_QUERY']);
export const ConversationStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']);
export const MessageRoleSchema = z.enum(['USER', 'ASSISTANT', 'SYSTEM']);

export const ConversationMessageSchema = z.object({
    id: z.string().cuid(),
    conversationId: z.string().cuid(),
    role: MessageRoleSchema,
    content: z.string().min(1),
    createdAt: z.date(),
});

export const ConversationSchema = z.object({
    id: z.string().cuid(),
    userId: z.string().cuid(),
    type: ConversationTypeSchema,
    status: ConversationStatusSchema,
    context: z.any().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    messages: z.array(ConversationMessageSchema).optional(),
});

export const CreateConversationSchema = ConversationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateConversationSchema = ConversationSchema.partial().omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});

// Type exports
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export type Expense = z.infer<typeof ExpenseSchema>;
export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;
export type CreateExpense = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpense = z.infer<typeof UpdateExpenseSchema>;

export type Income = z.infer<typeof IncomeSchema>;
export type CreateIncome = z.infer<typeof CreateIncomeSchema>;
export type UpdateIncome = z.infer<typeof UpdateIncomeSchema>;

export type Category = z.infer<typeof CategorySchema>;
export type CategoryType = z.infer<typeof CategoryTypeSchema>;
export type CreateCategory = z.infer<typeof CreateCategorySchema>;
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;

export type Budget
    = z.infer<typeof BudgetSchema>;
export type BudgetPeriod = z.infer<typeof BudgetPeriodSchema>;
export type CreateBudget = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudget = z.infer<typeof UpdateBudgetSchema>;

export type Wallet = z.infer<typeof WalletSchema>;
export type CreateWallet = z.infer<typeof CreateWalletSchema>;
export type UpdateWallet = z.infer<typeof UpdateWalletSchema>;

export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationType = z.infer<typeof ConversationTypeSchema>;
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type CreateConversation = z.infer<typeof CreateConversationSchema>;
export type UpdateConversation = z.infer<typeof UpdateConversationSchema>;