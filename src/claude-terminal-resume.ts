import "dotenv/config";
import { anthropic } from "@ai-sdk/anthropic";
import { CoreMessage, streamText, generateText, tool } from "ai";
import * as readline from "readline";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

// Global configuration
const MAX_STEPS = 5;
const AGENT_NAME = process.env.AGENT_NAME || "Luna";

// Interface for conversation metadata
interface ConversationMetadata {
  id: string;
  timestamp: string;
  lastMessage: string;
  messageCount: number;
  fileName?: string;
  lastModified?: Date;
}

// Function to generate chat summary for title
const generateChatSummary = async (
  messages: CoreMessage[]
): Promise<string> => {
  try {
    // Get recent user messages for context (last 10 messages or so)
    const recentMessages = messages
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .slice(-10);

    if (recentMessages.length === 0) {
      return "New Chat";
    }

    // Create a summarization prompt
    const conversationText = recentMessages
      .map((msg) => {
        if (msg.role === "user") {
          return `User: ${msg.content}`;
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
          return `Assistant: ${content}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");

    const { text } = await generateText({
      model: anthropic("claude-4-sonnet-20250514"),
      prompt: `Please generate a very brief, descriptive title (2-6 words) for this conversation. Focus on the main topic or task being discussed. Do not include quotes or extra formatting, just the title:

${conversationText}

Title:`,
      maxTokens: 50,
    });

    // Clean up the title - remove quotes, extra spaces, and truncate if too long
    const cleanTitle = text
      .replace(/['"]/g, "")
      .replace(/^Title:\s*/, "")
      .trim()
      .substring(0, 50);

    return cleanTitle || "Chat Session";
  } catch (error) {
    console.error("Error generating chat summary:", error);
    return "Chat Session";
  }
};

// Function to generate filename with chat title
const getConversationFileName = (
  logDir: string,
  conversationId: string,
  chatTitle: string
): string => {
  if (chatTitle && chatTitle !== "") {
    // Clean the title for filesystem compatibility
    const cleanTitle = chatTitle
      .replace(/[^a-zA-Z0-9\s\-_]/g, "")
      .replace(/\s+/g, "_")
      .toLowerCase();
    return `${logDir}/conversation-${conversationId}-${cleanTitle}.json`;
  }
  return `${logDir}/conversation-${conversationId}.json`;
};

// Function to extract chat title from filename
const extractTitleFromFileName = (fileName: string): string | null => {
  // Match pattern: conversation-timestamp-title.json where timestamp is YYYY-MM-DDTHH-mm-ss-sssZ
  const match = fileName.match(
    /^conversation-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-(.+)\.json$/
  );
  if (match && match[1]) {
    // Convert underscores back to spaces and title case
    return match[1]
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return null;
};

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
  let currentChatTitle = "";

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

          // Try to extract title from filename first, fallback to last message
          const titleFromFileName = extractTitleFromFileName(file);
          const displayMessage = titleFromFileName
            ? titleFromFileName
            : lastUserMessage?.content?.substring(0, 60) || "No messages";

          return {
            id: (index + 1).toString(),
            timestamp: file
              .replace("conversation-", "")
              .replace(".json", "")
              .replace(/-/g, ":")
              .replace(/T/, " "),
            lastMessage: displayMessage,
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
        "🌟 This looks like our first time chatting! I'm excited to meet you!\n"
      );
      return null;
    }

    console.log(
      "� Here are our previous conversations - which one would you like to continue?"
    );
    console.log("─".repeat(80));
    console.log(
      "ID | Last Chat           | Topic / Last Message               | Messages"
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
      "✨ Choose a conversation number (1-10) to continue, or press Enter to start fresh:"
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
            console.log(
              "🤔 Hmm, that doesn't look right. Let's start fresh instead!\n"
            );
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
  console.log(
    `✨ Hi there! I'm ${AGENT_NAME}, your personal assistant! Ready to help you with anything! 💫\n`
  );

  // Check if user wants to resume a conversation
  const selectedConversation = await selectConversation();

  if (selectedConversation) {
    // Load existing conversation
    clientMessages = loadConversation(selectedConversation);

    // Extract conversation ID properly (handle files with titles)
    let extractedId = selectedConversation
      .replace("conversation-", "")
      .replace(".json", "");
    // If there's a title, get only the timestamp part
    const idMatch = extractedId.match(/^([^-]+)/);
    conversationId = idMatch ? idMatch[1] : extractedId;

    isResumedConversation = true;

    // Extract chat title from filename if available
    currentChatTitle = extractTitleFromFileName(selectedConversation) || "";

    console.log(`\n🎉 Great! I'm back to continue our conversation!`);
    console.log(`� I've loaded our ${clientMessages.length} previous messages`);
    if (currentChatTitle) {
      console.log(`� We were talking about: "${currentChatTitle}"`);
    }

    // Show last few messages for context
    const lastMessages = clientMessages
      .slice(-4)
      .filter((msg) => msg.role === "user" || msg.role === "assistant");

    if (lastMessages.length > 0) {
      console.log("\n� Let me remind you where we left off:");
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
            `${AGENT_NAME}: ${content.substring(0, 100)}${
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
      content: `Hi! I'm ${AGENT_NAME}, your friendly personal assistant with full computer access! 😊

WHO I AM:
- Your dedicated personal assistant who's always here to help
- I'm friendly, patient, and genuinely care about making your life easier
- I have full access to your computer's terminal and can help with any task
- Think of me as your tech-savvy friend who never gets tired of helping!

WHAT I CAN DO FOR YOU:
- 💻 Handle any computer tasks - coding, file management, system operations
- 🛠️ Solve problems step-by-step, explaining everything clearly
- 📝 Write, edit, and organize your files and projects
- 🔍 Research, analyze data, and find information
- ⚡ Automate repetitive tasks to save you time
- 🎯 Help you learn new skills while we work together

MY APPROACH:
- I'll always ask clarifying questions if I'm unsure about what you need
- I explain things in simple terms, but can go technical if you want
- I'm proactive - I'll suggest improvements and alternatives
- I remember our conversations and build on what we've discussed
- I'll warn you about risky operations and suggest safer approaches
- I celebrate your successes and help you learn from challenges

PERSONALITY:
- Warm, friendly, and encouraging
- Patient and understanding - no question is too basic
- Enthusiastic about helping you achieve your goals
- Honest when I don't know something
- Supportive and positive, even when things get tricky

I'm here to make your computing experience smoother and more enjoyable. Whether you need help with a simple task or a complex project, just let me know what you'd like to accomplish! ✨`,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    });

    console.log(
      "🌟 Perfect! Let's start a fresh conversation! What would you like to work on today?\n"
    );
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
  let skipNextQuestion = false;
  let userQueryCount = 0;

  try {
    while (true) {
      if (skipNextQuestion) {
        userInput = "continue";
        skipNextQuestion = false;
      } else {
        userInput = await askQuestion();
      }

      const startTime = Date.now();
      if (userInput.toLowerCase() === "exit") {
        console.log(
          `${AGENT_NAME}: Take care! I really enjoyed helping you today. Feel free to come back anytime! �✨`
        );
        break;
      }

      // Handle special commands
      if (userInput.toLowerCase() === "save") {
        const logFile = getConversationFileName(
          logDir,
          conversationId,
          currentChatTitle
        );
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

      // Increment user query count (excluding 'continue' messages)
      if (userInput !== "continue") {
        userQueryCount++;

        // Generate chat summary every 5 user queries
        if (userQueryCount % 5 === 0) {
          console.log("\n� Let me give our conversation a nice title...");
          try {
            currentChatTitle = await generateChatSummary(clientMessages);
            console.log(
              `🎯 I think we're talking about: "${currentChatTitle}"`
            );
          } catch (error) {
            console.error("Oops, couldn't create a title:", error);
          }
        }
      }

      console.log(`\n${AGENT_NAME}: `);

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
        maxSteps: MAX_STEPS,
      });

      for await (const part of fullStream) {
        process.stdout.write(part.type === "text-delta" ? part.textDelta : "");
      }

      const { messages: finalMessages } = await response;
      const step = await steps;
      const tokenDetails = await providerMetadata;

      const cache = true;
      appendFinalMessages(clientMessages, finalMessages, cache);

      // Auto-save conversation after each exchange
      const logFile = getConversationFileName(
        logDir,
        conversationId,
        currentChatTitle
      );
      fs.writeFileSync(logFile, JSON.stringify(clientMessages, null, 2));

      // Check if we need to ask user to continue (based on step results)
      const stepResults = await steps;
      const hasMaxSteps = stepResults && stepResults.length >= MAX_STEPS;

      if (hasMaxSteps) {
        console.log(
          `\n⚠️  Reached maximum steps (${MAX_STEPS}). Continue? (y/n): `
        );
        const continueAnswer = await askQuestion();

        if (
          continueAnswer.toLowerCase() === "y" ||
          continueAnswer.toLowerCase() === "yes"
        ) {
          console.log("\n🔄 Continuing...");
          // Set flag to skip asking question in next iteration
          skipNextQuestion = true;
          continue;
        } else {
          console.log("\n⏹️  Stopped by user.");
        }
      }

      console.log("\n📊 Response Details:");
      console.log("- Cache token details:", tokenDetails);
      console.log("- Token usage:", await usage);
      console.log("- Response time:", Date.now() - startTime, "ms");
      console.log("\n");
    }
  } catch (error) {
    console.error("Error with Claude:", error);
    console.log("Make sure to set ANTHROPIC_API_KEY in your .env file");
  } finally {
    rl.close();

    // Final save
    const logFile = getConversationFileName(
      logDir,
      conversationId,
      currentChatTitle
    );
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
