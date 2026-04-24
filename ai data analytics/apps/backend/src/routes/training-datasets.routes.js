/**
 * Training Datasets Routes
 * API endpoints for loading and managing training datasets
 */

import {
  generateSalesDataset,
  generateCustomerDataset,
  generateProductDataset,
  generateInventoryDataset,
  generateMarketingDataset,
  generateHRDataset,
  generateFinancialDataset,
  generateWebAnalyticsDataset,
  generateEducationDataset,
  generateHealthcareDataset,
  generateSupplyChainDataset,
  generateRealEstateDataset,
  generateFoodServiceDataset,
  generateTelecomDataset,
  generateAirlineDataset,
  generateRetailDataset,
  getAllTrainingDatasets,
  getTrainingDatasetByType,
} from '../services/training-datasets.js';

/**
 * Register training dataset routes
 */
export function registerTrainingDatasetRoutes(server, createDataset) {
  if (!server) {
    console.warn('[training-routes] Server not provided');
    return null;
  }

  /**
   * GET /api/training/datasets
   * List all available training datasets
   */
  server.on('request', (request, response) => {
    if (request.url === '/api/training/datasets' && request.method === 'GET') {
      const datasets = getAllTrainingDatasets();
      const responseData = {
        success: true,
        total: datasets.length,
        datasets: datasets.map(d => ({
          name: d.name,
          fileName: d.fileName,
          rowCount: d.rows.length,
          columnCount: d.columns.length,
          type: d.name.split('_')[0].toLowerCase(),
          description: `${d.rows.length} rows × ${d.columns.length} columns`,
        })),
        availableTypes: [
          'sales', 'customer', 'product', 'inventory', 'marketing', 'hr',
          'financial', 'web_analytics', 'education', 'healthcare',
          'supply_chain', 'real_estate', 'food_service', 'telecom', 'airline', 'retail'
        ],
      };
      sendJson(response, 200, responseData);
    }
  });

  /**
   * POST /api/training/datasets/:type
   * Load training dataset by type
   */
  server.on('request', (request, response) => {
    if (request.url.startsWith('/api/training/datasets/') && request.method === 'POST') {
      const type = request.url.replace('/api/training/datasets/', '');
      const dataset = getTrainingDatasetByType(type);
      
      if (!dataset) {
        return sendJson(response, 404, {
          error: `Training dataset type '${type}' not found`,
          availableTypes: [
            'sales', 'customer', 'product', 'inventory', 'marketing', 'hr',
            'financial', 'web_analytics', 'education', 'healthcare',
            'supply_chain', 'real_estate', 'food_service', 'telecom', 'airline', 'retail'
          ],
        });
      }

      const createdDataset = createDataset({
        name: dataset.name,
        fileName: dataset.fileName,
        columns: dataset.columns,
        rows: dataset.rows,
        sourceType: 'training',
      });

      sendJson(response, 201, {
        success: true,
        message: `Training dataset '${type}' loaded successfully`,
        dataset: createdDataset,
        rowCount: dataset.rows.length,
        columnCount: dataset.columns.length,
      });
    }
  });

  console.log('[training-routes] Training dataset routes registered successfully');
  return true;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  response.end(JSON.stringify(payload));
}