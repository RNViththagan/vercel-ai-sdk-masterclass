#!/usr/bin/env node

/**
 * Cache Control Cleaner for Conversation Logs
 * Removes redundant cache control blocks from conversation history files.
 * Keeps cache control only on:
 * 1. System messages
 * 2. The final assistant message in each conversation
 */

const fs = require("fs");
const path = require("path");

const LOGS_DIR = "conversation-logs";

function cleanConversationFile(filePath) {
  try {
    console.log(`🔍 Processing: ${path.basename(filePath)}`);

    // Read the conversation file
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if (!Array.isArray(content)) {
      console.log(`❌ Skipping ${filePath}: Not a valid conversation array`);
      return { processed: false, reason: "Invalid format" };
    }

    let cleaned = 0;
    let preserved = 0;

    // Find the last assistant message index
    let lastAssistantIndex = -1;
    for (let i = content.length - 1; i >= 0; i--) {
      if (content[i].role === "assistant") {
        lastAssistantIndex = i;
        break;
      }
    }

    // Clean up cache control blocks
    content.forEach((message, index) => {
      if (message.providerOptions?.anthropic?.cacheControl) {
        // Keep cache control on system messages
        if (message.role === "system") {
          preserved++;
          console.log(`  ✅ Preserved cache control on system message`);
          return;
        }

        // Keep cache control on the final assistant message
        if (message.role === "assistant" && index === lastAssistantIndex) {
          preserved++;
          console.log(
            `  ✅ Preserved cache control on final assistant message (index ${index})`
          );
          return;
        }

        // Remove cache control from other messages
        if (message.role === "assistant") {
          delete message.providerOptions.anthropic.cacheControl;
          cleaned++;
          console.log(
            `  🧹 Removed cache control from assistant message (index ${index})`
          );

          // Clean up empty objects
          if (Object.keys(message.providerOptions.anthropic).length === 0) {
            delete message.providerOptions.anthropic;
          }
          if (Object.keys(message.providerOptions).length === 0) {
            delete message.providerOptions;
          }
        }
      }
    });

    // Write back the cleaned content
    if (cleaned > 0) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
      console.log(
        `  💾 Saved cleaned file: ${cleaned} blocks removed, ${preserved} blocks preserved`
      );
      return {
        processed: true,
        cleaned,
        preserved,
        totalMessages: content.length,
      };
    } else {
      console.log(`  ✨ File was already clean: ${preserved} blocks preserved`);
      return {
        processed: true,
        cleaned: 0,
        preserved,
        totalMessages: content.length,
      };
    }
  } catch (error) {
    console.log(`❌ Error processing ${filePath}: ${error.message}`);
    return { processed: false, reason: error.message };
  }
}

function cleanAllConversations() {
  if (!fs.existsSync(LOGS_DIR)) {
    console.log(`❌ Directory ${LOGS_DIR} not found`);
    return;
  }

  const files = fs
    .readdirSync(LOGS_DIR)
    .filter(
      (file) => file.startsWith("conversation-") && file.endsWith(".json")
    )
    .sort();

  if (files.length === 0) {
    console.log("📭 No conversation files found");
    return;
  }

  console.log(
    `🚀 Starting cache control cleanup for ${files.length} conversation files...\n`
  );

  let totalProcessed = 0;
  let totalCleaned = 0;
  let totalPreserved = 0;
  let totalErrors = 0;

  files.forEach((file, index) => {
    const filePath = path.join(LOGS_DIR, file);
    const result = cleanConversationFile(filePath);

    if (result.processed) {
      totalProcessed++;
      totalCleaned += result.cleaned || 0;
      totalPreserved += result.preserved || 0;
    } else {
      totalErrors++;
    }

    // Add separator between files (except last one)
    if (index < files.length - 1) {
      console.log("─".repeat(60));
    }
  });

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("📊 CLEANUP SUMMARY");
  console.log("═".repeat(60));
  console.log(`📁 Total files found: ${files.length}`);
  console.log(`✅ Files processed: ${totalProcessed}`);
  console.log(`❌ Files with errors: ${totalErrors}`);
  console.log(`🧹 Total cache blocks removed: ${totalCleaned}`);
  console.log(`✨ Total cache blocks preserved: ${totalPreserved}`);

  if (totalCleaned > 0) {
    console.log(
      `\n🎉 Cleanup completed! ${totalCleaned} redundant cache control blocks removed.`
    );
  } else if (totalProcessed > 0) {
    console.log(`\n✨ All files were already clean!`);
  }
}

function cleanSpecificConversation(identifier) {
  if (!fs.existsSync(LOGS_DIR)) {
    console.log(`❌ Directory ${LOGS_DIR} not found`);
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

  const filePath = path.join(LOGS_DIR, targetFile);
  const result = cleanConversationFile(filePath);

  if (result.processed) {
    console.log(`\n🎉 Cleanup completed for ${targetFile}!`);
    console.log(`🧹 Cache blocks removed: ${result.cleaned}`);
    console.log(`✨ Cache blocks preserved: ${result.preserved}`);
  }
}

// CLI Interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "all":
    cleanAllConversations();
    break;

  case "clean":
    if (args[1]) {
      cleanSpecificConversation(args[1]);
    } else {
      console.log("Usage: node clean-cache-blocks.js clean <id|filename>");
    }
    break;

  default:
    console.log(`
🧹 Cache Control Cleaner for Conversation Logs

Usage: node clean-cache-blocks.js <command> [arguments]

Commands:
  all                   Clean all conversation files
  clean <id>           Clean specific conversation by ID or filename

Examples:
  node clean-cache-blocks.js all
  node clean-cache-blocks.js clean 1
  node clean-cache-blocks.js clean conversation-2025-09-16T09-31-36-920Z.json

This script removes redundant cache control blocks from conversation history,
keeping them only on:
• System messages
• The final assistant message in each conversation

⚠️  Always backup your conversation logs before running this script!
`);
}
