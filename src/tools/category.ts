export const categoryTools = [
  {
    type: "function",
    function: {
      name: "create_category",
      description: "Buat kategori baru untuk user, dengan optional parent (sub-kategori).",
      parameters: {
        type: "object",
        properties: {
          telegramId: { type: "string" },
          name: { type: "string" },
          type: { type: "string", enum: ["INCOME", "EXPENSE"] },
          parentCategoryId: { type: ["number", "string", "null"] },
          parentCategoryName: { type: ["string", "null"] },
          isDefault: { type: ["boolean", "null"] },
        },
        required: ["telegramId", "name", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "seed_default_categories",
      description: "Inisialisasi kategori default untuk user baru berdasarkan template bawaan.",
      parameters: {
        type: "object",
        properties: {
          telegramId: { type: "string" },
        },
        required: ["telegramId"],
      },
    },
  },
] as const;