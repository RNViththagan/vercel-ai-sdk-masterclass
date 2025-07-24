import "dotenv/config";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output, tool } from "ai";
import z from "zod";

const BOT_NAME = process.env.BOT_NAME || "Bot";
async function main() {
  console.log("Hello, world!");

  // Example using Claude model
  try {
    const result = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      //system: "You are a helpful assistant. you can answer questions and provide information. and your name is " + BOT_NAME,
      messages: [
        {
          role: "user",
          content:
            "Get the weather in SF and NY, then add them together  //ps.(get needed latitude and longitude details your self). ",
        },
      ],
      maxSteps: 5,
      tools: {
        addNumbers: tool({
          description: "Adds two numbers together",
          parameters: z.object({
            num1: z.number(),
            num2: z.number(),
          }),
          execute: async ({ num1, num2 }) => {
            return num1 + num2;
          },
        }),
        getWeather: tool({
          description: "Get the current weather at a location",
          parameters: z.object({
            latitude: z.number(),
            longitude: z.number(),
            city: z.string(),
          }),
          execute: async ({ latitude, longitude, city }) => {
            const response = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,relativehumidity_2m&timezone=auto`
            );

            const weatherData = await response.json();
            return {
              temperature: weatherData.current.temperature_2m,
              weatherCode: weatherData.current.weathercode,
              humidity: weatherData.current.relativehumidity_2m,
              city,
            };
          },
        }),
      },
      experimental_output: Output.object({
        schema: z.object({ sum: z.number() }),
      }),
    });

    //console.log("Generated text:", result, "\n");
    console.log(BOT_NAME + ":", result.text);

    //console.log("Tool Results:", result.toolResults, "\n");
    console.log("Steps Count:", result.steps.length);
    console.log("Result Steps:", JSON.stringify(result.steps, null, 2), "\n");

    console.log("Experimental Output:", result.experimental_output);
  } catch (error) {
    console.error("Error with Claude:", error);
    console.log("Make sure to set ANTHROPIC_API_KEY in your .env file");
  }
}

main().catch(console.error);
