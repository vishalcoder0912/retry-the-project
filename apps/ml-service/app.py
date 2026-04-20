"""
AutoGluon ML Service for InsightFlow
Completely FREE, no external APIs
Cost: $0/month
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from autogluon.tabular import TabularPredictor
import json
import os
import logging
import pandas as pd
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Store models in memory (for MVP)
# Production: Use persistent storage
predictors = {}
model_metadata = {}

logger.info("🚀 AutoGluon ML Service starting...")

@app.route('/api/ml/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'models_loaded': len(predictors),
    })

@app.route('/api/ml/train', methods=['POST'])
def train_model():
    """
    Train AutoGluon model on dataset
    
    Expected JSON:
    {
        "dataset_id": "uuid",
        "rows": [{...}, {...}],
        "target_column": "column_name",
        "problem_type": "regression" or "classification"
    }
    """
    try:
        data = request.json
        
        # Validate input
        dataset_id = data.get('dataset_id')
        rows = data.get('rows')
        target_column = data.get('target_column')
        problem_type = data.get('problem_type', 'regression')
        
        if not all([dataset_id, rows, target_column]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: dataset_id, rows, target_column'
            }), 400
        
        logger.info(f"[TRAIN] Starting training for dataset {dataset_id}")
        logger.info(f"[TRAIN] Dataset size: {len(rows)} rows")
        logger.info(f"[TRAIN] Problem type: {problem_type}")
        logger.info(f"[TRAIN] Target column: {target_column}")
        
        # Convert to DataFrame
        df = pd.DataFrame(rows)
        
        # Validate target column exists
        if target_column not in df.columns:
            return jsonify({
                'success': False,
                'error': f'Target column "{target_column}" not found in dataset'
            }), 400
        
        logger.info(f"[TRAIN] Columns in dataset: {list(df.columns)}")
        logger.info(f"[TRAIN] Dataset shape: {df.shape}")
        
        # Train model (with timeout to prevent hanging)
        predictor = TabularPredictor(
            label=target_column,
            problem_type=problem_type,
            path=f'/tmp/ag_models/{dataset_id}',  # Store locally
        ).fit(
            df,
            time_limit=60,  # 1 minute max training
            presets='best_quality',  # Balanced accuracy vs speed
            verbosity=0,  # Quiet mode
        )
        
        logger.info(f"[TRAIN] ✅ Model trained successfully")
        
        # Get model info
        summary = predictor.fit_summary()
        feature_importance = predictor.feature_importance(df)
        
        # Evaluate on same data (for MVP; use validation set in production)
        performance = predictor.evaluate(df)
        
        # Store predictor
        predictors[dataset_id] = predictor
        model_metadata[dataset_id] = {
            'trained_at': datetime.now().isoformat(),
            'rows': len(rows),
            'columns': len(df.columns),
            'target_column': target_column,
            'problem_type': problem_type,
        }
        
        logger.info(f"[TRAIN] Performance: {performance}")
        
        return jsonify({
            'success': True,
            'model_id': dataset_id,
            'accuracy': float(performance) if isinstance(performance, (int, float)) else 0.0,
            'feature_importance': feature_importance.to_dict(),
            'training_completed_at': datetime.now().isoformat(),
            'message': '✅ Model trained successfully',
        })
        
    except Exception as e:
        logger.error(f"[TRAIN] ❌ Error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
        }), 500

@app.route('/api/ml/predict', methods=['POST'])
def predict():
    """
    Make predictions with trained model
    
    Expected JSON:
    {
        "dataset_id": "uuid",
        "input_data": [{...}] or {...}
    }
    """
    try:
        data = request.json
        dataset_id = data.get('dataset_id')
        input_data = data.get('input_data')
        
        if not dataset_id:
            return jsonify({
                'success': False,
                'error': 'Missing dataset_id'
            }), 400
        
        if not input_data:
            return jsonify({
                'success': False,
                'error': 'Missing input_data'
            }), 400
        
        # Check if model exists
        if dataset_id not in predictors:
            logger.warning(f"[PREDICT] Model not found for dataset {dataset_id}")
            return jsonify({
                'success': False,
                'error': f'Model not found for dataset {dataset_id}. Train model first.'
            }), 404
        
        logger.info(f"[PREDICT] Making predictions for dataset {dataset_id}")
        
        # Convert to DataFrame if needed
        if isinstance(input_data, dict):
            df_input = pd.DataFrame([input_data])
        else:
            df_input = pd.DataFrame(input_data)
        
        logger.info(f"[PREDICT] Input shape: {df_input.shape}")
        
        # Make predictions
        predictor = predictors[dataset_id]
        predictions = predictor.predict(df_input)
        
        logger.info(f"[PREDICT] ✅ Predictions made: {len(predictions)} rows")
        
        return jsonify({
            'success': True,
            'predictions': predictions.tolist(),
            'count': len(predictions),
            'timestamp': datetime.now().isoformat(),
        })
        
    except Exception as e:
        logger.error(f"[PREDICT] ❌ Error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
        }), 500

@app.route('/api/ml/feature-importance', methods=['POST'])
def feature_importance():
    """Get feature importance from trained model"""
    try:
        data = request.json
        dataset_id = data.get('dataset_id')
        
        if not dataset_id or dataset_id not in predictors:
            return jsonify({
                'success': False,
                'error': 'Model not found'
            }), 404
        
        logger.info(f"[FEATURE-IMP] Getting importance for dataset {dataset_id}")
        
        predictor = predictors[dataset_id]
        importance = predictor.feature_importance(None)
        
        logger.info(f"[FEATURE-IMP] ✅ Feature importance retrieved")
        
        return jsonify({
            'success': True,
            'importance': importance.to_dict(),
            'timestamp': datetime.now().isoformat(),
        })
        
    except Exception as e:
        logger.error(f"[FEATURE-IMP] ❌ Error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
        }), 500

@app.route('/api/ml/models', methods=['GET'])
def list_models():
    """List all trained models"""
    logger.info("[MODELS] Fetching model list")
    
    models = [
        {
            'dataset_id': dataset_id,
            'metadata': model_metadata.get(dataset_id, {}),
        }
        for dataset_id in predictors.keys()
    ]
    
    return jsonify({
        'success': True,
        'models': models,
        'count': len(models),
    })

@app.route('/api/ml/models/<dataset_id>', methods=['DELETE'])
def delete_model(dataset_id):
    """Delete a trained model"""
    try:
        if dataset_id in predictors:
            del predictors[dataset_id]
            del model_metadata[dataset_id]
            logger.info(f"[DELETE] ✅ Model deleted for dataset {dataset_id}")
            return jsonify({
                'success': True,
                'message': f'Model for dataset {dataset_id} deleted'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Model not found'
            }), 404
    except Exception as e:
        logger.error(f"[DELETE] ❌ Error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
        }), 500

if __name__ == '__main__':
    port = os.environ.get('PORT', 5000)
    logger.info(f"🚀 Starting ML service on port {port}")
    app.run(host='0.0.0.0', port=int(port), debug=False)
