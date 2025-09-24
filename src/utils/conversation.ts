import { ModelMessage } from "ai";

/**
 * Appends final messages to the conversation history with proper cache control
 * @param history - The existing conversation history
 * @parameter finalMessages - The new messages to append
 * @param cache - Whether to apply cache control to the last assistant message
 */
export const appendFinalMessages = (
  history: Array<ModelMessage>,
  finalMessages: Array<ModelMessage>,
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

    if (m.role === "assistant" || m.role === "tool") {
      // Only the last assistant message gets the cache breakpoint
      if (cache && i === finalMessages.length - 1 && m.role === "assistant") {
        m.providerOptions = {
          anthropic: { cacheControl: { type: "ephemeral" } },
        };
      }

      history.push(m as ModelMessage);
    }
  }
};
