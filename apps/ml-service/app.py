"""
AutoGluon ML Service for InsightFlow
Completely FREE, no external APIs
Cost: $0/month
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
try:
    from autogluon.tabular import TabularPredictor
    AUTOGLUON_AVAILABLE = True
except Exception:
    AUTOGLUON_AVAILABLE = False
    TabularPredictor = None

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


class LocalBaselinePredictor:
    """Fallback predictor when AutoGluon is unavailable in this Python runtime."""
    def __init__(self, label, problem_type='regression'):
        self.label = label
        self.problem_type = problem_type
        self._baseline = 0.0
        self._feature_importance = {}

    def fit(self, df):
        features = [col for col in df.columns if col != self.label]
        target = df[self.label]
        if self.problem_type == 'regression':
            self._baseline = float(pd.to_numeric(target, errors='coerce').mean())
            self._feature_importance = {feature: 1.0 / max(len(features), 1) for feature in features}
        else:
            mode_series = target.mode(dropna=True)
            self._baseline = mode_series.iloc[0] if not mode_series.empty else None
            self._feature_importance = {feature: 1.0 / max(len(features), 1) for feature in features}
        return self

    def predict(self, df_input):
        return pd.Series([self._baseline] * len(df_input))

    def feature_importance(self, _df):
        return pd.Series(self._feature_importance)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Store models in memory (for MVP)
# Production: Use persistent storage
predictors = {}
model_metadata = {}
MODEL_BASE_PATH = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_BASE_PATH, exist_ok=True)

logger.info("🚀 AutoGluon ML Service starting...")
if not AUTOGLUON_AVAILABLE:
    logger.warning("AutoGluon is not available in this Python version. Using local baseline predictor.")

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
        
        # Convert to DataFrame
        df = pd.DataFrame(rows)
        
        # Validate target column exists
        if target_column not in df.columns:
            return jsonify({
                'success': False,
                'error': f'Target column "{target_column}" not found in dataset'
            }), 400
        
        logger.info(f"[TRAIN] Columns: {list(df.columns)}")
        logger.info(f"[TRAIN] Shape: {df.shape}")

        if AUTOGLUON_AVAILABLE:
            predictor = TabularPredictor(
                label=target_column,
                problem_type=problem_type,
                path=os.path.join(MODEL_BASE_PATH, dataset_id),
            ).fit(
                df,
                time_limit=60,
                presets='medium_quality',
                verbosity=0,
            )
        else:
            predictor = LocalBaselinePredictor(
                label=target_column,
                problem_type=problem_type,
            ).fit(df)

        logger.info("[TRAIN] ✅ Model trained successfully")

        feature_importance = predictor.feature_importance(df)
        predictions = predictor.predict(df)
        if problem_type == 'regression':
            target_series = pd.to_numeric(df[target_column], errors='coerce')
            pred_series = pd.to_numeric(predictions, errors='coerce')
            valid_mask = target_series.notna() & pred_series.notna()
            if valid_mask.any():
                y_true = target_series[valid_mask]
                y_pred = pred_series[valid_mask]
                ss_res = ((y_true - y_pred) ** 2).sum()
                ss_tot = ((y_true - y_true.mean()) ** 2).sum()
                performance = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
            else:
                performance = 0.0
        else:
            performance = float((predictions == df[target_column]).mean())
        
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
            'accuracy': float(performance) if performance is not None else 0.0,
            'feature_importance': feature_importance.to_dict(),
            'training_completed_at': datetime.now().isoformat(),
            'message': '✅ Model trained successfully',
        })
        
    except Exception as e:
        logger.error(f"[TRAIN] ❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
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
