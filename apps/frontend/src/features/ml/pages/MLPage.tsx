import { useState, useEffect } from 'react';
import { useData } from '@/features/data/context/useData';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const MLPage = () => {
  const { dataset } = useData();
  const [targetColumn, setTargetColumn] = useState('');
  const [problemType, setProblemType] = useState('regression');
  const [loading, setLoading] = useState(false);
  const [trainProgress, setTrainProgress] = useState(0);
  const [model, setModel] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<any>(null);
  const [predictionInput, setPredictionInput] = useState<any>({});

  // Get numeric columns for target selection
  const numericColumns = dataset?.columns?.filter((c: any) => c.type === 'number') || [];

  const handleTrain = async () => {
    setError(null);
    setLoading(true);
    setTrainProgress(20);

    try {
      console.log('[ML] Starting model training...');
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setTrainProgress(prev => {
          if (prev >= 90) return 90;
          return prev + Math.random() * 20;
        });
      }, 500);

      const response = await axios.post(
        `/api/datasets/${dataset?.id}/ml/train`,
        {
          targetColumn,
          problemType,
        }
      );

      clearInterval(progressInterval);
      setTrainProgress(100);

      if (response.data.success) {
        setModel(response.data.model);
        console.log('[ML] ✅ Model trained successfully');
      } else {
        setError(response.data.error || 'Training failed');
      }
    } catch (err: any) {
      console.error('[ML] Training error:', err);
      setError(err.response?.data?.error || err.message || 'Training failed');
    } finally {
      setLoading(false);
      setTimeout(() => setTrainProgress(0), 1000);
    }
  };

  const handlePredict = async () => {
    if (Object.keys(predictionInput).length === 0) {
      setError('Please fill in at least one field');
      return;
    }

    try {
      const response = await axios.post(
        `/api/datasets/${dataset?.id}/ml/predict`,
        { inputData: predictionInput }
      );

      if (response.data.success) {
        setPredictions(response.data.predictions);
        console.log('[ML] ✅ Predictions made');
      } else {
        setError('Prediction failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Prediction failed');
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">🤖 ML Model Training</h1>
        <p className="text-gray-600">Train AutoML models on your dataset (FREE, no API costs)</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">❌ {error}</p>
        </div>
      )}

      {/* Training Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Model Training Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">Model Training</h2>

          {/* Target Column Selection */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Target Column (What to Predict):
            </label>
            <select
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">-- Select a column --</option>
              {numericColumns.map((col: any) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          {/* Problem Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Problem Type:
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="regression"
                  checked={problemType === 'regression'}
                  onChange={(e) => setProblemType(e.target.value)}
                  disabled={loading}
                  className="mr-2"
                />
                <span>Regression (predict numbers)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="classification"
                  checked={problemType === 'classification'}
                  onChange={(e) => setProblemType(e.target.value)}
                  disabled={loading}
                  className="mr-2"
                />
                <span>Classification (predict categories)</span>
              </label>
            </div>
          </div>

          {/* Progress Bar */}
          {trainProgress > 0 && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${trainProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{Math.round(trainProgress)}% complete</p>
            </div>
          )}

          {/* Train Button */}
          <button
            onClick={handleTrain}
            disabled={loading || !targetColumn}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {loading ? '⏳ Training Model...' : '🚀 Train Model'}
          </button>

          {model && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">✅ Model Trained!</h3>
              <p className="text-sm text-green-700">
                Accuracy: <strong>{(model.accuracy * 100).toFixed(2)}%</strong>
              </p>
            </div>
          )}
        </div>

        {/* Feature Importance Card */}
        {model && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">📊 Feature Importance</h2>
            
            {Object.keys(model.features || {}).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={
                  Object.entries(model.features).map(([name, value]: any) => ({
                    feature: name,
                    importance: typeof value === 'number' ? value : 0,
                  }))
                }>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="feature" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="importance" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500">No feature importance data available</p>
            )}
          </div>
        )}
      </div>

      {/* Prediction Section */}
      {model && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">🔮 Make Predictions</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {numericColumns.map((col: any) => (
              col.name !== targetColumn && (
                <div key={col.name}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {col.name}:
                  </label>
                  <input
                    type="number"
                    value={predictionInput[col.name] || ''}
                    onChange={(e) => setPredictionInput({
                      ...predictionInput,
                      [col.name]: parseFloat(e.target.value) || 0,
                    })}
                    placeholder="Enter value"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )
            ))}
          </div>

          <button
            onClick={handlePredict}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            🎯 Predict
          </button>

          {predictions && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Prediction Result:</h3>
              <p className="text-lg text-green-700">
                <strong>{targetColumn}:</strong> {
                  Array.isArray(predictions) 
                    ? predictions[0]?.toFixed(2) 
                    : predictions.toFixed(2)
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-bold text-blue-800 mb-2">ℹ️ How it works:</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Select a numeric column to predict</li>
          <li>Choose regression (for numbers) or classification (for categories)</li>
          <li>Click "Train Model" - AutoML trains automatically</li>
          <li>View feature importance to understand what matters</li>
          <li>Use predictions to forecast new data</li>
          <li>✅ Completely FREE - no API costs</li>
        </ul>
      </div>
    </div>
  );
};

export default MLPage;
