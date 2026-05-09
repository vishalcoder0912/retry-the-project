// Dataset-related routes
import { sendSuccess, sendError } from '../utils/response-utils.js';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import { updateDataset } from './state.js';
import { randomUUID } from 'crypto';

// In-memory dataset storage (would be database in production)
const datasets = new Map();

// Helper to read request body
async function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

export async function handleDatasetRoutes(request, response, pathname) {
  const { method } = request;

  // GET /api/datasets - List all datasets
  if (pathname === '/api/datasets' && method === 'GET') {
    try {
      const datasetList = Array.from(datasets.values()).map(d => ({
        id: d.id,
        name: d.name,
        rowCount: d.rows?.length || 0,
        columnCount: d.columns?.length || 0,
        createdAt: d.createdAt
      }));
      
      sendSuccess(response, {
        datasets: datasetList,
        count: datasetList.length
      }, 'Datasets retrieved');
      return true;
    } catch (error) {
      console.error('Dataset list error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to list datasets', ERROR_CODES.DATABASE_ERROR);
      return true;
    }
  }

  // POST /api/datasets/demo - Load demo dataset
  if (pathname === '/api/datasets/demo' && method === 'POST') {
    try {
      const demoDataset = {
        id: randomUUID(),
        name: 'Demo Sales Data',
        fileName: 'demo-sales.csv',
        columns: [
          { name: 'Date', type: 'date', inferredType: 'date' },
          { name: 'Product', type: 'string', inferredType: 'categorical' },
          { name: 'Region', type: 'string', inferredType: 'categorical' },
          { name: 'Sales', type: 'number', inferredType: 'numeric' },
          { name: 'Quantity', type: 'number', inferredType: 'numeric' }
        ],
        rows: [
          { Date: '2024-01-01', Product: 'Widget A', Region: 'North', Sales: 1500, Quantity: 50 },
          { Date: '2024-01-02', Product: 'Widget B', Region: 'South', Sales: 2300, Quantity: 75 },
          { Date: '2024-01-03', Product: 'Widget A', Region: 'East', Sales: 1800, Quantity: 60 },
          { Date: '2024-01-04', Product: 'Widget C', Region: 'West', Sales: 3200, Quantity: 100 },
          { Date: '2024-01-05', Product: 'Widget B', Region: 'North', Sales: 2100, Quantity: 70 },
          { Date: '2024-01-06', Product: 'Widget A', Region: 'South', Sales: 1650, Quantity: 55 },
          { Date: '2024-01-07', Product: 'Widget C', Region: 'East', Sales: 2800, Quantity: 90 },
          { Date: '2024-01-08', Product: 'Widget B', Region: 'West', Sales: 2450, Quantity: 80 }
        ],
        createdAt: new Date().toISOString()
      };
      
      datasets.set(demoDataset.id, demoDataset);
      updateDataset(demoDataset);
      
      sendSuccess(response, {
        dataset: demoDataset,
        chatMessages: [],
        analysis: null
      }, 'Demo dataset loaded');
      return true;
    } catch (error) {
      console.error('Demo load error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to load demo', ERROR_CODES.DATABASE_ERROR);
      return true;
    }
  }

  // POST /api/datasets/import - Import new dataset
  if (pathname === '/api/datasets/import' && method === 'POST') {
    try {
      const body = await getRequestBody(request);
      
      console.log('[DATASET] Import request:', {
        name: body.name,
        rowCount: body.rows?.length,
        columnCount: body.columns?.length
      });
      
      // Validate required fields
      if (!body.name || !body.rows || !body.columns) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, 
          'Missing required fields: name, rows, columns', ERROR_CODES.VALIDATION_ERROR);
        return true;
      }
      
      // Create dataset
      const datasetId = randomUUID();
      const dataset = {
        id: datasetId,
        name: body.name,
        fileName: body.fileName || null,
        sourceType: body.sourceType || 'upload',
        columns: body.columns,
        rows: body.rows,
        createdAt: new Date().toISOString(),
        metadata: {
          rowCount: body.rows.length,
          columnCount: body.columns.length
        }
      };
      
      // Store dataset
      datasets.set(datasetId, dataset);
      updateDataset(dataset);
      
      console.log('[DATASET] ✅ Dataset imported:', datasetId);
      
      sendSuccess(response, {
        dataset: dataset,
        chatMessages: [],
        analysis: null
      }, 'Dataset imported successfully');
      return true;
    } catch (error) {
      console.error('[DATASET] ❌ Import error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 
        error.message || 'Failed to import dataset', ERROR_CODES.DATABASE_ERROR);
      return true;
    }
  }

  // GET /api/datasets/:id - Get specific dataset
  if (pathname.match(/^\/api\/datasets\/[^/]+$/) && method === 'GET') {
    try {
      const datasetId = pathname.split('/').pop();
      const dataset = datasets.get(datasetId);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      sendSuccess(response, { dataset }, 'Dataset retrieved');
      return true;
    } catch (error) {
      console.error('Dataset get error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to get dataset', ERROR_CODES.DATABASE_ERROR);
      return true;
    }
  }

  // PATCH /api/datasets/:id/rows/:rowId - Update row
  if (pathname.match(/^\/api\/datasets\/[^/]+\/rows\/\d+$/) && method === 'PATCH') {
    try {
      const parts = pathname.split('/');
      const datasetId = parts[3];
      const rowId = parseInt(parts[5]);
      
      const dataset = datasets.get(datasetId);
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      const body = await getRequestBody(request);
      
      if (body.column && body.value !== undefined) {
        if (dataset.rows[rowId]) {
          dataset.rows[rowId][body.column] = body.value;
          datasets.set(datasetId, dataset);
          updateDataset(dataset);
        }
      }
      
      sendSuccess(response, { dataset }, 'Row updated');
      return true;
    } catch (error) {
      console.error('Row update error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to update row', ERROR_CODES.DATABASE_ERROR);
      return true;
    }
  }

  // DELETE /api/datasets/:id - Delete dataset
  if (pathname.match(/^\/api\/datasets\/[^/]+$/) && method === 'DELETE') {
    try {
      const datasetId = pathname.split('/').pop();
      
      if (!datasets.has(datasetId)) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      datasets.delete(datasetId);
      updateDataset(null);
      
      sendSuccess(response, { datasetId }, 'Dataset deleted');
      return true;
    } catch (error) {
      console.error('Dataset delete error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to delete dataset', ERROR_CODES.DATABASE_ERROR);
      return true;
    }
  }

  return false;
}

export default {
  handleDatasetRoutes
};
