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