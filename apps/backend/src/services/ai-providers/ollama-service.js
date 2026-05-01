import axios from 'axios';
import { extractSchemaForAI, buildSchemaOnlyPrompt, validateSchemaOnlyContext } from '../../utils/schema-extractor.js';

class OllamaService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama3.2:latest';
    this.timeout = parseInt(process.env.AI_TIMEOUT_MS) || 30000;
  }

  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async generateResponse(prompt, context = {}) {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`;

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
            num_predict: parseInt(process.env.AI_MAX_TOKENS) || 2048,
          }
        },
        { timeout: this.timeout }
      );

      return {
        success: true,
        content: response.data.response?.trim() || '',
        provider: 'ollama',
        model: this.model,
      };
    } catch (error) {
      console.error('Ollama API Error:', error.message);
      return {
        success: false,
        error: error.message,
        provider: 'ollama',
      };
    }
  }

  buildSystemPrompt(context) {
    // Validate that no actual data is being sent
    const validation = validateSchemaOnlyContext(context);
    if (!validation.isValid) {
      console.warn('Ollama service detected potential data leakage:', validation.violations);
    }
    
    const { dataset, schema } = context;
    
    // Use schema-only approach
    if (dataset && schema) {
      return buildSchemaOnlyPrompt('', extractSchemaForAI(dataset, schema));
    }
    
    return `You are an intelligent data analyst assistant for InsightFlow. You help users analyze datasets and provide insights based on schema information only.

Your capabilities:
- Answer questions about data patterns and trends based on schema structure
- Generate SQL queries for data analysis
- Create data visualizations recommendations
- Provide business insights and recommendations

Guidelines:
1. Be concise but thorough in your responses
2. When suggesting charts, specify the chart type (bar, line, area, pie)
3. Provide SQL queries when relevant for data analysis
4. Focus on actionable insights based on schema structure
5. If you don't have enough information, ask clarifying questions
6. NEVER reference specific data values - you only have access to schema information

Respond in a helpful, professional manner.`;
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/version`, { timeout: 5000 });
      return {
        success: true,
        version: response.data.version,
        model: this.model,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const ollamaService = new OllamaService();
