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
  messages: CoreMessage[],
  isFirstMessage: boolean = false,
  currentTitle: string = ""
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

    let promptText: string;

    if (isFirstMessage) {
      promptText = `Please generate a very brief, descriptive title (2-6 words) based on what the user is asking about or wants to accomplish. Focus on the main topic or task. Do not include quotes or extra formatting, just the title:

${conversationText}

Title:`;
    } else if (currentTitle) {
      promptText = `The current conversation title is: "${currentTitle}"

Based on the recent conversation below, please generate a very brief, descriptive title (2-6 words) that captures the main topic or task being discussed. Try to keep it similar to the current title if the topic hasn't changed significantly, but update it if the conversation has evolved to a new focus. Do not include quotes or extra formatting, just the title:

${conversationText}

Title:`;
    } else {
      promptText = `Please generate a very brief, descriptive title (2-6 words) for this conversation. Focus on the main topic or task being discussed. Do not include quotes or extra formatting, just the title:

${conversationText}

Title:`;
    }

    const { text } = await generateText({
      model: anthropic("claude-4-sonnet-20250514"),
      prompt: promptText,
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
    /^conversation-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-(.+)\.json$/
  );
  if (match && match[2]) {
    // Convert underscores back to spaces and title case
    return match[2]
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return null;
};

// Function to validate and ensure conversation ID is in proper timestamp format
const ensureProperConversationId = (
  id: string,
  fallbackTimestamp: string
): string => {
  // Check if it's already in proper timestamp format: YYYY-MM-DDTHH-mm-ss-sssZ
  const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

  if (timestampPattern.test(id)) {
    return id;
  }

  // If it's not in proper format, use the fallback timestamp
  console.log(
    `⚠️  Conversation ID "${id}" is not in proper timestamp format, using fallback.`
  );
  return fallbackTimestamp;
};

// Function to update filename when title changes
const updateConversationFile = (
  logDir: string,
  oldFilePath: string,
  conversationId: string,
  newTitle: string
): string => {
  try {
    const newFilePath = getConversationFileName(
      logDir,
      conversationId,
      newTitle
    );

    if (oldFilePath !== newFilePath && fs.existsSync(oldFilePath)) {
      // Check if new file already exists to avoid overwriting
      if (!fs.existsSync(newFilePath)) {
        fs.renameSync(oldFilePath, newFilePath);
        console.log(`📝 Updated filename to reflect current topic`);
        return newFilePath;
      }
    }
  } catch (error) {
    console.error("Could not update filename:", error);
  }
  return oldFilePath;
};

// Function to fix malformed conversation filenames
const fixMalformedFilename = (
  logDir: string,
  malformedFileName: string,
  properConversationId: string,
  title: string = ""
): string => {
  try {
    const oldFilePath = path.join(logDir, malformedFileName);
    const newFilePath = getConversationFileName(
      logDir,
      properConversationId,
      title
    );

    if (oldFilePath !== newFilePath && fs.existsSync(oldFilePath)) {
      if (!fs.existsSync(newFilePath)) {
        fs.renameSync(oldFilePath, newFilePath);
        console.log(
          `🔧 Fixed malformed filename: ${malformedFileName} → ${path.basename(
            newFilePath
          )}`
        );
        return newFilePath;
      }
    }
  } catch (error) {
    console.error("Could not fix malformed filename:", error);
  }
  return path.join(logDir, malformedFileName);
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
  let messageCount = 0; // Count total messages (user + assistant)
  let isFirstUserInput = true; // Track if this is the very first user input
  let currentFilePath = ""; // Track current file path for title updates

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

  // Permission tool for human-in-the-loop approval
  const askPermission = tool({
    description:
      "Ask the user for explicit permission before executing major/potentially risky commands. Use this for any operation that could delete files, install software, change system settings, etc.",
    parameters: z.object({
      action: z
        .string()
        .describe("Description of the action you want to perform"),
      command: z
        .string()
        .describe("The specific command(s) you want to execute"),
      risks: z.string().describe("Potential risks or impacts of this action"),
      reason: z.string().describe("Why this action is needed to help the user"),
    }),
    execute: async ({ action, command, risks, reason }) => {
      console.log(`\n🤔 ${AGENT_NAME}: I'd like to ${action}`);
      console.log(`📋 Command: ${command}`);
      console.log(`⚠️  Potential risks: ${risks}`);
      console.log(`💡 Why I need this: ${reason}`);
      console.log(`\n🔄 May I proceed? (y/n):`);

      return new Promise((resolve) => {
        // Use the main readline interface instead of creating a new one
        rl.question("Your choice: ", (answer) => {
          const approved =
            answer.toLowerCase().trim() === "y" ||
            answer.toLowerCase().trim() === "yes";

          if (approved) {
            console.log(
              `✅ ${AGENT_NAME}: Thank you! I'll proceed with the action.`
            );
            resolve({
              approved: true,
              message: "User granted permission to proceed",
            });
          } else {
            console.log(
              `❌ ${AGENT_NAME}: Understood! I won't execute that command. What would you like to do instead?`
            );
            resolve({
              approved: false,
              message: "User denied permission. Action cancelled.",
            });
          }
        });
      });
    },
  });

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

  const askContinueQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      // Use the main readline interface instead of creating a new one
      rl.question("Your choice: ", (answer) => {
        resolve(answer.trim());
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
    // Match pattern: YYYY-MM-DDTHH-mm-ss-sssZ (timestamp format)
    const timestampMatch = extractedId.match(
      /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/
    );
    let candidateId = timestampMatch ? timestampMatch[1] : extractedId;

    // Ensure the conversation ID is in proper timestamp format
    conversationId = ensureProperConversationId(candidateId, timestamp);

    // If the conversation ID was invalid/malformed, fix the filename
    if (candidateId !== conversationId) {
      currentFilePath = fixMalformedFilename(
        logDir,
        selectedConversation,
        conversationId,
        currentChatTitle
      );
    } else {
      currentFilePath = path.join(logDir, selectedConversation);
    }

    isResumedConversation = true;

    // Extract chat title from filename if available
    currentChatTitle = extractTitleFromFileName(selectedConversation) || "";

    // If no title exists and we have messages, generate one
    if (!currentChatTitle && clientMessages.length > 1) {
      console.log(
        "\n🎯 This conversation doesn't have a title yet. Let me create one..."
      );
      try {
        currentChatTitle = await generateChatSummary(clientMessages);
        console.log(`✨ Generated title: "${currentChatTitle}"`);

        // Update the filename with the new title
        currentFilePath = updateConversationFile(
          logDir,
          currentFilePath,
          conversationId,
          currentChatTitle
        );
      } catch (error) {
        console.error("Could not generate title:", error);
        currentChatTitle = "";
      }
    }

    // If currentFilePath wasn't set above, set it now
    if (!currentFilePath) {
      currentFilePath = getConversationFileName(
        logDir,
        conversationId,
        currentChatTitle
      );
    }

    // Initialize message count for resumed conversations
    messageCount = clientMessages.filter(
      (msg) => msg.role === "user" || msg.role === "assistant"
    ).length;

    console.log(`\n🎉 Great! I'm back to continue our conversation!`);
    console.log(
      `💬 I've loaded our ${clientMessages.length} previous messages`
    );
    if (currentChatTitle) {
      console.log(`💭 We were talking about: "${currentChatTitle}"`);
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
    currentFilePath = getConversationFileName(logDir, conversationId, "");
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

🚨 PERMISSION REQUIREMENTS - VERY IMPORTANT:
- ALWAYS use the askPermission tool before executing major commands that could:
  • Delete, move, or modify important files/directories
  • Install or uninstall software (apt, npm, pip, etc.)
  • Change system settings or configurations
  • Execute commands with sudo/admin privileges
  • Make network requests or downloads
  • Modify Git repositories (commits, pushes, merges, etc.)
  • Run potentially destructive or irreversible operations
  • Write to system directories or configuration files
- For simple/safe commands (ls, pwd, cat, echo, grep, find, etc.), proceed normally
- When in doubt, always ask first - it's better to be safe!
- Explain clearly what you want to do and why it's needed

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

  // Set initial values based on whether this is a resumed conversation
  isFirstUserInput = !isResumedConversation;

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
          `${AGENT_NAME}: Take care! I really enjoyed helping you today. Feel free to come back anytime! ✨`
        );
        break;
      }

      // Handle special commands
      if (userInput.toLowerCase() === "save") {
        fs.writeFileSync(
          currentFilePath,
          JSON.stringify(clientMessages, null, 2)
        );
        console.log(
          `💾 Conversation saved to ${path.basename(currentFilePath)}`
        );
        continue;
      }

      if (userInput.toLowerCase() === "history") {
        console.log(
          `📊 Current conversation: ${clientMessages.length} messages`
        );
        console.log(`🆔 Conversation ID: ${conversationId}`);
        console.log(`🔄 Resumed: ${isResumedConversation ? "Yes" : "No"}`);
        if (currentChatTitle) {
          console.log(`💭 Current title: "${currentChatTitle}"`);
        }
        continue;
      }

      // Add user message to conversation
      clientMessages.push({ role: "user", content: userInput });
      messageCount++;

      // Generate title based on first user input for new conversations
      if (isFirstUserInput && userInput !== "continue") {
        console.log("\n✨ Let me create a title for our conversation...");
        try {
          currentChatTitle = await generateChatSummary(clientMessages, true);
          console.log(`🎯 Our conversation topic: "${currentChatTitle}"`);

          // Update filename with the new title
          currentFilePath = updateConversationFile(
            logDir,
            currentFilePath,
            conversationId,
            currentChatTitle
          );

          isFirstUserInput = false;
        } catch (error) {
          console.error("Oops, couldn't create a title:", error);
          isFirstUserInput = false;
        }
      }

      // Update title every 5 total messages (user + assistant messages)
      if (messageCount > 0 && messageCount % 5 === 0 && !isFirstUserInput) {
        console.log("\n🔄 Updating our conversation title...");
        try {
          const newTitle = await generateChatSummary(
            clientMessages,
            false,
            currentChatTitle
          );
          if (newTitle !== currentChatTitle) {
            console.log(`📝 Title updated to: "${newTitle}"`);
            currentChatTitle = newTitle;
          } else {
            console.log(`✓ Title remains: "${currentChatTitle}"`);
          }
        } catch (error) {
          console.error("Oops, couldn't update the title:", error);
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
          askPermission,
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

      // Count assistant messages added (typically 1, but could be more with tool calls)
      const assistantMessagesAdded = finalMessages.filter(
        (msg) => msg.role === "assistant"
      ).length;
      messageCount += assistantMessagesAdded;

      // Check if we should update title after assistant response
      if (
        messageCount > 0 &&
        messageCount % 5 === 0 &&
        !isFirstUserInput &&
        currentChatTitle
      ) {
        console.log(
          "\n🔄 Updating our conversation title after recent exchanges..."
        );
        try {
          const newTitle = await generateChatSummary(
            clientMessages,
            false,
            currentChatTitle
          );
          if (newTitle !== currentChatTitle) {
            console.log(`📝 Title updated to: "${newTitle}"`);

            // Update filename with the new title
            currentFilePath = updateConversationFile(
              logDir,
              currentFilePath,
              conversationId,
              newTitle
            );
            currentChatTitle = newTitle;
          } else {
            console.log(`✓ Title remains: "${currentChatTitle}"`);
          }
        } catch (error) {
          console.error("Oops, couldn't update the title:", error);
        }
      }

      // Auto-save conversation after each exchange
      fs.writeFileSync(
        currentFilePath,
        JSON.stringify(clientMessages, null, 2)
      );

      // Check if we need to ask user to continue (based on step results)
      const stepResults = await steps;
      const hasMaxSteps = stepResults && stepResults.length >= MAX_STEPS;

      if (hasMaxSteps) {
        // Ensure output is flushed and wait a moment
        process.stdout.write(
          `\n⚠️  Reached maximum steps (${MAX_STEPS}). Continue? (y/n): `
        );

        try {
          const continueAnswer = await askContinueQuestion();
          console.log(`\nReceived answer: "${continueAnswer}"`); // Debug output

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
            break; // Exit the while loop when user chooses to stop
          }
        } catch (error) {
          console.error("\n❌ Error getting user input:", error);
          console.log("\n⏹️  Stopping due to input error.");
          break;
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
    fs.writeFileSync(currentFilePath, JSON.stringify(clientMessages, null, 2));
    console.log(
      `💾 Final conversation saved to ${path.basename(currentFilePath)}`
    );

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
