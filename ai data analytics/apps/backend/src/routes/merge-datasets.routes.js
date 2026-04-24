/**
 * Multi-Dataset Merge Routes
 * REST API endpoints for merging datasets and auto-detecting KPIs
 * Handles: merging, schema detection, KPI auto-configuration
 */

import {
  mergeDatasets,
  detectDatasetType,
  getKPIRulesForType,
  validateMergeCompatibility,
  generateKPIRecommendations,
  findJoinKeys
} from '../services/multi-dataset-merge.js';

import {
  matchKPISchema,
  generateKPIsFromSchema,
  exportKPIConfiguration,
  getAllKPISchemas
} from '../services/kpi-schema-rules.js';

const mergeOperations = new Map();

/**
 * Register merge dataset routes
 */
export function registerMergeRoutes(server, getDatasetById, createDataset) {
  if (!server) {
    console.warn('[merge-routes] Server not provided');
    return null;
  }

  /**
   * POST /api/merge/datasets
   * Merge multiple datasets with intelligent schema matching
   */
  server.on('request', (request, response) => {
    if (request.url === '/api/merge/datasets' && request.method === 'POST') {
      handleMergeDatasets(request, response);
    }
  });

  /**
   * Handler for merge datasets
   */
  async function handleMergeDatasets(request, response) {
    try {
      const body = await readJsonBody(request);
      const { datasetIds, mergeConfig } = body;

      if (!datasetIds || !Array.isArray(datasetIds) || datasetIds.length < 2) {
        return sendJson(response, 400, {
          error: 'At least 2 datasets required',
          hint: 'Provide datasetIds array with minimum 2 datasets'
        });
      }

      const datasets = datasetIds.map(id => getDatasetById(id)).filter(d => d);

      if (datasets.length < 2) {
        return sendJson(response, 400, {
          error: 'Could not find all datasets'
        });
      }

      const validation = validateMergeCompatibility(datasets);
      if (!validation.valid) {
        return sendJson(response, 400, {
          error: 'Merge validation failed',
          issues: validation.issues
        });
      }

      const mergeResult = mergeDatasets(datasets, mergeConfig || {});
      const kpiRecommendations = generateKPIRecommendations(datasets);

      const mergeId = `merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const operation = {
        mergeId,
        status: 'completed',
        createdAt: new Date().toISOString(),
        mergeResult,
        kpiRecommendations,
        datasetCount: datasets.length,
        totalRows: mergeResult.mergedDataset.rows.length
      };

      mergeOperations.set(mergeId, operation);

      const mergedDataset = createDataset({
        name: mergeResult.mergedDataset.name,
        fileName: `${mergeResult.mergedDataset.name}.csv`,
        columns: mergeResult.mergedDataset.columns,
        rows: mergeResult.mergedDataset.rows,
        sourceType: 'multi-dataset-merge'
      });

      sendJson(response, 201, {
        success: true,
        mergeId,
        mergedDataset,
        metadata: mergeResult.metadata,
        kpiRecommendations,
        message: `Successfully merged ${datasets.length} datasets`
      });
    } catch (error) {
      console.error('[merge-datasets] Error:', error);
      sendJson(response, 500, {
        error: error.message
      });
    }
  }

  /**
   * GET /api/merge/status/:mergeId
   * Get merge operation status
   */
  server.on('request', (request, response) => {
    const match = request.url.match(/^\/api\/merge\/status\/([a-z0-9_]+)$/);
    if (match && request.method === 'GET') {
      const [, mergeId] = match;
      const operation = mergeOperations.get(mergeId);

      if (!operation) {
        return sendJson(response, 404, {
          error: 'Merge operation not found'
        });
      }

      sendJson(response, 200, operation);
    }
  });

  /**
   * POST /api/detect/schema
   * Detect dataset type and KPI schema
   */
  server.on('request', (request, response) => {
    if (request.url === '/api/detect/schema' && request.method === 'POST') {
      handleDetectSchema(request, response);
    }
  });

  async function handleDetectSchema(request, response) {
    try {
      const body = await readJsonBody(request);
      const { datasetId } = body;

      const dataset = getDatasetById(datasetId);
      if (!dataset) {
        return sendJson(response, 404, {
          error: 'Dataset not found'
        });
      }

      const typeDetection = detectDatasetType(dataset.columns);
      const kpiRules = getKPIRulesForType(typeDetection.type);
      const schemaMatch = matchKPISchema(dataset.columns);
      const kpis = generateKPIsFromSchema(schemaMatch.schema, dataset.columns, dataset.rows);

      sendJson(response, 200, {
        success: true,
        datasetId,
        detectedType: typeDetection.type,
        typeConfidence: typeDetection.confidence,
        kpiRules,
        schemaMatch,
        generatedKPIs: kpis,
        config: exportKPIConfiguration(schemaMatch.schema)
      });
    } catch (error) {
      console.error('[detect-schema] Error:', error);
      sendJson(response, 500, {
        error: error.message
      });
    }
  }

  /**
   * GET /api/schemas/available
   * Get all available KPI schemas
   */
  server.on('request', (request, response) => {
    if (request.url === '/api/schemas/available' && request.method === 'GET') {
      const schemas = getAllKPISchemas();
      sendJson(response, 200, {
        success: true,
        schemas
      });
    }
  });

  /**
   * POST /api/join-keys
   * Find potential join keys between datasets
   */
  server.on('request', (request, response) => {
    if (request.url === '/api/join-keys' && request.method === 'POST') {
      handleFindJoinKeys(request, response);
    }
  });

  async function handleFindJoinKeys(request, response) {
    try {
      const body = await readJsonBody(request);
      const { dataset1Id, dataset2Id } = body;

      const dataset1 = getDatasetById(dataset1Id);
      const dataset2 = getDatasetById(dataset2Id);

      if (!dataset1 || !dataset2) {
        return sendJson(response, 404, {
          error: 'One or both datasets not found'
        });
      }

      const joinKeys = findJoinKeys(dataset1.columns, dataset2.columns);

      sendJson(response, 200, {
        success: true,
        dataset1: dataset1.name,
        dataset2: dataset2.name,
        potentialJoinKeys: joinKeys
      });
    } catch (error) {
      console.error('[join-keys] Error:', error);
      sendJson(response, 500, {
        error: error.message
      });
    }
  }

  console.log('[merge-routes] Merge routes registered successfully');
  return { mergeOperations };
}

/**
 * Helper: Read JSON body
 */
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}

/**
 * Helper: Send JSON response
 */
function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  response.end(JSON.stringify(payload));
}