<<<<<<< HEAD
import { useMemo, useState } from "react";
import axios from "axios";
import {
  BrainCircuit,
  CheckCircle2,
  Play,
  Sparkles,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "@/features/data/context/useData";
import { buildCommandCenterModel } from "@/features/dashboard/utils/commandCenterAnalytics";
import StatusPanel from "@/shared/layout/StatusPanel";

const CARD = "rounded-2xl border border-[#E2E8F0] bg-white shadow-sm";

type TrainedModel = {
  accuracy: number;
  type: string;
  features: string[];
  featureImportances: Record<string, number>;
};

export default function MLPage() {
  const { dataset, isHydrating, loadDemo } = useData();
  const [targetColumn, setTargetColumn] = useState("");
  const [problemType, setProblemType] = useState("regression");
  const [loading, setLoading] = useState(false);
  const [trainProgress, setTrainProgress] = useState(0);
  const [model, setModel] = useState<TrainedModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<number | number[] | null>(null);
  const [predictionInput, setPredictionInput] = useState<Record<string, number>>({});
  const commandModel = useMemo(() => buildCommandCenterModel(dataset), [dataset]);
  const numericColumns = dataset?.columns?.filter((column) => column.type === "number") || [];

  if (isHydrating) return <StatusPanel title="Loading data science" message="Preparing ML tools." />;
  if (!dataset) return <StatusPanel title="No dataset loaded" message="Upload a dataset before training models." actionLabel="Load Demo Dataset" onAction={() => void loadDemo()} />;

  async function handleTrain() {
    if (!dataset || !targetColumn) {
      setError("Please select a target column.");
      return;
    }
    setError(null);
    setLoading(true);
    setTrainProgress(20);
    const interval = window.setInterval(() => setTrainProgress((current) => Math.min(90, current + 12)), 500);

    try {
      const response = await axios.post("/api/ml/train", {
        dataset_id: dataset.id,
        rows: dataset.rows,
        target_column: targetColumn,
        problem_type: problemType,
      });
      if (response.data.success) {
        setModel(response.data.model);
        setTrainProgress(100);
      } else {
        setError(response.data.error || "Training failed.");
      }
    } catch (err) {
      const nextError = err as { response?: { data?: { error?: string } }; message?: string };
      setError(nextError.response?.data?.error || nextError.message || "Training failed.");
    } finally {
      window.clearInterval(interval);
      setLoading(false);
      window.setTimeout(() => setTrainProgress(0), 1200);
    }
  }

  async function handlePredict() {
    if (!dataset || !model) return;
    try {
      const response = await axios.post("/api/ml/predict", {
        dataset_id: dataset.id,
        input_data: predictionInput,
      });
      if (response.data.success) setPredictions(response.data.prediction);
      else setError(response.data.error || "Prediction failed.");
    } catch (err) {
      const nextError = err as { response?: { data?: { error?: string } } };
      setError(nextError.response?.data?.error || "Prediction failed.");
    }
  }

  const importance = Object.entries(model?.featureImportances || {}).map(([feature, value]) => ({
    feature,
    importance: Number(value) || 0,
  }));

  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto max-w-[1720px] space-y-5">
        <header className="flex items-start gap-4">
          <BrainCircuit className="mt-1 size-8 text-[#7C3AED]" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Data Science</h1>
            <p className="mt-1 text-sm text-[#64748B]">Train analytical models and inspect feature influence using the active dataset.</p>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Rows", commandModel.rows.length.toLocaleString(), "Training records"],
            ["Numeric Features", numericColumns.length.toLocaleString(), "Available inputs"],
            ["Quality", `${Math.round(commandModel.quality.finalScore)}%`, "Data readiness"],
            ["Primary Metric", commandModel.profile.primaryMetric?.name || "-", "Suggested target"],
          ].map(([title, value, subtitle]) => (
            <div key={title} className={`${CARD} p-5`}>
              <p className="text-sm font-semibold text-[#64748B]">{title}</p>
              <p className="mt-2 text-2xl font-bold text-[#0F172A]">{value}</p>
              <p className="mt-2 text-xs text-[#64748B]">{subtitle}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <div className={`${CARD} p-5`}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#0F172A]">
              <Target className="size-5 text-[#7C3AED]" />
              Model Training
            </h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#334155]">Target Column</span>
                <select
                  value={targetColumn}
                  onChange={(event) => setTargetColumn(event.target.value)}
                  disabled={loading}
                  className="mt-2 w-full rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm outline-none focus:border-[#7C3AED]"
                >
                  <option value="">Select a numeric target</option>
                  {numericColumns.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}
                </select>
              </label>

              <div>
                <p className="text-sm font-semibold text-[#334155]">Problem Type</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {["regression", "classification"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setProblemType(type)}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold capitalize ${problemType === type ? "border-violet-200 bg-violet-50 text-[#7C3AED]" : "border-[#E2E8F0] text-[#334155]"}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {trainProgress > 0 && (
                <div>
                  <div className="h-2 rounded-full bg-[#E2E8F0]">
                    <div className="h-2 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#2563EB]" style={{ width: `${trainProgress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-[#64748B]">{Math.round(trainProgress)}% complete</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleTrain()}
                disabled={loading || !targetColumn}
                className="w-full rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 disabled:opacity-50"
              >
                <Play className="mr-2 inline size-4" />
                {loading ? "Training Model..." : "Train Model"}
              </button>
            </div>
          </div>

          <div className={`${CARD} p-5`}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#0F172A]">
              <Sparkles className="size-5 text-[#7C3AED]" />
              Feature Importance
            </h2>
            {model ? (
              <>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#E2E8F0] p-4">
                    <p className="text-sm text-[#64748B]">Model Type</p>
                    <p className="mt-2 font-bold text-[#0F172A]">{model.type || problemType}</p>
                  </div>
                  <div className="rounded-2xl border border-[#E2E8F0] p-4">
                    <p className="text-sm text-[#64748B]">Accuracy</p>
                    <p className="mt-2 font-bold text-[#0F172A]">{(model.accuracy * 100).toFixed(2)}%</p>
                  </div>
                  <div className="rounded-2xl border border-[#E2E8F0] p-4">
                    <p className="text-sm text-[#64748B]">Features</p>
                    <p className="mt-2 font-bold text-[#0F172A]">{model.features?.length || importance.length}</p>
                  </div>
                </div>
                <div className="mt-5 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={importance}>
                      <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                      <XAxis dataKey="feature" stroke="#64748B" fontSize={11} />
                      <YAxis stroke="#64748B" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="importance" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="grid min-h-[340px] place-items-center text-center">
                <div>
                  <Sparkles className="mx-auto size-10 text-[#7C3AED]" />
                  <p className="mt-4 text-sm text-[#64748B]">Train a model to see feature importance.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {model && (
          <section className={`${CARD} p-5`}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#0F172A]">
              <CheckCircle2 className="size-5 text-[#22C55E]" />
              Prediction Console
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {numericColumns.filter((column) => column.name !== targetColumn).slice(0, 8).map((column) => (
                <label key={column.name} className="block">
                  <span className="text-sm font-semibold text-[#334155]">{column.name}</span>
                  <input
                    type="number"
                    value={predictionInput[column.name] || ""}
                    onChange={(event) => setPredictionInput((current) => ({ ...current, [column.name]: Number(event.target.value) || 0 }))}
                    className="mt-2 w-full rounded-2xl border border-[#E2E8F0] px-4 py-3 text-sm outline-none focus:border-[#7C3AED]"
                  />
                </label>
              ))}
            </div>
            <button type="button" onClick={() => void handlePredict()} className="mt-5 rounded-2xl bg-[#22C55E] px-5 py-3 text-sm font-bold text-white">
              Predict
            </button>
            {predictions !== null && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                Prediction for {targetColumn}: {Array.isArray(predictions) ? predictions[0]?.toFixed(2) : predictions.toFixed(2)}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

=======
import { useState } from 'react';
import { useData } from '@/features/data/context/useData';
import axios from 'axios';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const MLPage = () => {
  const { dataset } = useData();
  const [targetColumn, setTargetColumn] = useState('');
  const [problemType, setProblemType] = useState('regression');
  const [loading, setLoading] = useState(false);
  const [trainProgress, setTrainProgress] = useState(0);
  const [model, setModel] = useState<{ 
    accuracy: number; 
    type: string;
    features: string[];
    featureImportances: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<number | number[] | null>(null);
  const [predictionInput, setPredictionInput] = useState<Record<string, number>>({});

  // Get numeric columns for target selection
  const numericColumns = dataset?.columns?.filter((c) => c.type === 'number') || [];

  const handleTrain = async () => {
    if (!dataset || !targetColumn) {
      setError('Please select a dataset and target column');
      return;
    }

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
        '/api/ml/train',
        {
          dataset_id: dataset.id,
          rows: dataset.rows,
          target_column: targetColumn,
          problem_type: problemType,
        }
      );

      clearInterval(progressInterval);
      setTrainProgress(100);

      if (response.data.success) {
        setModel(response.data.model);
        console.log('[ML] ✅ Model trained successfully');
        console.log('[ML] Model details:', response.data.model);
      } else {
        setError(response.data.error || 'Training failed');
      }
    } catch (err) {
      console.error('[ML] Training error:', err);
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || error.message || 'Training failed');
    } finally {
      setLoading(false);
      setTimeout(() => setTrainProgress(0), 1000);
    }
  };

  const handlePredict = async () => {
    if (!dataset || Object.keys(predictionInput).length === 0) {
      setError('Please train a model and fill in at least one field');
      return;
    }

    try {
      const response = await axios.post(
        '/api/ml/predict',
        { 
          dataset_id: dataset.id, 
          input_data: predictionInput 
        }
      );

      if (response.data.success) {
        setPredictions(response.data.prediction);
        console.log('[ML] ✅ Predictions made:', response.data.prediction);
      } else {
        setError(response.data.error || 'Prediction failed');
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Prediction failed');
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
{numericColumns.map((col) => (
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
          <button type="button"
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
            
            {model.featureImportances && Object.keys(model.featureImportances).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={
                  Object.entries(model.featureImportances).map(([name, value]: [string, number]) => ({
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
            {numericColumns.map((col) => (
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

          <button type="button"
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
>>>>>>> origin/main
