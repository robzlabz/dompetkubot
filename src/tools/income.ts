export const incomeTools = [
  {
    type: "function",
    function: {
      name: "create_income",
      description: "Create income with category.",
      parameters: {
        type: "object",
        properties: {
          telegramId: { type: "string" },
          description: { type: "string" },
          amount: { type: ["string", "number", "null"] },
          categoryId: { type: ["string", "null"] },
          categoryName: { type: ["string", "null"] },
        },
        required: ["telegramId", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_income",
      description: "Read income by incomeId or list by telegramId.",
      parameters: {
        type: "object",
        properties: {
          telegramId: { type: ["string", "null"] },
          incomeId: { type: ["string", "null"] },
          limit: { type: ["number", "null"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_income",
      description: "Update income by incomeId (description, amount, category).",
      parameters: {
        type: "object",
        properties: {
          incomeId: { type: "string" },
          description: { type: ["string", "null"] },
          amount: { type: ["string", "number", "null"] },
          categoryId: { type: ["string", "null"] },
          categoryName: { type: ["string", "null"] },
        },
        required: ["incomeId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_income",
      description: "Delete income by incomeId.",
      parameters: {
        type: "object",
        properties: {
          incomeId: { type: "string" },
        },
        required: ["incomeId"],
      },
    },
  },
] as const;

// income tool runner is implemented in main app (index.ts)