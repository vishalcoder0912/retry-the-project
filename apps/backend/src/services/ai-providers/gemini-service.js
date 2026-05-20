import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractSchemaForAI, buildSchemaOnlyPrompt, validateSchemaOnlyContext } from '../../utils/schema-extractor.js';

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';
    this.timeout = parseInt(process.env.AI_TIMEOUT_MS) || 30000;
    this.maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 2048;
    this.temperature = parseFloat(process.env.AI_TEMPERATURE) || 0.7;
    
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: this.temperature,
        }
      });
    }
  }

  async isAvailable() {
    return !!(this.apiKey && this.model);
  }

  async generateResponse(prompt, context = {}) {
    try {
      if (!this.isAvailable()) {
        return {
          success: false,
          error: 'Gemini API key not configured',
          provider: 'gemini',
        };
      }

      const systemPrompt = this.buildSystemPrompt(context);
      const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`;

      const result = await Promise.race([
        this.model.generateContent(fullPrompt),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), this.timeout)
        )
      ]);

      const response = await result.response;
      const content = response.text();

      return {
        success: true,
        content: content?.trim() || '',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
      };
    } catch (error) {
      console.error('Gemini API Error:', error.message);
      return {
        success: false,
        error: error.message,
        provider: 'gemini',
      };
    }
  }

  buildSystemPrompt(context) {
    // Validate that no actual data is being sent
    const validation = validateSchemaOnlyContext(context);
    if (!validation.isValid) {
      console.warn('Gemini service detected potential data leakage:', validation.violations);
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
      if (!this.isAvailable()) {
        return {
          success: false,
          error: 'Gemini API key not configured',
        };
      }

      const result = await Promise.race([
        this.model.generateContent('Hello, can you respond with "Connection successful"?'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        )
      ]);

      const response = await result.response;
      const content = response.text();

      return {
        success: true,
        model: 'gemini-1.5-flash',
        response: content?.trim() || '',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const geminiService = new GeminiService();
