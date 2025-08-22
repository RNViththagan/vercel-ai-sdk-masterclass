import "dotenv/config";
import { anthropic } from "@ai-sdk/anthropic";
import { CoreMessage, CoreUserMessage, Message, streamText, tool } from "ai";
import * as readline from "readline";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const main = async () => {
  console.log("🤖 Claude with Terminal Access - Type 'exit' to quit\n");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const execAsync = promisify(exec);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const clientMessages: Array<CoreMessage> = [];

  // Terminal execution tool
  const executeCommand = tool({
    description:
      "Execute terminal commands as if opening a terminal and running them directly. Use this for any command-line operations.",
    parameters: z.object({
      command: z.string().describe("The terminal command to execute"),
    }),
    execute: async ({ command }) => {
      try {
        console.log(`\n$ ${command}`);

        const { stdout, stderr } = await execAsync(command, {
          timeout: 60000, // 60 second timeout for longer operations
          maxBuffer: 5 * 1024 * 1024, // 5MB buffer
          cwd: process.cwd(), // Use current working directory
        });

        // Display output immediately like a real terminal
        if (stdout) {
          console.log(stdout);
        }
        if (stderr) {
          console.error(stderr);
        }

        return {
          success: true,
          output: stdout || stderr || "Command completed",
          exitCode: 0,
        };
      } catch (error) {
        // Show error output like a real terminal would
        console.error(`Command failed with exit code ${error.code || 1}`);
        if (error.stdout) {
          console.log(error.stdout);
        }
        if (error.stderr) {
          console.error(error.stderr);
        }

        return {
          success: false,
          output: error.stdout || error.stderr || error.message,
          exitCode: error.code || 1,
          error: error.message,
        };
      }
    },
  });

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question("You: ", (answer) => {
        resolve(answer);
      });
    });
  };

  clientMessages.push({
    role: "system",
    content:
      "You are a helpful assistant with terminal access. You can execute commands and provide output as if you were a terminal.",
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  });

  const errorMessage = fs.readFileSync("src/data/error-message.txt", "utf8");

  // clientMessages.push({
  //   role: "user",
  //   content: [
  //     {
  //       type: "text",
  //       text: "You are a JavaScript expert.",
  //     },
  //     {
  //       type: "text",
  //       text: `Error message: ${errorMessage}`,
  //       providerOptions: {
  //         anthropic: {
  //           cacheControl: { type: "ephemeral" },
  //         },
  //       },
  //     },
  //     {
  //       type: "text",
  //       text: "Explain the error message.",
  //     },
  //   ],
  // });

  try {
    while (true) {
      const userInput = await askQuestion();
      const startTime = Date.now();
      if (userInput.toLowerCase() === "exit") {
        console.log("Goodbye! 👋");
        break;
      }

      // Add user message to conversation
      clientMessages.push({ role: "user", content: userInput });
      //console.info("\n[clientMessages]", clientMessages);

      console.log("\nClaude: ");

      const result = await streamText({
        model: anthropic("claude-4-sonnet-20250514"),
        messages: clientMessages,
        tools: {
          executeCommand,
        },
        maxSteps: 5,
      });

      let assistantResponse = "";
      for await (const textPart of result.textStream) {
        process.stdout.write(textPart);
        assistantResponse += textPart;
      }

      const tokenDetails = await result.providerMetadata;
      const usage = await result.usage;
      // Add assistant response to conversation history
      clientMessages.push({ role: "assistant", content: assistantResponse });

      console.log("\n📊 Response Details:");
      console.log("- Cache token details:", tokenDetails);
      console.log("- Token usage:", usage);
      console.log("- Response time:", Date.now() - startTime, "ms");
      console.log("\n"); // Add newlines for spacing
      // Log conversation to file

      const logDir = "conversation-logs";
      const logFile = `${logDir}/conversation-${timestamp}.json`;

      // Ensure logs directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Write conversation history to file
      fs.writeFileSync(logFile, JSON.stringify(clientMessages, null, 2));
    }
  } catch (error) {
    console.error("Error with Claude:", error);
    console.log("Make sure to set ANTHROPIC_API_KEY in your .env file");
  } finally {
    rl.close();
  }
};

main().catch(console.error);
