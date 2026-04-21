import { callOllamaAI } from './apps/backend/src/services/ollama-service.js';
import { callGeminiAI } from './apps/backend/src/services/gemini-ai-service.js';

// Load .env variables since we are running this script directly
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const dataset = {
    name: 'Test Dataset',
    rowCount: 100,
    columns: [
      { name: 'id', type: 'number' },
      { name: 'department', type: 'string' },
      { name: 'salary', type: 'number' }
    ]
  };
  
  console.log("===============================");
  console.log("1. Testing Ollama AI...");
  const startOllama = Date.now();
  const ollamaResponse = await callOllamaAI(dataset, "What is the average salary by department?");
  console.log(`⏱️ Took ${Date.now() - startOllama}ms`);
  console.log(ollamaResponse);
  
  console.log("\n===============================");
  console.log("2. Testing Gemini AI...");
  const startGemini = Date.now();
  try {
    const geminiResponse = await callGeminiAI(dataset, "What is the average salary by department?");
    console.log(`⏱️ Took ${Date.now() - startGemini}ms`);
    console.log(geminiResponse);
  } catch (error) {
    console.log("Gemini failed:", error.message);
  }
}

test();
