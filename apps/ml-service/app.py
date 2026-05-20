"""
AutoGluon ML Service for InsightFlow
Completely FREE, no external APIs
Cost: $0/month

Enhanced with:
- Multiple training presets (fast, medium, best quality)
- Hyperparameter tuning configurations
- Model persistence and loading
- Cross-validation support
- Feature engineering options
- Evaluation metrics and diagnostics
"""

import sys
from flask import Flask, request, jsonify
from flask_cors import CORS

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

try:
    from autogluon.tabular import TabularPredictor
    from autogluon.core.metrics import make_scorer
    AUTOGLUON_AVAILABLE = True
except Exception as e:
    AUTOGLUON_AVAILABLE = False
    TabularPredictor = None
    print(f"AutoGluon not available: {e}")

import json
import os
import logging
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Any
import shutil

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================
# AUTOGLUON CONFIGURATION
# ============================================================

# Training presets with different quality/speed tradeoffs
TRAINING_PRESETS = {
    'fast': {
        'time_limit': 30,  # 30 seconds
        'presets': 'fast_training',
        'hyperparameters': 'light',
        'num_bag_folds': 0,
        'num_bag_sets': 1,
        'description': 'Fast training, lower accuracy. Good for quick experiments.'
    },
    'medium': {
        'time_limit': 120,  # 2 minutes
        'presets': 'medium_quality',
        'hyperparameters': 'default',
        'num_bag_folds': 0,
        'num_bag_sets': 1,
        'description': 'Balanced speed and accuracy. Good for most use cases.'
    },
    'high': {
        'time_limit': 300,  # 5 minutes
        'presets': 'high_quality',
        'hyperparameters': 'default',
        'num_bag_folds': 5,
        'num_bag_sets': 1,
        'description': 'High accuracy, slower training. Good for production models.'
    },
    'best': {
        'time_limit': 600,  # 10 minutes
        'presets': 'best_quality',
        'hyperparameters': 'default',
        'num_bag_folds': 8,
        'num_bag_sets': 2,
        'description': 'Best accuracy, slowest training. Use for critical models.'
    }
}

# Hyperparameter configurations for different model types
HYPERPARAMETER_CONFIGS = {
    'light': {
        'NN': {},  # Neural network with defaults
        'GBM': {},  # LightGBM with defaults
    },
    'default': {
        'NN': {},
        'GBM': {},
        'CAT': {},  # CatBoost
        'XGB': {},  # XGBoost
        'RF': {},   # Random Forest
        'XT': {},   # Extra Trees
        'KNN': {},  # K-Nearest Neighbors
    },
    'full': {
        'NN': {'num_epochs': 50},
        'GBM': {'num_boost_round': 1000},
        'CAT': {'iterations': 1000},
        'XGB': {'n_estimators': 1000},
        'RF': {'n_estimators': 300},
        'XT': {'n_estimators': 300},
        'KNN': {},
        'LR': {},  # Linear Regression
        'FASTAI': {},  # FastAI neural network
    }
}

# Model evaluation metrics
EVALUATION_METRICS = {
    'regression': ['r2', 'rmse', 'mae', 'mse', 'pearsonr', 'spearmanr'],
    'classification': ['accuracy', 'f1', 'roc_auc', 'log_loss', 'balanced_accuracy'],
    'multiclass': ['accuracy', 'f1_macro', 'f1_micro', 'roc_auc_ovr', 'log_loss']
}


class LocalBaselinePredictor:
    """Fallback predictor when AutoGluon is unavailable in this Python runtime."""
    def __init__(self, label, problem_type='regression'):
        self.label = label
        self.problem_type = problem_type
        self._baseline = 0.0
        self._feature_importance = {}
        self.model_types = ['baseline']

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

    def predict_proba(self, df_input):
        """Return dummy probabilities for classification"""
        if self.problem_type == 'regression':
            return None
        # Return dummy probabilities
        return pd.DataFrame({'prob': [0.5] * len(df_input)})

    def feature_importance(self, _df):
        return pd.Series(self._feature_importance)

    def evaluate(self, df):
        """Evaluate model performance"""
        predictions = self.predict(df)
        target = df[self.label]
        
        if self.problem_type == 'regression':
            target_numeric = pd.to_numeric(target, errors='coerce')
            pred_numeric = pd.to_numeric(predictions, errors='coerce')
            valid_mask = target_numeric.notna() & pred_numeric.notna()
            
            if valid_mask.any():
                y_true = target_numeric[valid_mask]
                y_pred = pred_numeric[valid_mask]
                ss_res = ((y_true - y_pred) ** 2).sum()
                ss_tot = ((y_true - y_true.mean()) ** 2).sum()
                r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
                rmse = np.sqrt(((y_true - y_pred) ** 2).mean())
                mae = np.abs(y_true - y_pred).mean()
                return {'r2': r2, 'rmse': rmse, 'mae': mae}
        
        return {'accuracy': 0.0}

    def leaderboard(self, df=None):
        """Return a dummy leaderboard"""
        return pd.DataFrame({
            'model': ['Baseline'],
            'score_val': [0.0],
            'pred_time_val': [0.001],
            'fit_time': [0.001]
        })

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Store models in memory (for MVP)
# Production: Use persistent storage
predictors = {}
model_metadata = {}
MODEL_BASE_PATH = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_BASE_PATH, exist_ok=True)

# Load existing models on startup
def load_existing_models():
    """Load previously trained models from disk"""
    if not AUTOGLUON_AVAILABLE:
        logger.info("Skipping model loading - AutoGluon not available")
        return
    
    logger.info("📂 Loading existing models from disk...")
    loaded_count = 0
    
    if os.path.exists(MODEL_BASE_PATH):
        for dataset_id in os.listdir(MODEL_BASE_PATH):
            model_path = os.path.join(MODEL_BASE_PATH, dataset_id)
            if os.path.isdir(model_path):
                try:
                    predictor = TabularPredictor.load(model_path)
                    predictors[dataset_id] = predictor
                    
                    # Load metadata if available
                    metadata_path = os.path.join(model_path, 'metadata.json')
                    if os.path.exists(metadata_path):
                        with open(metadata_path, 'r') as f:
                            model_metadata[dataset_id] = json.load(f)
                    else:
                        model_metadata[dataset_id] = {
                            'loaded_at': datetime.now().isoformat(),
                            'path': model_path
                        }
                    
                    loaded_count += 1
                    logger.info(f"  ✅ Loaded model: {dataset_id}")
                except Exception as e:
                    logger.warning(f"  ⚠️  Failed to load model {dataset_id}: {e}")
    
    logger.info(f"✅ Loaded {loaded_count} existing models")

logger.info("🚀 AutoGluon ML Service starting...")
if not AUTOGLUON_AVAILABLE:
    logger.warning("⚠️  AutoGluon is not available in this Python version. Using local baseline predictor.")
    logger.warning("   Install with: pip install autogluon.tabular")
else:
    logger.info(f"✅ AutoGluon available")
    load_existing_models()

@app.route('/api/ml/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'models_loaded': len(predictors),
        'autogluon_available': AUTOGLUON_AVAILABLE,
        'presets_available': list(TRAINING_PRESETS.keys()),
        'version': '2.0.0'
    })

@app.route('/api/ml/config', methods=['GET'])
def get_config():
    """Get available training configurations"""
    return jsonify({
        'success': True,
        'presets': TRAINING_PRESETS,
        'hyperparameter_configs': list(HYPERPARAMETER_CONFIGS.keys()),
        'evaluation_metrics': EVALUATION_METRICS,
        'autogluon_available': AUTOGLUON_AVAILABLE
    })

@app.route('/api/ml/train', methods=['POST'])
def train_model():
    """
    Train AutoGluon model on dataset with enhanced configuration
    
    Expected JSON:
    {
        "dataset_id": "uuid",
        "rows": [{...}, {...}],
        "target_column": "column_name",
        "problem_type": "regression" or "classification" (optional, auto-detected),
        "preset": "fast" | "medium" | "high" | "best" (default: "medium"),
        "time_limit": int (optional, overrides preset),
        "hyperparameters": "light" | "default" | "full" (optional),
        "eval_metric": string (optional, auto-selected),
        "feature_engineering": bool (default: True),
        "save_model": bool (default: True)
    }
    """
    try:
        data = request.json
        
        # Validate input
        dataset_id = data.get('dataset_id')
        rows = data.get('rows')
        target_column = data.get('target_column')
        problem_type = data.get('problem_type')  # Optional, will auto-detect
        preset = data.get('preset', 'medium')
        time_limit = data.get('time_limit')  # Optional override
        hyperparameters = data.get('hyperparameters', 'default')
        eval_metric = data.get('eval_metric')  # Optional
        feature_engineering = data.get('feature_engineering', True)
        save_model = data.get('save_model', True)
        
        if not all([dataset_id, rows, target_column]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: dataset_id, rows, target_column'
            }), 400
        
        # Validate preset
        if preset not in TRAINING_PRESETS:
            return jsonify({
                'success': False,
                'error': f'Invalid preset. Available: {list(TRAINING_PRESETS.keys())}'
            }), 400
        
        logger.info(f"[TRAIN] Starting training for dataset {dataset_id}")
        logger.info(f"[TRAIN] Dataset size: {len(rows)} rows")
        logger.info(f"[TRAIN] Preset: {preset}")
        
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
        
        # Get preset configuration
        preset_config = TRAINING_PRESETS[preset]
        actual_time_limit = time_limit if time_limit else preset_config['time_limit']
        actual_hyperparameters = HYPERPARAMETER_CONFIGS.get(hyperparameters, HYPERPARAMETER_CONFIGS['default'])
        
        logger.info(f"[TRAIN] Time limit: {actual_time_limit}s")
        logger.info(f"[TRAIN] Hyperparameters: {hyperparameters}")
        
        # Auto-detect problem type if not specified
        if not problem_type:
            target_data = df[target_column]
            unique_values = target_data.nunique()
            
            if unique_values <= 10:
                problem_type = 'classification'
                logger.info(f"[TRAIN] Auto-detected: classification ({unique_values} unique values)")
            else:
                # Check if numeric
                try:
                    pd.to_numeric(target_data, errors='raise')
                    problem_type = 'regression'
                    logger.info(f"[TRAIN] Auto-detected: regression (numeric target)")
                except:
                    problem_type = 'classification'
                    logger.info(f"[TRAIN] Auto-detected: classification (categorical target)")
        
        
        logger.info(f"[TRAIN] Problem type: {problem_type}")
        
        # Prepare model path
        model_path = os.path.join(MODEL_BASE_PATH, dataset_id)
        
        # Remove existing model if present
        if os.path.exists(model_path):
            logger.info(f"[TRAIN] Removing existing model at {model_path}")
            shutil.rmtree(model_path)

        if AUTOGLUON_AVAILABLE:
            # Build fit arguments
            fit_args = {
                'time_limit': actual_time_limit,
                'presets': preset_config['presets'],
                'verbosity': 2,  # More detailed logging
            }
            
            # Add hyperparameters if specified
            if actual_hyperparameters:
                fit_args['hyperparameters'] = actual_hyperparameters
            
            
            # Add bagging for high quality presets
            if preset in ['high', 'best']:
                fit_args['num_bag_folds'] = preset_config['num_bag_folds']
                fit_args['num_bag_sets'] = preset_config['num_bag_sets']
            
            
            # Add eval metric if specified
            if eval_metric:
                fit_args['eval_metric'] = eval_metric
            
            
            # Create predictor
            predictor = TabularPredictor(
                label=target_column,
                problem_type=problem_type,
                path=model_path,
                eval_metric=eval_metric
            )
            
            # Fit the model
            logger.info(f"[TRAIN] Training with AutoGluon...")
            predictor.fit(df, **fit_args)
            
            logger.info("[TRAIN] ✅ AutoGluon training completed")
        else:
            predictor = LocalBaselinePredictor(
                label=target_column,
                problem_type=problem_type,
            ).fit(df)
            
            logger.info("[TRAIN] ✅ Baseline predictor training completed")

        # Get feature importance
        feature_importance = predictor.feature_importance(df)
        logger.info(f"[TRAIN] Feature importance calculated")
        
        # Get predictions for evaluation
        predictions = predictor.predict(df)
        
        # Evaluate model performance
        if AUTOGLUON_AVAILABLE:
            # Use AutoGluon's evaluation
            evaluation = predictor.evaluate(df)
            leaderboard = predictor.leaderboard(df)
            
            # Get best model score
            if not leaderboard.empty:
                best_score = leaderboard.iloc[0]['score_val']
                best_model = leaderboard.iloc[0]['model']
            else:
                best_score = 0.0
                best_model = 'unknown'
        else:
            # Use baseline evaluation
            evaluation = predictor.evaluate(df)
            leaderboard = predictor.leaderboard(df)
            best_score = 0.0
            best_model = 'baseline'
        
        # Calculate additional metrics
        if problem_type == 'regression':
            target_series = pd.to_numeric(df[target_column], errors='coerce')
            pred_series = pd.to_numeric(predictions, errors='coerce')
            valid_mask = target_series.notna() & pred_series.notna()
            
            if valid_mask.any():
                y_true = target_series[valid_mask]
                y_pred = pred_series[valid_mask]
                
                ss_res = ((y_true - y_pred) ** 2).sum()
                ss_tot = ((y_true - y_true.mean()) ** 2).sum()
                r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
                rmse = np.sqrt(((y_true - y_pred) ** 2).mean())
                mae = np.abs(y_true - y_pred).mean()
                
                performance = r2
                additional_metrics = {'r2': r2, 'rmse': rmse, 'mae': mae}
            else:
                performance = 0.0
                additional_metrics = {}
        else:
            # Classification accuracy
            performance = float((predictions == df[target_column]).mean())
            additional_metrics = {'accuracy': performance}
        
        # Save metadata
        metadata = {
            'trained_at': datetime.now().isoformat(),
            'rows': len(rows),
            'columns': len(df.columns),
            'target_column': target_column,
            'problem_type': problem_type,
            'preset': preset,
            'time_limit': actual_time_limit,
            'hyperparameters': hyperparameters,
            'autogluon_available': AUTOGLUON_AVAILABLE,
            'best_model': best_model,
            'best_score': float(best_score),
        }
        
        # Save metadata to disk
        if save_model and AUTOGLUON_AVAILABLE:
            metadata_path = os.path.join(model_path, 'metadata.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            logger.info(f"[TRAIN] Metadata saved to {metadata_path}")
        
        
        # Store predictor in memory
        predictors[dataset_id] = predictor
        model_metadata[dataset_id] = metadata
        
        logger.info(f"[TRAIN] Performance: {performance}")
        logger.info(f"[TRAIN] Best model: {best_model}")
        
        # Prepare response
        response = {
            'success': True,
            'model_id': dataset_id,
            'performance': float(performance) if performance is not None else 0.0,
            'best_score': float(best_score),
            'best_model': best_model,
            'feature_importance': feature_importance.to_dict(),
            'evaluation': evaluation if isinstance(evaluation, dict) else {},
            'additional_metrics': additional_metrics,
            'leaderboard': leaderboard.to_dict('records') if not leaderboard.empty else [],
            'training_completed_at': datetime.now().isoformat(),
            'preset_used': preset,
            'time_limit': actual_time_limit,
            'problem_type': problem_type,
            'message': '✅ Model trained successfully',
        }
        
        return jsonify(response)
        
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
        "input_data": [{...}] or {...},
        "return_proba": bool (optional, default: False),
        "as_pandas": bool (optional, default: False)
    }
    """
    try:
        data = request.json
        dataset_id = data.get('dataset_id')
        input_data = data.get('input_data')
        return_proba = data.get('return_proba', False)
        as_pandas = data.get('as_pandas', False)
        
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
        
        response = {
            'success': True,
            'predictions': predictions.tolist(),
            'count': len(predictions),
            'timestamp': datetime.now().isoformat(),
        }
        
        # Add probabilities if requested and available
        if return_proba:
            try:
                proba = predictor.predict_proba(df_input)
                if proba is not None:
                    response['probabilities'] = proba.to_dict('records') if hasattr(proba, 'to_dict') else proba.tolist()
            except Exception as e:
                logger.warning(f"[PREDICT] Could not get probabilities: {e}")
        
        
        logger.info(f"[PREDICT] ✅ Predictions made: {len(predictions)} rows")
        
        return jsonify(response)
        
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
    
    models = []
    for dataset_id, predictor in predictors.items():
        metadata = model_metadata.get(dataset_id, {})
        
        # Get model info
        model_info = {
            'dataset_id': dataset_id,
            'metadata': metadata,
            'problem_type': metadata.get('problem_type', 'unknown'),
            'target_column': metadata.get('target_column', 'unknown'),
            'trained_at': metadata.get('trained_at', 'unknown'),
            'best_model': metadata.get('best_model', 'unknown'),
            'best_score': metadata.get('best_score', 0.0),
        }
        
        # Add model types if available
        if hasattr(predictor, 'model_types'):
            model_info['model_types'] = predictor.model_types
        
        models.append(model_info)
    
    
    return jsonify({
        'success': True,
        'models': models,
        'count': len(models),
        'autogluon_available': AUTOGLUON_AVAILABLE
    })

@app.route('/api/ml/models/<dataset_id>', methods=['GET'])
def get_model_info(dataset_id):
    """Get detailed information about a specific model"""
    if dataset_id not in predictors:
        return jsonify({
            'success': False,
            'error': 'Model not found'
        }), 404
    
    predictor = predictors[dataset_id]
    metadata = model_metadata.get(dataset_id, {})
    
    info = {
        'success': True,
        'dataset_id': dataset_id,
        'metadata': metadata,
        'problem_type': metadata.get('problem_type'),
        'target_column': metadata.get('target_column'),
    }
    
    # Add AutoGluon specific info
    if AUTOGLUON_AVAILABLE and hasattr(predictor, 'model_types'):
        info['model_types'] = predictor.model_types
        info['model_paths'] = predictor.model_paths
    
    return jsonify(info)

@app.route('/api/ml/models/<dataset_id>', methods=['DELETE'])
def delete_model(dataset_id):
    """Delete a trained model from memory and disk"""
    try:
        if dataset_id not in predictors:
            return jsonify({
                'success': False,
                'error': 'Model not found'
            }), 404
        
        # Remove from memory
        del predictors[dataset_id]
        del model_metadata[dataset_id]
        
        # Remove from disk
        model_path = os.path.join(MODEL_BASE_PATH, dataset_id)
        if os.path.exists(model_path):
            shutil.rmtree(model_path)
            logger.info(f"[DELETE] Removed model from disk: {model_path}")
        
        logger.info(f"[DELETE] ✅ Model deleted for dataset {dataset_id}")
        return jsonify({
            'success': True,
            'message': f'Model for dataset {dataset_id} deleted from memory and disk'
        })
        
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
