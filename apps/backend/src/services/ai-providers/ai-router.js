import { ollamaAIService } from '../ollama-ai-service.js';
import { geminiService } from './gemini-service.js';
import { localNLPService } from './local-nlp-service.js';

class AIRouter {
  constructor() {
    this.providerPriority = this.parseProviderPriority();
    this.lastUsedProvider = null;
    this.providerStats = {
      ollama: { calls: 0, successes: 0, errors: 0 },
      gemini: { calls: 0, successes: 0, errors: 0 },
      local: { calls: 0, successes: 0, errors: 0 },
    };
  }

  parseProviderPriority() {
    const priority = process.env.AI_PROVIDER_PRIORITY || 'ollama,gemini,local';
    return priority.split(',').map(p => p.trim().toLowerCase());
  }

  async getAvailableProviders() {
    const providers = [];
    
    // Check Ollama availability
    if (this.providerPriority.includes('ollama')) {
      const ollamaAvailable = await ollamaAIService.isAvailable();
      if (ollamaAvailable) {
        providers.push({ name: 'ollama', service: ollamaAIService });
      }
    }

    // Check Gemini availability
    if (this.providerPriority.includes('gemini')) {
      const geminiAvailable = await geminiService.isAvailable();
      if (geminiAvailable) {
        providers.push({ name: 'gemini', service: geminiService });
      }
    }

    // Always include local NLP as fallback
    if (this.providerPriority.includes('local')) {
      const localAvailable = await localNLPService.isAvailable();
      if (localAvailable) {
        providers.push({ name: 'local', service: localNLPService });
      }
    }

    return providers;
  }

  async generateResponse(prompt, context = {}) {
    const availableProviders = await this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      return {
        success: false,
        error: 'No AI providers available',
        provider: 'none',
        content: 'I apologize, but no AI services are currently available. Please check your configuration.',
      };
    }

    // Try providers in priority order
    for (const { name, service } of availableProviders) {
      try {
        this.providerStats[name].calls++;
        
        const result = await service.generateResponse(prompt, context);
        
        if (result.success) {
          this.providerStats[name].successes++;
          this.lastUsedProvider = name;
          
          return {
            ...result,
            fallbackUsed: availableProviders.length > 1 && name !== availableProviders[0].name,
            availableProviders: availableProviders.map(p => p.name),
          };
        } else {
          this.providerStats[name].errors++;
          console.warn(`${name} provider failed:`, result.error);
          // Continue to next provider
        }
      } catch (error) {
        this.providerStats[name].errors++;
        console.error(`${name} provider error:`, error.message);
        // Continue to next provider
      }
    }

    // All providers failed
    return {
      success: false,
      error: 'All AI providers failed',
      provider: 'none',
      content: 'I apologize, but all AI services are currently experiencing issues. Please try again later.',
      providerStats: this.providerStats,
    };
  }

  async testAllProviders() {
    const results = {};
    
    for (const providerName of this.providerPriority) {
      let service;
      
      switch (providerName) {
        case 'ollama':
          service = ollamaAIService;
          break;
        case 'gemini':
          service = geminiService;
          break;
        case 'local':
          service = localNLPService;
          break;
        default:
          continue;
      }
      
      try {
        results[providerName] = await service.testConnection();
      } catch (error) {
        results[providerName] = {
          success: false,
          error: error.message,
        };
      }
    }
    
    return {
      results,
      priority: this.providerPriority,
      lastUsed: this.lastUsedProvider,
      stats: this.providerStats,
    };
  }

  getProviderStats() {
    return {
      priority: this.providerPriority,
      lastUsed: this.lastUsedProvider,
      stats: this.providerStats,
    };
  }

  resetStats() {
    this.providerStats = {
      ollama: { calls: 0, successes: 0, errors: 0 },
      gemini: { calls: 0, successes: 0, errors: 0 },
      local: { calls: 0, successes: 0, errors: 0 },
    };
  }

  async healthCheck() {
    const availableProviders = await this.getAvailableProviders();
    return {
      status: availableProviders.length > 0 ? 'healthy' : 'unhealthy',
      availableProviders: availableProviders.map(p => p.name),
      configuredProviders: this.providerPriority,
      lastUsedProvider: this.lastUsedProvider,
    };
  }
}

export const aiRouter = new AIRouter();
