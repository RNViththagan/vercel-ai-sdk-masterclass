#!/usr/bin/env node

/**
 * Conversation Log Utility
 * Manage and analyze Claude terminal conversation logs
 */

const fs = require("fs");
const path = require("path");

const LOGS_DIR = "conversation-logs";

function formatTimestamp(timestamp) {
  return timestamp.replace(/-/g, ":").replace(/T/, " ").replace(/Z$/, " UTC");
}

function getConversationStats(messages) {
  const stats = {
    total: messages.length,
    user: 0,
    assistant: 0,
    system: 0,
    tool: 0,
    commands: 0,
    duration: null,
  };

  let firstTimestamp = null;
  let lastTimestamp = null;

  messages.forEach((msg) => {
    stats[msg.role]++;

    if (
      msg.role === "tool" &&
      Array.isArray(msg.content) &&
      msg.content[0]?.toolName === "executeCommand"
    ) {
      stats.commands++;
    }

    // Try to extract timestamps (if available in message metadata)
    if (msg.timestamp) {
      if (!firstTimestamp) firstTimestamp = new Date(msg.timestamp);
      lastTimestamp = new Date(msg.timestamp);
    }
  });

  if (firstTimestamp && lastTimestamp) {
    stats.duration = Math.round((lastTimestamp - firstTimestamp) / 1000); // seconds
  }

  return stats;
}

function listConversations() {
  if (!fs.existsSync(LOGS_DIR)) {
    console.log(`❌ No ${LOGS_DIR} directory found`);
    return;
  }

  const files = fs
    .readdirSync(LOGS_DIR)
    .filter(
      (file) => file.startsWith("conversation-") && file.endsWith(".json")
    )
    .sort((a, b) => b.localeCompare(a));

  if (files.length === 0) {
    console.log("📭 No conversation logs found");
    return;
  }

  console.log(`📚 Found ${files.length} conversation logs:`);
  console.log("═".repeat(120));
  console.log(
    "ID".padEnd(3) +
      "│ " +
      "Timestamp".padEnd(20) +
      "│ " +
      "Messages".padEnd(8) +
      "│ " +
      "Commands".padEnd(8) +
      "│ " +
      "Last User Message"
  );
  console.log("═".repeat(120));

  files.forEach((file, index) => {
    try {
      const content = JSON.parse(
        fs.readFileSync(path.join(LOGS_DIR, file), "utf8")
      );
      const stats = getConversationStats(content);
      const lastUserMessage = [...content]
        .reverse()
        .find((msg) => msg.role === "user");

      const id = (index + 1).toString().padEnd(3);
      const timestamp = formatTimestamp(
        file.replace("conversation-", "").replace(".json", "")
      ).padEnd(20);
      const messageCount = stats.total.toString().padEnd(8);
      const commandCount = stats.commands.toString().padEnd(8);
      const lastMsg = (lastUserMessage?.content || "No messages").substring(
        0,
        60
      );

      console.log(
        `${id}│ ${timestamp}│ ${messageCount}│ ${commandCount}│ ${lastMsg}`
      );
    } catch (error) {
      console.log(
        `${(index + 1).toString().padEnd(3)}│ ${"ERROR".padEnd(
          20
        )}│ ${"N/A".padEnd(8)}│ ${"N/A".padEnd(8)}│ Failed to parse ${file}`
      );
    }
  });
  console.log("═".repeat(120));
}

function showConversationDetails(identifier) {
  if (!fs.existsSync(LOGS_DIR)) {
    console.log(`❌ No ${LOGS_DIR} directory found`);
    return;
  }

  const files = fs
    .readdirSync(LOGS_DIR)
    .filter(
      (file) => file.startsWith("conversation-") && file.endsWith(".json")
    )
    .sort((a, b) => b.localeCompare(a));

  let targetFile;

  if (identifier.match(/^\d+$/)) {
    // Numeric ID
    const index = parseInt(identifier) - 1;
    if (index >= 0 && index < files.length) {
      targetFile = files[index];
    }
  } else {
    // Filename
    targetFile = identifier.endsWith(".json")
      ? identifier
      : `${identifier}.json`;
  }

  if (!targetFile || !files.includes(targetFile)) {
    console.log(`❌ Conversation not found: ${identifier}`);
    return;
  }

  try {
    const content = JSON.parse(
      fs.readFileSync(path.join(LOGS_DIR, targetFile), "utf8")
    );
    const stats = getConversationStats(content);

    console.log(`\n📄 Conversation Details: ${targetFile}`);
    console.log("─".repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   Total messages: ${stats.total}`);
    console.log(`   User messages: ${stats.user}`);
    console.log(`   Assistant messages: ${stats.assistant}`);
    console.log(`   System messages: ${stats.system}`);
    console.log(`   Tool messages: ${stats.tool}`);
    console.log(`   Commands executed: ${stats.commands}`);
    if (stats.duration) {
      console.log(
        `   Duration: ${Math.floor(stats.duration / 60)}:${(stats.duration % 60)
          .toString()
          .padStart(2, "0")}`
      );
    }

    console.log(`\n💬 Recent Messages:`);
    console.log("─".repeat(60));

    const recentMessages = content
      .slice(-8)
      .filter((msg) => msg.role === "user" || msg.role === "assistant");

    recentMessages.forEach((msg, index) => {
      if (msg.role === "user") {
        console.log(`\n👤 User: ${msg.content}`);
      } else if (msg.role === "assistant") {
        let content = "";
        if (Array.isArray(msg.content)) {
          content = msg.content
            .map((part) =>
              part.type === "text"
                ? part.text
                : part.type === "tool-call"
                ? `[Command: ${part.args?.command || "unknown"}]`
                : `[${part.type}]`
            )
            .join("");
        } else {
          content = msg.content;
        }
        console.log(
          `🤖 Claude: ${content.substring(0, 200)}${
            content.length > 200 ? "..." : ""
          }`
        );
      }
    });
  } catch (error) {
    console.log(`❌ Error reading conversation: ${error.message}`);
  }
}

function exportConversation(identifier, format = "txt") {
  if (!fs.existsSync(LOGS_DIR)) {
    console.log(`❌ No ${LOGS_DIR} directory found`);
    return;
  }

  const files = fs
    .readdirSync(LOGS_DIR)
    .filter(
      (file) => file.startsWith("conversation-") && file.endsWith(".json")
    )
    .sort((a, b) => b.localeCompare(a));

  let targetFile;

  if (identifier.match(/^\d+$/)) {
    const index = parseInt(identifier) - 1;
    if (index >= 0 && index < files.length) {
      targetFile = files[index];
    }
  } else {
    targetFile = identifier.endsWith(".json")
      ? identifier
      : `${identifier}.json`;
  }

  if (!targetFile || !files.includes(targetFile)) {
    console.log(`❌ Conversation not found: ${identifier}`);
    return;
  }

  try {
    const content = JSON.parse(
      fs.readFileSync(path.join(LOGS_DIR, targetFile), "utf8")
    );
    const outputFile = targetFile.replace(".json", `.${format}`);

    if (format === "txt") {
      const textContent = content
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg) => {
          if (msg.role === "user") {
            return `User: ${msg.content}`;
          } else if (msg.role === "assistant") {
            let content = "";
            if (Array.isArray(msg.content)) {
              content = msg.content
                .map((part) =>
                  part.type === "text"
                    ? part.text
                    : part.type === "tool-call"
                    ? `[Executed: ${part.args?.command || "command"}]`
                    : `[${part.type}]`
                )
                .join("");
            } else {
              content = msg.content;
            }
            return `Claude: ${content}`;
          }
        })
        .join("\n\n");

      fs.writeFileSync(outputFile, textContent);
      console.log(`✅ Exported conversation to ${outputFile}`);
    } else {
      console.log(`❌ Unsupported format: ${format}. Supported: txt`);
    }
  } catch (error) {
    console.log(`❌ Error exporting conversation: ${error.message}`);
  }
}

function deleteConversation(identifier) {
  if (!fs.existsSync(LOGS_DIR)) {
    console.log(`❌ No ${LOGS_DIR} directory found`);
    return;
  }

  const files = fs
    .readdirSync(LOGS_DIR)
    .filter(
      (file) => file.startsWith("conversation-") && file.endsWith(".json")
    )
    .sort((a, b) => b.localeCompare(a));

  let targetFile;

  if (identifier.match(/^\d+$/)) {
    const index = parseInt(identifier) - 1;
    if (index >= 0 && index < files.length) {
      targetFile = files[index];
    }
  } else {
    targetFile = identifier.endsWith(".json")
      ? identifier
      : `${identifier}.json`;
  }

  if (!targetFile || !files.includes(targetFile)) {
    console.log(`❌ Conversation not found: ${identifier}`);
    return;
  }

  try {
    fs.unlinkSync(path.join(LOGS_DIR, targetFile));
    console.log(`✅ Deleted conversation: ${targetFile}`);
  } catch (error) {
    console.log(`❌ Error deleting conversation: ${error.message}`);
  }
}

// CLI Interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "list":
  case "ls":
    listConversations();
    break;

  case "show":
  case "details":
    if (args[1]) {
      showConversationDetails(args[1]);
    } else {
      console.log("Usage: node conversation-utils.js show <id|filename>");
    }
    break;

  case "export":
    if (args[1]) {
      exportConversation(args[1], args[2] || "txt");
    } else {
      console.log(
        "Usage: node conversation-utils.js export <id|filename> [format]"
      );
    }
    break;

  case "delete":
  case "rm":
    if (args[1]) {
      deleteConversation(args[1]);
    } else {
      console.log("Usage: node conversation-utils.js delete <id|filename>");
    }
    break;

  default:
    console.log(`
🛠️  Conversation Log Utility

Usage: node conversation-utils.js <command> [arguments]

Commands:
  list, ls              List all conversations with summary
  show <id>            Show detailed conversation info
  export <id> [format] Export conversation (formats: txt)
  delete <id>          Delete a conversation

Examples:
  node conversation-utils.js list
  node conversation-utils.js show 1
  node conversation-utils.js export 1 txt
  node conversation-utils.js delete 1

Note: <id> can be numeric (1, 2, 3...) or filename
`);
}
