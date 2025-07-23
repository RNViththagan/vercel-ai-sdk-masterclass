import "dotenv/config";
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool } from 'ai';
import * as readline from 'readline';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const main = async () => {
  console.log("🤖 Claude with Terminal Access - Type 'exit' to quit\n");

  const execAsync = promisify(exec);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Terminal execution tool
  const executeCommand = tool({
    description: 'Execute terminal commands as if opening a terminal and running them directly. Use this for any command-line operations.',
    parameters: z.object({
      command: z.string().describe('The terminal command to execute'),
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
          output: stdout || stderr || 'Command completed',
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
      rl.question('You: ', (answer) => {
        resolve(answer);
      });
    });
  };

  try {
    while (true) {
      const userInput = await askQuestion();

      if (userInput.toLowerCase() === 'exit') {
        console.log('Goodbye! 👋');
        break;
      }

      // Add user message to conversation
      messages.push({ role: 'user', content: userInput });

      console.log('\nClaude: ');

      const result = await streamText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        messages: messages,
        tools: {
          executeCommand,
        },
        maxSteps: 5,
      });

      let assistantResponse = '';
      for await (const textPart of result.textStream) {
        process.stdout.write(textPart);
        assistantResponse += textPart;
      }

      // Add assistant response to conversation history
      messages.push({ role: 'assistant', content: assistantResponse });

      console.log('\n'); // Add newlines for spacing
    }
  } catch (error) {
    console.error('Error with Claude:', error);
    console.log('Make sure to set ANTHROPIC_API_KEY in your .env file');
  } finally {
    rl.close();
  }
}

main().catch(console.error);
