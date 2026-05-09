// Chat-related routes with AI integration
import { sendSuccess, sendError } from '../utils/response-utils.js';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import { getState, addChatMessage, clearChat } from './state.js';
import { randomUUID } from 'crypto';

// Helper to read request body
async function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => { body += chunk.toString(); });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(new Error('Invalid JSON body')); }
    });
    request.on('error', reject);
  });
}

export async function handleChatRoutes(request, response, pathname) {
  const { method } = request;

  // POST /api/datasets/:id/chat - Chat with dataset
  if (pathname.match(/^\/api\/datasets\/[^/]+\/chat$/) && method === 'POST') {
    try {
      const datasetId = pathname.split('/')[3];
      const body = await getRequestBody(request);
      const query = body.query || 'Analyze this data';
      
      console.log('[CHAT] Query for dataset:', datasetId, query);
      
      const state = getState();
      const dataset = state.dataset;
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      // Create user message
      const userMessage = {
        id: randomUUID(),
        role: 'user',
        content: query,
        timestamp: new Date().toISOString()
      };
      
      // Generate response
      const assistantContent = generateFallbackResponse(query, dataset);
      
      // Create assistant message
      const assistantMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString()
      };
      
      // Update chat history
      addChatMessage(userMessage);
      addChatMessage(assistantMessage);
      
      console.log('[CHAT] ✅ Response generated');
      
      // Return in expected format
      sendSuccess(response, {
        userMessage,
        assistantMessage
      }, 'Chat response generated');
      return true;
    } catch (error) {
      console.error('[CHAT] ❌ Error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to process chat', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // GET /api/datasets/:id/chat/history - Get chat history
  if (pathname.match(/^\/api\/datasets\/[^/]+\/chat\/history$/) && method === 'GET') {
    try {
      const state = getState();
      sendSuccess(response, {
        messages: state.chatMessages || [],
        count: state.chatMessages?.length || 0
      }, 'Chat history retrieved');
      return true;
    } catch (error) {
      console.error('Chat history error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to get chat history', ERROR_CODES.DATABASE_ERROR);
      return true;
    }
  }

  // DELETE /api/datasets/:id/chat/history - Clear chat history
  if (pathname.match(/^\/api\/datasets\/[^/]+\/chat\/history$/) && method === 'DELETE') {
    try {
      clearChat();
      sendSuccess(response, { cleared: true, count: 0 }, 'Chat history cleared');
      return true;
    } catch (error) {
      console.error('Chat history clear error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to clear chat history', ERROR_CODES.DATABASE_ERROR);
      return true;
    }
  }

  return false;
}

function generateFallbackResponse(query, dataset) {
  const { rows, columns } = dataset;
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('summary') || lowerQuery.includes('overview')) {
    return `## Dataset Summary\n\n**${dataset.name}** contains ${rows.length} rows and ${columns.length} columns.\n\n### Columns:\n${columns.map(c => `- **${c.name}**: ${c.type || 'unknown'}`).join('\n')}\n\nWould you like me to analyze specific aspects?`;
  }
  
  if (lowerQuery.includes('chart') || lowerQuery.includes('visuali')) {
    return `## Suggested Visualizations\n\nBased on your dataset:\n\n- **Bar Chart**: Compare categorical data\n- **Line Chart**: Show trends over time\n- **Pie Chart**: Display proportions\n\nWould you like me to generate specific charts?`;
  }
  
  return `## Analysis Results\n\nI've received your query: "${query}"\n\n### Dataset Overview:\n- **Name**: ${dataset.name}\n- **Size**: ${rows.length} rows × ${columns.length} columns\n\nWhat would you like to explore?`;
}

export default { handleChatRoutes };
