import { publicModelConfig } from '../config/agentic-models.js';
import { OLLAMA_AGENT_MODELS } from '../config/ollama-agent-models.js';
import { pingOllamaModels } from '../services/agentic/ollama-agent-router.js';
import {
  runModelAwareAgenticAnalysis,
  runModelAwareAgenticChat,
} from '../services/agentic/model-aware-agentic-orchestrator.js';
import { getDatasetById } from '../database/dataset-repository.js';
import { sendSuccess, sendError } from '../utils/response-utils.js';
import { HTTP_STATUS } from '../config/constants.js';

async function parseJsonBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;

  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 10_000_000) {
        reject(new Error('Request body too large'));
      }
    });
    request.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    request.on('error', reject);
  });
}

function datasetIdFromPath(pathname, suffix) {
  const prefix = '/api/agentic-models/datasets/';
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
  return pathname.slice(prefix.length, pathname.length - suffix.length).replace(/^\/+|\/+$/g, '');
}

async function loadDatasetOrThrow(datasetId) {
  let dataset = getDatasetById(datasetId);
  if (!dataset && globalThis.__INSIGHTFLOW_E2E_STORE__?.datasets) {
    dataset = globalThis.__INSIGHTFLOW_E2E_STORE__.datasets.get(datasetId);
  }
  if (!dataset) {
    const err = new Error(`Dataset not found: ${datasetId}`);
    err.statusCode = HTTP_STATUS.NOT_FOUND;
    throw err;
  }
  return dataset;
}

export async function handleAgenticModelRoutes(request, response, pathname) {
  const { method } = request;

  if (pathname === '/api/agentic-models/config' && method === 'GET') {
    sendSuccess(response, publicModelConfig(), 'Agentic model config loaded');
    return true;
  }

  if (pathname === '/api/agentic-models/health' && method === 'GET') {
    const models = [...new Set(Object.values(OLLAMA_AGENT_MODELS))];
    const checks = await pingOllamaModels(models);
    sendSuccess(response, { checks }, 'Agentic model health checked');
    return true;
  }

  const analysisDatasetId = datasetIdFromPath(pathname, '/analyze');
  if (analysisDatasetId && method === 'POST') {
    try {
      const body = await parseJsonBody(request);
      const dataset = await loadDatasetOrThrow(analysisDatasetId);
      const result = await runModelAwareAgenticAnalysis({
        rows: dataset.rows || [],
        columns: dataset.columns || [],
        goal: body.goal || 'Create the best data analytics dashboard.',
      });
      sendSuccess(response, result, 'Model-aware agentic analysis complete');
      return true;
    } catch (error) {
      sendError(
        response,
        error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'Agentic analysis failed',
        'AGENTIC_ANALYSIS_ERROR',
      );
      return true;
    }
  }

  const chatDatasetId = datasetIdFromPath(pathname, '/chat');
  if (chatDatasetId && method === 'POST') {
    try {
      const body = await parseJsonBody(request);
      const dataset = await loadDatasetOrThrow(chatDatasetId);
      const result = await runModelAwareAgenticChat({
        rows: dataset.rows || [],
        columns: dataset.columns || [],
        message: body.message || body.query || '',
        history: body.history || [],
      });
      sendSuccess(response, result, 'Model-aware agentic chat complete');
      return true;
    } catch (error) {
      sendError(
        response,
        error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'Agentic chat failed',
        'AGENTIC_CHAT_ERROR',
      );
      return true;
    }
  }

  return false;
}
