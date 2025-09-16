import "dotenv/config";
import { anthropic } from "@ai-sdk/anthropic";
import { CoreMessage, streamText, tool } from "ai";
import * as readline from "readline";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

// Interface for conversation metadata
interface ConversationMetadata {
  id: string;
  timestamp: string;
  lastMessage: string;
  messageCount: number;
  fileName?: string;
  lastModified?: Date;
}

const main = async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const execAsync = promisify(exec);
  const logDir = "conversation-logs";

  // Ensure logs directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let clientMessages: Array<CoreMessage> = [];
  let conversationId: string = "";
  let isResumedConversation = false;

  // Function to list available conversations
  const listConversations = (): ConversationMetadata[] => {
    const files = fs
      .readdirSync(logDir)
      .filter(
        (file) => file.startsWith("conversation-") && file.endsWith(".json")
      )
      .map((file) => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        return {
          fileName: file,
          lastModified: stats.mtime,
        };
      })
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()) // Sort by last modified time (newest first)
      .map((fileInfo) => fileInfo.fileName);

    return files
      .slice(0, 10)
      .map((file, index) => {
        try {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);
          const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
          const lastUserMessage = [...content]
            .reverse()
            .find((msg: any) => msg.role === "user");

          return {
            id: (index + 1).toString(),
            timestamp: file
              .replace("conversation-", "")
              .replace(".json", "")
              .replace(/-/g, ":")
              .replace(/T/, " "),
            lastMessage:
              lastUserMessage?.content?.substring(0, 60) || "No messages",
            messageCount: content.filter(
              (msg: any) => msg.role === "user" || msg.role === "assistant"
            ).length,
            fileName: file,
            lastModified: stats.mtime,
          };
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean) as ConversationMetadata[];
  };

  // Function to load a conversation
  const loadConversation = (fileName: string): CoreMessage[] => {
    try {
      const content = JSON.parse(
        fs.readFileSync(path.join(logDir, fileName), "utf8")
      );
      return content as CoreMessage[];
    } catch (error) {
      console.error("Error loading conversation:", error);
      return [];
    }
  };

  // Function to prompt for conversation selection
  const selectConversation = async (): Promise<string | null> => {
    const conversations = listConversations();

    if (conversations.length === 0) {
      console.log(
        "No previous conversations found. Starting new conversation...\n"
      );
      return null;
    }

    console.log("🕐 Previous Conversations (sorted by last activity):");
    console.log("─".repeat(80));
    console.log(
      "ID | Last Modified       | Last Message                      | Messages"
    );
    console.log("─".repeat(80));

    conversations.forEach((conv) => {
      const lastModifiedStr = conv.lastModified
        ? conv.lastModified
            .toLocaleString("en-US", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
            .replace(",", "")
        : conv.timestamp;

      console.log(
        `${conv.id.padStart(2)} | ${lastModifiedStr.padEnd(
          19
        )} | ${conv.lastMessage.padEnd(35)} | ${conv.messageCount}`
      );
    });

    console.log("─".repeat(80));
    console.log(
      "Enter conversation ID to resume (1-10), or press Enter for new conversation:"
    );

    return new Promise((resolve) => {
      rl.question("Your choice: ", (answer) => {
        const choice = answer.trim();
        if (!choice) {
          resolve(null);
        } else {
          const selectedConv = conversations.find((c) => c.id === choice);
          if (selectedConv) {
            resolve((selectedConv as any).fileName);
          } else {
            console.log("Invalid choice. Starting new conversation...\n");
            resolve(null);
          }
        }
      });
    });
  };

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
          timeout: 60000,
          maxBuffer: 5 * 1024 * 1024,
          cwd: process.cwd(),
        });

        return {
          success: true,
          output: stdout || stderr || "Command completed",
          exitCode: 0,
        };
      } catch (error: any) {
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

  // Initialize conversation
  console.log("🤖 Claude with Terminal Access - Enhanced with Chat Resume\n");

  // Check if user wants to resume a conversation
  const selectedConversation = await selectConversation();

  if (selectedConversation) {
    // Load existing conversation
    clientMessages = loadConversation(selectedConversation);
    conversationId = selectedConversation
      .replace("conversation-", "")
      .replace(".json", "");
    isResumedConversation = true;

    console.log(`\n✅ Resumed conversation from ${selectedConversation}`);
    console.log(`📊 Loaded ${clientMessages.length} messages`);

    // Show last few messages for context
    const lastMessages = clientMessages
      .slice(-4)
      .filter((msg) => msg.role === "user" || msg.role === "assistant");

    if (lastMessages.length > 0) {
      console.log("\n📝 Recent conversation context:");
      console.log("─".repeat(50));
      lastMessages.forEach((msg) => {
        if (msg.role === "user") {
          console.log(`You: ${msg.content}`);
        } else if (msg.role === "assistant") {
          // Handle different content formats
          let content = "";
          if (Array.isArray(msg.content)) {
            content = msg.content
              .map((part: any) =>
                part.type === "text" ? part.text : `[${part.type}]`
              )
              .join("");
          } else {
            content = msg.content as string;
          }
          console.log(
            `Claude: ${content.substring(0, 100)}${
              content.length > 100 ? "..." : ""
            }`
          );
        }
      });
      console.log("─".repeat(50));
    }

    console.log("\nType 'exit' to quit\n");
  } else {
    // Start new conversation
    conversationId = timestamp;
    clientMessages.push({
      role: "system",
      content:
        "You are a helpful assistant with terminal access. You can execute commands and provide output as if you were a terminal.",
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    });

    console.log("Starting new conversation - Type 'exit' to quit\n");
  }

  const knownIds = new Set<string>();
  const appendFinalMessages = (
    history: Array<CoreMessage>,
    finalMessages: Array<CoreMessage>,
    cache: boolean
  ) => {
    // First, remove cache control from previous assistant messages (except system message)
    if (cache) {
      history.forEach((msg) => {
        if (
          msg.role === "assistant" &&
          msg.providerOptions?.anthropic?.cacheControl
        ) {
          delete msg.providerOptions.anthropic.cacheControl;
          // Clean up empty providerOptions
          if (Object.keys(msg.providerOptions.anthropic).length === 0) {
            delete msg.providerOptions.anthropic;
          }
          if (Object.keys(msg.providerOptions).length === 0) {
            delete msg.providerOptions;
          }
        }
      });
    }

    // Then add new messages
    for (let i = 0; i < finalMessages.length; i++) {
      const m = finalMessages[i];

      if ((m.role === "assistant" || m.role === "tool") && (m as any).id) {
        if (!knownIds.has((m as any).id)) {
          knownIds.add((m as any).id);

          // Only add cache control to the final assistant message
          if (
            cache &&
            i === finalMessages.length - 1 &&
            m.role === "assistant"
          ) {
            m.providerOptions = {
              anthropic: { cacheControl: { type: "ephemeral" } },
            };
          }

          history.push(m as CoreMessage);
        }
      }
    }
  };

  let userInput: string;

  try {
    while (true) {
      userInput = await askQuestion();

      const startTime = Date.now();
      if (userInput.toLowerCase() === "exit") {
        console.log("Goodbye! 👋");
        break;
      }

      // Handle special commands
      if (userInput.toLowerCase() === "save") {
        const logFile = `${logDir}/conversation-${conversationId}.json`;
        fs.writeFileSync(logFile, JSON.stringify(clientMessages, null, 2));
        console.log(`💾 Conversation saved to ${logFile}`);
        continue;
      }

      if (userInput.toLowerCase() === "history") {
        console.log(
          `📊 Current conversation: ${clientMessages.length} messages`
        );
        console.log(`🆔 Conversation ID: ${conversationId}`);
        console.log(`🔄 Resumed: ${isResumedConversation ? "Yes" : "No"}`);
        continue;
      }

      // Add user message to conversation
      clientMessages.push({ role: "user", content: userInput });

      console.log("\nClaude: ");

      const {
        textStream,
        fullStream,
        usage,
        providerMetadata,
        response,
        steps,
      } = await streamText({
        model: anthropic("claude-4-sonnet-20250514"),
        messages: clientMessages,
        tools: {
          executeCommand,
        },
        maxSteps: 5,
      });

      for await (const part of fullStream) {
        process.stdout.write(part.type === "text-delta" ? part.textDelta : "");
      }

      const { messages: finalMessages } = await response;
      const step = await steps;
      const tokenDetails = await providerMetadata;

      const cache = true;
      appendFinalMessages(clientMessages, finalMessages, cache);

      console.log("\n📊 Response Details:");
      console.log("- Cache token details:", tokenDetails);
      console.log("- Token usage:", await usage);
      console.log("- Response time:", Date.now() - startTime, "ms");
      console.log("\n");

      // Auto-save conversation after each exchange
      const logFile = `${logDir}/conversation-${conversationId}.json`;
      fs.writeFileSync(logFile, JSON.stringify(clientMessages, null, 2));
    }
  } catch (error) {
    console.error("Error with Claude:", error);
    console.log("Make sure to set ANTHROPIC_API_KEY in your .env file");
  } finally {
    rl.close();

    // Final save
    const logFile = `${logDir}/conversation-${conversationId}.json`;
    fs.writeFileSync(logFile, JSON.stringify(clientMessages, null, 2));
    console.log(`💾 Final conversation saved to ${logFile}`);

    // Clean up created files
    try {
      if (fs.existsSync("x1.txt")) {
        fs.unlinkSync("x1.txt");
        console.log("Cleaned up x1.txt file");
      }
    } catch (error) {
      console.error("Error cleaning up files:", error);
    }
  }
};

main().catch(console.error);
