import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import "dotenv/config";
import fs from "node:fs";

let cachedAnthropic: ReturnType<typeof createAnthropic> | null = null;

// Function to get a persistent Anthropic client
export const getAnthropicClient = async (modelName: string) => {
  if (!cachedAnthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not set in environment variables");
    }
    cachedAnthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Optional: override baseURL if needed
      // baseURL: "https://api.anthropic.com/v1",
    });
  }
  return cachedAnthropic(modelName);
};

const errorMessage = fs.readFileSync("src/data/error-message.txt", "utf8");

async function main() {
  console.log("🚀 Vercel AI SDK - Anthropic Cache Demo");
  console.log("=====================================\n");

  // First API call - will create cache
  console.log("📝 First API call (creating cache)...");
  const result = await streamText({
    model: await getAnthropicClient("claude-3-5-sonnet-20240620"),
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

  console.log("✅ Streaming Response:");
  let fullText = "";
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    fullText += chunk;
  }
  console.log("\n");

  // Await the promises for usage and metadata
  const usage = await result.usage;
  const providerMetadata = await result.providerMetadata;

  console.log("\n📊 Cache Metadata (First Call):");
  console.log("- Cache Tokens:", providerMetadata?.anthropic);
  console.log("- Total Tokens:", usage?.totalTokens || 0);
  console.log("- Prompt Tokens:", usage?.promptTokens || 0);
  console.log("- Completion Tokens:", usage?.completionTokens || 0);
  console.log("- Full Usage Object:", JSON.stringify(usage, null, 2));

  console.log("\n" + "=".repeat(50) + "\n");

  // Second API call - should use cache
  console.log("🔄 Second API call (using cache)...");
  const result2 = await streamText({
    model: await getAnthropicClient("claude-3-5-sonnet-20240620"),
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
            text: "Explain the error message in a different way.",
          },
        ],
      },
    ],
  });

  console.log("✅ Streaming Response:");
  let fullText2 = "";
  for await (const chunk of result2.textStream) {
    process.stdout.write(chunk);
    fullText2 += chunk;
  }
  console.log("\n");

  // Await the promises for usage and metadata
  const usage2 = await result2.usage;
  const providerMetadata2 = await result2.providerMetadata;

  console.log("\n📊 Cache Metadata (Second Call):");
  console.log("- Cache Tokens:", providerMetadata2?.anthropic);
  console.log("- Total Tokens:", usage2?.totalTokens || 0);
  console.log("- Prompt Tokens:", usage2?.promptTokens || 0);
  console.log("- Completion Tokens:", usage2?.completionTokens || 0);
  console.log("- Full Usage Object:", JSON.stringify(usage2, null, 2));

  console.log("\n🎯 Cache Performance Summary:");
  const firstCallCacheCreation =
    Number(providerMetadata?.anthropic?.cacheCreationInputTokens) || 0;
  const secondCallCacheCreation =
    Number(providerMetadata2?.anthropic?.cacheCreationInputTokens) || 0;

  console.log(`- Tokens cached in first call: ${firstCallCacheCreation}`);
  console.log(`- Cache creation in second call: ${secondCallCacheCreation}`);
  console.log(
    `- Cache hit: ${
      secondCallCacheCreation === 0 && firstCallCacheCreation > 0
        ? "✅ YES"
        : "❌ NO"
    }`
  );
}

main().catch(console.error);
