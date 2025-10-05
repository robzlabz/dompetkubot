export const memoryTools = [
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Simpan atau perbarui preset item ke memory user (harga dan satuan).",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          price: { type: ["number", "string"] },
          unit: { type: "string" },
        },
        required: ["key", "price", "unit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_memory_many",
      description: "Simpan atau perbarui banyak preset item sekaligus (key, price, unit).",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string" },
                price: { type: ["number", "string"] },
                unit: { type: "string" },
              },
              required: ["key", "price", "unit"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_memory",
      description: "Ambil data memory berdasarkan nama item.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_memory",
      description: "Hapus satu item dari memory user.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
        },
        required: ["key"],
      },
    },
  },
] as const;