export const expenseTools = [
  {
    type: "function",
    function: {
      name: "create_expense",
      description: "Create expense with optional items and category.",
      parameters: {
        type: "object",
        properties: {
          telegramId: { type: "string" },
          description: { type: "string" },
          amount: { type: ["string", "number", "null"] },
          categoryId: { type: ["string", "null"] },
          categoryName: { type: ["string", "null"] },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: ["number", "string"] },
                unitPrice: { type: ["number", "string"] },
              },
              required: ["name", "quantity", "unitPrice"],
            },
          },
        },
        required: ["telegramId", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_expense",
      description: "Read expense by expenseId or list by telegramId.",
      parameters: {
        type: "object",
        properties: {
          telegramId: { type: ["string", "null"] },
          expenseId: { type: ["string", "null"] },
          limit: { type: ["number", "null"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_expense",
      description: "Update expense by expenseId (description, amount, category, items).",
      parameters: {
        type: "object",
        properties: {
          expenseId: { type: "string" },
          description: { type: ["string", "null"] },
          amount: { type: ["string", "number", "null"] },
          categoryId: { type: ["string", "null"] },
          categoryName: { type: ["string", "null"] },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: ["number", "string"] },
                unitPrice: { type: ["number", "string"] },
              },
              required: ["name", "quantity", "unitPrice"],
            },
          },
        },
        required: ["expenseId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_expense",
      description: "Delete expense by expenseId.",
      parameters: {
        type: "object",
        properties: {
          expenseId: { type: "string" },
        },
        required: ["expenseId"],
      },
    },
  },
] as const;

// expense tool runner moved to main app (index.ts)