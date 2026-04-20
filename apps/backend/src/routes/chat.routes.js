/**
 * Chat Routes
 * API endpoints for AI chat functionality
 */

import { randomUUID } from 'node:crypto';
import { getDatasetById, saveChatMessages, getChatMessages } from '../database/dataset-repository.js';
import { createSchemaFirstChatResponse } from '../services/analytics-service.js';
import { validateRequired } from '../middleware/validation.middleware.js';
import { NotFoundError, AppError } from '../middleware/error.middleware.js';
import logger from '../middleware/logger.middleware.js';

/**
 * Register chat routes
 * @param {Object} server - HTTP server instance
 */
export function registerChatRoutes(server) {
  const sendJson = (res, status, payload) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(payload));
  };
  
  server.on('request', async (req, res) => {
    const url = req.url ? new URL(req.url, `http://${req.headers.host}`) : null;
    if (!url) return;
    
    const pathname = url.pathname;
    
    try {
      // POST /api/datasets/:id/chat - Send chat message
      const chatMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/chat$/);
      if (req.method === 'POST' && chatMatch) {
        const [, datasetId] = chatMatch;
        const body = await readJsonBody(req);
        
        // Validate required fields
        validateRequired(body, ['query']);
        
        const query = String(body.query).trim();
        if (!query) {
          throw new AppError('Query cannot be empty', 400, 'VALIDATION_ERROR');
        }
        
        // Get dataset
        const dataset = getDatasetById(datasetId);
        if (!dataset) {
          throw new NotFoundError('Dataset not found');
        }
        
        logger.info('Processing chat query', { 
          datasetId, 
          query: query.substring(0, 50) 
        });
        
        // Get existing chat messages
        const existingMessages = getChatMessages(datasetId);
        
        // Process with AI (schema-first approach)
        const analysis = await createSchemaFirstChatResponse(dataset, query);
        
        const now = new Date().toISOString();
        const userMessage = {
          id: randomUUID(),
          role: 'user',
          content: query,
          timestamp: now,
        };
        
        const assistantMessage = {
          id: randomUUID(),
          role: 'assistant',
          content: analysis.content,
          sql: analysis.sql,
          chart: analysis.chart,
          insights: analysis.insights,
          timestamp: now,
          usedAI: analysis.usedAI,
          confidence: analysis.confidence,
          intent: analysis.intent,
          reason: analysis.reason,
          metadata: analysis.metadata,
        };
        
        // Save messages
        saveChatMessages(datasetId, [userMessage, assistantMessage]);
        
        logger.info('Chat response generated', {
          datasetId,
          usedAI: analysis.usedAI,
          confidence: analysis.confidence,
        });
        
        sendJson(res, 201, { 
          userMessage, 
          assistantMessage,
          chatHistory: [...existingMessages, userMessage, assistantMessage],
        });
        return;
      }
      
      // GET /api/datasets/:id/chat - Get chat history
      const historyMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/chat$/);
      if (req.method === 'GET' && historyMatch) {
        const [, datasetId] = historyMatch;
        
        const dataset = getDatasetById(datasetId);
        if (!dataset) {
          throw new NotFoundError('Dataset not found');
        }
        
        const messages = getChatMessages(datasetId);
        sendJson(res, 200, { messages });
        return;
      }
      
    } catch (error) {
      throw error;
    }
  });
  
  logger.info('Chat routes registered');
}

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 60 * 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}

export default registerChatRoutes;