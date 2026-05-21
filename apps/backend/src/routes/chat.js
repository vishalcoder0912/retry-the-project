import { randomUUID } from 'node:crypto';
import { sendSuccess, sendError } from '../utils/response-utils.js';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import {
  clearChatMessages,
  getChatMessages,
  getDatasetById,
  saveChatMessage,
} from '../database/dataset-repository.js';
import { runDashboardAIAgent } from '../services/dashboard-ai-agent.js';
import { runLlamaDatasetChat } from '../services/llama-chat-agent.js';

async function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk.toString();

      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });

    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    request.on('error', reject);
  });
}

function normalizeMessage(message) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    chart: message.chart || null,
    insights: message.insights || [],
    timestamp: message.timestamp || message.createdAt || new Date().toISOString(),
    provider: message.provider,
    model: message.model,
  };
}

export async function handleChatRoutes(request, response, pathname) {
  const { method } = request;

  if (
    pathname.match(/^\/api\/datasets\/[^/]+\/dashboard-command$/) &&
    method === 'POST'
  ) {
    try {
      const datasetId = pathname.split('/')[3];
      const body = await getRequestBody(request);
      const query = String(body.query || '').trim();

      if (!query) {
        sendError(
          response,
          HTTP_STATUS.BAD_REQUEST,
          'Query is required',
          ERROR_CODES.VALIDATION_ERROR,
        );
        return true;
      }

      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendError(
          response,
          HTTP_STATUS.NOT_FOUND,
          'Dataset not found',
          ERROR_CODES.DATASET_NOT_FOUND,
        );
        return true;
      }

      const result = await runDashboardAIAgent(dataset, query);

      sendSuccess(response, result, 'Dashboard AI command completed');
      return true;
    } catch (error) {
      console.error('[DASHBOARD AI ERROR]', error);

      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'Dashboard AI failed',
        ERROR_CODES.AI_GENERATION_FAILED,
      );
      return true;
    }
  }

  if (
    pathname.match(/^\/api\/datasets\/[^/]+\/chat$/) &&
    method === 'POST'
  ) {
    try {
      const datasetId = pathname.split('/')[3];
      const body = await getRequestBody(request);
      const query = String(body.query || '').trim();

      if (!query) {
        sendError(
          response,
          HTTP_STATUS.BAD_REQUEST,
          'Query is required',
          ERROR_CODES.VALIDATION_ERROR,
        );
        return true;
      }

      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendError(
          response,
          HTTP_STATUS.NOT_FOUND,
          'Dataset not found',
          ERROR_CODES.DATASET_NOT_FOUND,
        );
        return true;
      }

      const now = new Date().toISOString();

      const userMessage = {
        id: randomUUID(),
        role: 'user',
        content: query,
        timestamp: now,
      };

      const aiResult = await runLlamaDatasetChat(dataset, query);

      const assistantMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: [
          aiResult.content,
          aiResult.schemaOnly
            ? '\n\nSchema-only mode: raw rows were not sent to AI.'
            : '',
          aiResult.model ? `\nModel: ${aiResult.model}` : '',
          aiResult.aiError ? `\nFallback used: ${aiResult.aiError}` : '',
        ]
          .filter(Boolean)
          .join(''),
        chart: aiResult.chart || null,
        insights: aiResult.insights || [],
        timestamp: now,
        provider: aiResult.provider,
        model: aiResult.model,
      };

      try {
        saveChatMessage(datasetId, userMessage);
        saveChatMessage(datasetId, assistantMessage);
      } catch (error) {
        console.warn('[CHAT HISTORY SAVE WARNING]', error.message);
      }

      sendSuccess(
        response,
        {
          userMessage,
          assistantMessage,
        },
        'Chat response generated',
      );

      return true;
    } catch (error) {
      console.error('[AI CHAT ERROR]', error);

      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'AI chat failed',
        ERROR_CODES.AI_GENERATION_FAILED,
      );

      return true;
    }
  }

  if (
    pathname.match(/^\/api\/datasets\/[^/]+\/chat\/history$/) &&
    method === 'GET'
  ) {
    try {
      const datasetId = pathname.split('/')[3];
      const messages = getChatMessages(datasetId).map(normalizeMessage);

      sendSuccess(response, { messages }, 'Chat history loaded');
      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to load chat history',
        ERROR_CODES.DATABASE_ERROR,
      );
      return true;
    }
  }

  if (
    pathname.match(/^\/api\/datasets\/[^/]+\/chat\/history$/) &&
    method === 'DELETE'
  ) {
    try {
      const datasetId = pathname.split('/')[3];
      clearChatMessages(datasetId);

      sendSuccess(response, { messages: [] }, 'Chat history cleared');
      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to clear chat history',
        ERROR_CODES.DATABASE_ERROR,
      );
      return true;
    }
  }

  return false;
}

export default {
  handleChatRoutes,
};
