/**
 * ML Service Client
 * Communicates with Python AutoGluon service
 * Cost: $0 (runs locally)
 */

import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const ML_TIMEOUT = 120000; // 2 minutes for training

class MLClient {
  /**
   * Check if ML service is healthy
   */
  static async health() {
    try {
      const response = await axios.get(`${ML_SERVICE_URL}/api/ml/health`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      console.error('[ml-client] Health check failed:', error.message);
      return { success: false, status: 'unavailable' };
    }
  }

  /**
   * Train model on dataset
   */
  static async trainModel(datasetId, rows, targetColumn, problemType = 'regression') {
    try {
      console.log(`[ml-client] Training model for dataset ${datasetId}`);
      console.log(`[ml-client] Rows: ${rows.length}, Target: ${targetColumn}, Type: ${problemType}`);

      const response = await axios.post(
        `${ML_SERVICE_URL}/api/ml/train`,
        {
          dataset_id: datasetId,
          rows,
          target_column: targetColumn,
          problem_type: problemType,
        },
        { timeout: ML_TIMEOUT }
      );

      console.log('[ml-client] ✅ Model trained successfully');
      return {
        success: true,
        ...response.data,
      };
    } catch (error) {
      console.error('[ml-client] Training error:', error.message);
      return {
        success: false,
        error: error.message,
        errorType: error.response?.status || 'UNKNOWN',
      };
    }
  }

  /**
   * Make predictions
   */
  static async predict(datasetId, inputData) {
    try {
      console.log(`[ml-client] Making predictions for dataset ${datasetId}`);

      const response = await axios.post(
        `${ML_SERVICE_URL}/api/ml/predict`,
        {
          dataset_id: datasetId,
          input_data: inputData,
        },
        { timeout: 30000 }
      );

      console.log('[ml-client] ✅ Predictions made');
      return {
        success: true,
        ...response.data,
      };
    } catch (error) {
      console.error('[ml-client] Prediction error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get feature importance
   */
  static async getFeatureImportance(datasetId) {
    try {
      console.log(`[ml-client] Getting feature importance for dataset ${datasetId}`);

      const response = await axios.post(
        `${ML_SERVICE_URL}/api/ml/feature-importance`,
        { dataset_id: datasetId },
        { timeout: 10000 }
      );

      console.log('[ml-client] ✅ Feature importance retrieved');
      return {
        success: true,
        ...response.data,
      };
    } catch (error) {
      console.error('[ml-client] Feature importance error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * List all models
   */
  static async listModels() {
    try {
      const response = await axios.get(`${ML_SERVICE_URL}/api/ml/models`, {
        timeout: 5000,
      });

      return {
        success: true,
        ...response.data,
      };
    } catch (error) {
      console.error('[ml-client] List models error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete model
   */
  static async deleteModel(datasetId) {
    try {
      const response = await axios.delete(
        `${ML_SERVICE_URL}/api/ml/models/${datasetId}`,
        { timeout: 5000 }
      );

      return {
        success: true,
        ...response.data,
      };
    } catch (error) {
      console.error('[ml-client] Delete model error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default MLClient;
