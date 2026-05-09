// Main route aggregator
import { handleDatasetRoutes } from './datasets.js';
import { handleChatRoutes } from './chat.js';
import { handleAnalyticsRoutes } from './analytics.js';
import { handleAIRoutes } from './ai.js';
import { handleHealthRoutes } from './health.js';
import { handleExportRoutes } from './export.js';
import { handleMLRoutes } from './machine-learning.js';
import { handleStateRoutes } from './state.js';
import { sendError, sendSuccess } from '../utils/response-utils.js';
import { HTTP_STATUS } from '../config/constants.js';

export async function setupRoutes(request, response) {
  const { method, pathname } = request;

  try {
    // State routes (for frontend state management)
    if (await handleStateRoutes(request, response, pathname)) {
      return;
    }

    // Health check routes (highest priority)
    if (await handleHealthRoutes(request, response, pathname)) {
      return;
    }

    // AI provider routes
    if (await handleAIRoutes(request, response, pathname)) {
      return;
    }

    // Dataset routes
    if (await handleDatasetRoutes(request, response, pathname)) {
      return;
    }

    // Chat routes
    if (await handleChatRoutes(request, response, pathname)) {
      return;
    }

    // Analytics routes
    if (await handleAnalyticsRoutes(request, response, pathname)) {
      return;
    }

    // Export routes
    if (await handleExportRoutes(request, response, pathname)) {
      return;
    }

    // ML/AutoML routes
    if (await handleMLRoutes(request, response, pathname)) {
      return;
    }

    // Route not found
    if (method === 'GET' && pathname === '/') {
      // Root endpoint
      sendSuccess(response, {
        name: 'InsightFlow API',
        version: '2.0.0',
        description: 'AI-powered data analytics platform',
        endpoints: {
          health: '/api/health',
          ai: '/api/ai/*',
          datasets: '/api/datasets/*',
          chat: '/api/datasets/:id/chat',
          analytics: '/api/datasets/:id/analyze',
          export: '/api/datasets/:id/export'
        },
        documentation: '/api/docs',
        timestamp: new Date().toISOString()
      }, 'InsightFlow API is running');
    } else {
      // 404 Not Found
      sendError(response, HTTP_STATUS.NOT_FOUND, `Route not found: ${method} ${pathname}`, 'ROUTE_NOT_FOUND');
    }

  } catch (error) {
    console.error('Route setup error:', error);
    sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error', 'ROUTE_ERROR');
  }
}

export default {
  setupRoutes
};
