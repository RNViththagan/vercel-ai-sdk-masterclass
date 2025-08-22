import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import "dotenv/config";
import fs from "node:fs";

const errorMessage = fs.readFileSync("src/data/error-message.txt", "utf8");

async function main() {
  const result = await generateText({
    model: anthropic("claude-3-5-sonnet-20240620"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "You are a JavaScript expert.",
          },
          {
            type: "text",
            text: `Error message: ${errorMessage}`,
            providerOptions: {
              anthropic: {
                cacheControl: { type: "ephemeral" },
              },
            },
          },
          {
            type: "text",
            text: "Explain the error message.",
          },
        ],
      },
    ],
  });

  console.log(result.text);
  console.log();
  console.log("Cache tokens:", result.providerMetadata?.anthropic);

  const result2 = await generateText({
    model: anthropic("claude-3-5-sonnet-20240620"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "You are a JavaScript expert.",
          },
          {
            type: "text",
            text: `Error message: ${errorMessage}`,
            providerOptions: {
              anthropic: {
                cacheControl: { type: "ephemeral" },
              },
            },
          },
          {
            type: "text",
            text: "Explain the error message.",
          },
        ],
      },
    ],
  });

  console.log(result2.text);
  console.log();

  console.log("Cache tokens:", result2.providerMetadata?.anthropic);
}

main().catch(console.error);
