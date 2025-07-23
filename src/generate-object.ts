import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import "dotenv/config";
import { z } from "zod";

const main = async () => {
  const result = await generateObject({
    model: anthropic("claude-3-5-sonnet-20241022"),
    prompt: "Please come up with 10 definitions for AI agents.",
    schema: z.object({
      definitions: z.array(
        z
          .string()
          .describe(
            "Use as much jargon as possible. It should be completely incoherent."
          )
      ),
    }),
  });
  console.log(result.object.definitions);
};

main();
