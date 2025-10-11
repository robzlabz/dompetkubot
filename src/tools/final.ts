export const finalTools = [
  {
    type: "function",
    function: {
      name: "send_final_message",
      description: "Kirimkan pesan final yang ramah ke user dan akhiri alur.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
      },
    },
  },
] as const;