# Claude Terminal with Chat Resume Feature

This enhanced version of the Claude Terminal application includes the ability to resume previous conversations using saved conversation logs.

## Features

### 🔄 Chat Resume

- Automatically saves all conversations to `conversation-logs/` directory
- Resume any of your last 10 conversations
- **Smart sorting by last activity** - most recently active conversations appear first
- View conversation metadata (last modified time, last message, message count)
- Context preview showing recent messages when resuming

### 🛠️ Special Commands

- `exit` - Quit the application
- `save` - Manually save current conversation
- `history` - Show current conversation statistics

### 📁 Conversation Management

- All conversations are automatically saved as JSON files
- Files are named with timestamps: `conversation-YYYY-MM-DDTHH-mm-ss-sssZ.json`
- Recent conversation context is displayed when resuming

## Usage

### Starting the Application

```bash
npm run claude-terminal-resume
```

### Resume Flow

1. When you start the application, you'll see a list of recent conversations sorted by last activity:

```
🕐 Previous Conversations (sorted by last activity):
────────────────────────────────────────────────────────────────────────────────
ID | Last Modified       | Last Message                      | Messages
────────────────────────────────────────────────────────────────────────────────
 1 | 09/16 16:46         | thanks                              | 48
 2 | 09/16 15:55         | list all wifi networks              | 7
 3 | 09/16 15:55         | write the folwing script as a file  | 5
────────────────────────────────────────────────────────────────────────────────
Enter conversation ID to resume (1-10), or press Enter for new conversation:
```

2. Choose an ID (1-10) to resume that conversation, or press Enter for a new one

3. If resuming, you'll see recent conversation context:

```
✅ Resumed conversation from conversation-2025-09-16T09-31-36-920Z.json
📊 Loaded 4 messages

📝 Recent conversation context:
──────────────────────────────────────────────────
You: check my swap memory
Claude: I'll check your swap memory usage for you...
──────────────────────────────────────────────────
```

### Conversation Data Structure

Each conversation log contains an array of `CoreMessage` objects with the following structure:

```json
[
  {
    "role": "system",
    "content": "You are a helpful assistant with terminal access...",
    "providerOptions": {
      "anthropic": {
        "cacheControl": {
          "type": "ephemeral"
        }
      }
    }
  },
  {
    "role": "user",
    "content": "check my swap memory"
  },
  {
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll check your swap memory usage for you."
      },
      {
        "type": "tool-call",
        "toolCallId": "toolu_...",
        "toolName": "executeCommand",
        "args": {
          "command": "free -h"
        }
      }
    ],
    "id": "msg-..."
  },
  {
    "role": "tool",
    "content": [
      {
        "type": "tool-result",
        "toolCallId": "toolu_...",
        "toolName": "executeCommand",
        "result": {
          "success": true,
          "output": "...",
          "exitCode": 0
        }
      }
    ]
  }
]
```

## Benefits

1. **Continuity**: Pick up conversations where you left off
2. **Context Preservation**: Full conversation history including tool calls and results
3. **Easy Navigation**: Quick overview of recent conversations
4. **Auto-Save**: Never lose your conversation progress
5. **Manual Control**: Use `save` command for important checkpoints

## Comparison with Original

| Feature              | Original | Resume Version |
| -------------------- | -------- | -------------- |
| Basic chat           | ✅       | ✅             |
| Terminal commands    | ✅       | ✅             |
| Conversation logging | ✅       | ✅             |
| Resume conversations | ❌       | ✅             |
| Conversation browser | ❌       | ✅             |
| Context preview      | ❌       | ✅             |
| Special commands     | ❌       | ✅             |
| Auto-save            | ❌       | ✅             |

The resume version maintains full compatibility with the original while adding powerful conversation management features.
