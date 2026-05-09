// AI provider routes and status
import { aiManager } from '../services/ai/ai-manager.js';
import { sendJson, sendSuccess, sendError, sendAIStatus } from '../utils/response-utils.js';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import { ValidationError } from '../middleware/error-handler.js';

export async function handleAIRoutes(request, response, pathname) {
  const { method } = request;

  // GET /api/ai/status - Get AI provider status
  if (pathname === '/api/ai/status' && method === 'GET') {
    try {
      const health = await aiManager.health();
      sendAIStatus(response, Object.values(health.providers));
      return true;
    } catch (error) {
      console.error('AI status error:', error);
      sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'Failed to get AI status', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
      return true;
    }
  }

  // GET /api/ai/providers - Get available AI providers
  if (pathname === '/api/ai/providers' && method === 'GET') {
    try {
      const providers = await aiManager.getAvailableProviders();
      sendSuccess(response, providers, 'Available AI providers');
      return true;
    } catch (error) {
      console.error('AI providers error:', error);
      sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'Failed to get AI providers', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
      return true;
    }
  }

  // GET /api/ai/stats - Get AI usage statistics
  if (pathname === '/api/ai/stats' && method === 'GET') {
    try {
      const stats = aiManager.getStats();
      sendSuccess(response, stats, 'AI usage statistics');
      return true;
    } catch (error) {
      console.error('AI stats error:', error);
      sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'Failed to get AI stats', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
      return true;
    }
  }

  // POST /api/ai/test - Test AI generation
  if (pathname === '/api/ai/test' && method === 'POST') {
    try {
      // Parse request body
      const body = await parseRequestBody(request);
      
      // Validate input
      const { prompt, provider, options = {} } = body;
      if (!prompt || typeof prompt !== 'string') {
        throw new ValidationError('Prompt is required and must be a string');
      }

      if (prompt.length > 10000) {
        throw new ValidationError('Prompt too long (max 10000 characters)');
      }

      // Set preferred provider if specified
      if (provider && typeof provider === 'string') {
        options.preferredProvider = provider;
      }

      console.log(`🧪 Testing AI with prompt: "${prompt.substring(0, 50)}..."`);
      
      // Generate response
      const result = await aiManager.generateResponse(prompt, options);
      
      if (result.success) {
        sendSuccess(response, {
          prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
          response: result.content,
          provider: result.provider,
          model: result.model,
          duration: result.duration,
          tokens: result.tokens,
          fallback: result.fallback || false
        }, 'AI test successful');
      } else {
        sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, result.error || 'AI generation failed', ERROR_CODES.AI_GENERATION_FAILED);
      }
      
      return true;
    } catch (error) {
      console.error('AI test error:', error);
      
      if (error instanceof ValidationError) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, error.message, ERROR_CODES.VALIDATION_ERROR);
      } else {
        sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'AI test failed', ERROR_CODES.AI_GENERATION_FAILED);
      }
      return true;
    }
  }

  // POST /api/ai/chat - Test AI chat
  if (pathname === '/api/ai/chat' && method === 'POST') {
    try {
      // Parse request body
      const body = await parseRequestBody(request);
      
      // Validate input
      const { messages, provider, options = {} } = body;
      if (!messages || !Array.isArray(messages)) {
        throw new ValidationError('Messages array is required');
      }

      if (messages.length === 0) {
        throw new ValidationError('At least one message is required');
      }

      // Validate message format
      for (const msg of messages) {
        if (!msg.role || !msg.content) {
          throw new ValidationError('Each message must have role and content');
        }
        if (!['user', 'assistant', 'system'].includes(msg.role)) {
          throw new ValidationError('Invalid message role');
        }
      }

      // Set preferred provider if specified
      if (provider && typeof provider === 'string') {
        options.preferredProvider = provider;
      }

      console.log(`🧪 Testing AI chat with ${messages.length} messages`);
      
      // Generate chat response
      const result = await aiManager.chat(messages, options);
      
      if (result.success) {
        sendSuccess(response, {
          messages: messages.map(m => ({
            role: m.role,
            content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
          })),
          response: result.content,
          provider: result.provider,
          model: result.model,
          duration: result.duration,
          fallback: result.fallback || false
        }, 'AI chat test successful');
      } else {
        sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, result.error || 'AI chat failed', ERROR_CODES.AI_GENERATION_FAILED);
      }
      
      return true;
    } catch (error) {
      console.error('AI chat test error:', error);
      
      if (error instanceof ValidationError) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, error.message, ERROR_CODES.VALIDATION_ERROR);
      } else {
        sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'AI chat test failed', ERROR_CODES.AI_GENERATION_FAILED);
      }
      return true;
    }
  }

  // POST /api/ai/switch - Switch active AI provider
  if (pathname === '/api/ai/switch' && method === 'POST') {
    try {
      // Parse request body
      const body = await parseRequestBody(request);
      
      // Validate input
      const { provider } = body;
      if (!provider || typeof provider !== 'string') {
        throw new ValidationError('Provider name is required');
      }

      console.log(`🔄 Switching to AI provider: ${provider}`);
      
      // Switch provider
      await aiManager.switchProvider(provider);
      
      sendSuccess(response, {
        activeProvider: provider,
        timestamp: new Date().toISOString()
      }, `Switched to ${provider}`);
      
      return true;
    } catch (error) {
      console.error('AI switch error:', error);
      
      if (error instanceof ValidationError) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, error.message, ERROR_CODES.VALIDATION_ERROR);
      } else {
        sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'Failed to switch AI provider', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
      }
      return true;
    }
  }

  // POST /api/ai/reset-stats - Reset AI statistics
  if (pathname === '/api/ai/reset-stats' && method === 'POST') {
    try {
      aiManager.resetStats();
      sendSuccess(response, {
        message: 'AI statistics reset',
        timestamp: new Date().toISOString()
      }, 'AI statistics reset successfully');
      return true;
    } catch (error) {
      console.error('AI reset stats error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to reset AI stats', ERROR_CODES.INTERNAL_SERVER_ERROR);
      return true;
    }
  }

  // GET /api/cascade/status - Get cascade status
  if (pathname === '/api/cascade/status' && method === 'GET') {
    try {
      const health = await aiManager.health();
      const cascade = {
        active: true,
        providers: Object.entries(health.providers).map(([name, provider]) => ({
          name,
          available: provider.available,
          priority: provider.priority || 0
        })).sort((a, b) => a.priority - b.priority),
        currentProvider: health.activeProvider || 'ollama',
        fallbackChain: ['ollama', 'gemini', 'openai', 'anthropic'],
        stats: aiManager.getStats()
      };
      
      sendSuccess(response, { cascade }, 'Cascade status retrieved');
      return true;
    } catch (error) {
      console.error('Cascade status error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to get cascade status', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // POST /api/qr-upload/generate - Generate QR upload session
  if (pathname === '/api/qr-upload/generate' && method === 'POST') {
    try {
      const sessionId = generateSessionId();
      const uploadToken = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
      
      // In production, store in database
      const uploadUrl = `http://localhost:3001/api/qr-upload/${sessionId}/upload?token=${uploadToken}`;
      
      sendSuccess(response, {
        sessionId,
        uploadToken,
        expiresAt,
        uploadUrl
      }, 'QR session generated');
      return true;
    } catch (error) {
      console.error('QR generate error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to generate QR session', ERROR_CODES.INTERNAL_SERVER_ERROR);
      return true;
    }
  }

  // GET /api/qr-upload/:sessionId/status - Get QR session status
  if (pathname.match(/^\/api\/qr-upload\/[^/]+\/status$/) && method === 'GET') {
    try {
      const parts = pathname.split('/');
      const sessionId = parts[3];
      const token = request.searchParams?.get('token') || new URL(request.url, `http://${request.headers.host}`).searchParams.get('token');
      
      // In production, check database for session status
      const status = {
        sessionId,
        status: 'waiting', // waiting, uploaded, expired
        fileInfo: null
      };
      
      sendSuccess(response, status, 'Session status retrieved');
      return true;
    } catch (error) {
      console.error('QR status error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to get session status', ERROR_CODES.INTERNAL_SERVER_ERROR);
      return true;
    }
  }

  return false;
}

function generateSessionId() {
  return 'qr-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Parse request body from stream
 */
async function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    
    request.on('data', chunk => {
      body += chunk.toString();
      
      // Prevent memory issues with large payloads
      if (body.length > 1024 * 1024) { // 1MB limit
        reject(new Error('Request body too large'));
        return;
      }
    });
    
    request.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (error) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    
    request.on('error', reject);
  });
}

export default {
  handleAIRoutes
};
