import { generateWithAgent, chatWithAgent } from './ollama-agent-router.js';
import { AGENTIC_MODELS } from '../../config/agentic-models.js';

function inferColumnType(values) {
  const sample = values.filter((v) => v !== null && v !== undefined && v !== '').slice(0, 100);
  if (!sample.length) return 'empty';
  const numeric = sample.filter((v) => !Number.isNaN(Number(v))).length / sample.length;
  if (numeric >= 0.8) return 'number';
  const dateish = sample.filter((v) => !Number.isNaN(Date.parse(String(v)))).length / sample.length;
  if (dateish >= 0.7) return 'date';
  const unique = new Set(sample.map(String)).size;
  if (unique <= Math.max(20, sample.length * 0.3)) return 'category';
  return 'text';
}

function profileRows(rows = [], columns = []) {
  const names = columns.length
    ? columns.map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean)
    : Object.keys(rows[0] || {});

  const columnProfiles = names.map((name) => {
    const values = rows.map((row) => row?.[name]);
    const missing = values.filter((v) => v === null || v === undefined || v === '').length;
    const type = inferColumnType(values);
    const nums = values.map(Number).filter((v) => Number.isFinite(v));
    return {
      name,
      type,
      missing,
      missingRate: rows.length ? Number((missing / rows.length).toFixed(4)) : 0,
      unique: new Set(values.filter((v) => v !== null && v !== undefined).map(String)).size,
      sample: values.filter((v) => v !== null && v !== undefined && v !== '').slice(0, 5),
      stats: nums.length
        ? {
            min: Math.min(...nums),
            max: Math.max(...nums),
            avg: nums.reduce((a, b) => a + b, 0) / nums.length,
          }
        : undefined,
    };
  });

  return {
    rowCount: rows.length,
    columnCount: names.length,
    columns: columnProfiles,
    numericColumns: columnProfiles.filter((c) => c.type === 'number').map((c) => c.name),
    dateColumns: columnProfiles.filter((c) => c.type === 'date').map((c) => c.name),
    categoricalColumns: columnProfiles.filter((c) => c.type === 'category').map((c) => c.name),
    textColumns: columnProfiles.filter((c) => c.type === 'text').map((c) => c.name),
  };
}

function deterministicDashboard(profile) {
  const firstNumber = profile.numericColumns[0];
  const secondNumber = profile.numericColumns[1];
  const firstCategory = profile.categoricalColumns[0];
  const firstDate = profile.dateColumns[0];

  const kpis = [
    { id: 'rows', label: 'Total Rows', type: 'count', field: null },
    { id: 'columns', label: 'Total Columns', type: 'count_columns', field: null },
  ];

  if (firstNumber) {
    kpis.push({ id: `avg_${firstNumber}`, label: `Average ${firstNumber}`, type: 'avg', field: firstNumber });
    kpis.push({ id: `sum_${firstNumber}`, label: `Total ${firstNumber}`, type: 'sum', field: firstNumber });
  }

  const charts = [];
  if (firstCategory && firstNumber) {
    charts.push({
      id: 'category_bar',
      title: `${firstNumber} by ${firstCategory}`,
      type: 'bar',
      x: firstCategory,
      y: firstNumber,
      aggregation: 'sum',
      reason: 'Compares numeric performance across categories.',
    });
  }
  if (firstDate && firstNumber) {
    charts.push({
      id: 'trend_line',
      title: `${firstNumber} trend over ${firstDate}`,
      type: 'line',
      x: firstDate,
      y: firstNumber,
      aggregation: 'sum',
      reason: 'Shows movement over time.',
    });
  }
  if (firstNumber && secondNumber) {
    charts.push({
      id: 'numeric_scatter',
      title: `${firstNumber} vs ${secondNumber}`,
      type: 'scatter',
      x: firstNumber,
      y: secondNumber,
      aggregation: 'none',
      reason: 'Helps inspect relationship between two numeric fields.',
    });
  }

  return {
    kpis,
    charts,
    filters: [firstCategory, firstDate].filter(Boolean),
    warnings: profile.columns
      .filter((c) => c.missingRate > 0.2)
      .map((c) => `${c.name} has ${Math.round(c.missingRate * 100)}% missing values.`),
  };
}

function schemaPrompt(profile, goal) {
  return `You are InsightFlow strict schema analyst.\n\nRules:\n- Use schema/profile only.\n- Do not invent raw values.\n- Return JSON only.\n- Recommend metrics, dimensions, risks, and dashboard intent.\n\nUser goal: ${goal || 'Create the best analytics dashboard.'}\n\nSchema profile:\n${JSON.stringify(profile, null, 2)}\n\nReturn JSON with keys: domain, metricColumns, dimensionColumns, dateColumns, risks, dashboardGoal, confidence.`;
}

function plannerPrompt(profile, schemaAnalysis, goal) {
  return `You are InsightFlow master agent. Plan an analytics workflow.\nReturn JSON only.\n\nAvailable tools:\n- profile_schema\n- generate_kpis\n- recommend_charts\n- detect_anomalies\n- validate_dashboard\n- synthesize_insights\n\nUser goal: ${goal || 'Create a dashboard'}\n\nSchema profile:\n${JSON.stringify(profile, null, 2)}\n\nSchema agent result:\n${JSON.stringify(schemaAnalysis, null, 2)}\n\nReturn JSON with keys: objective, steps, toolCalls, expectedOutput, safetyRules.`;
}

function guardPrompt(profile, dashboardPlan) {
  return `You are InsightFlow dashboard guardian. Validate dashboard specs.\nRules:\n- Return JSON only.\n- Mark invalid charts that reference missing columns.\n- Suggest safer replacements.\n\nSchema columns: ${profile.columns.map((c) => c.name).join(', ')}\n\nDashboard plan:\n${JSON.stringify(dashboardPlan, null, 2)}\n\nReturn JSON with keys: valid, issues, fixedPlan, confidence.`;
}

export async function runModelAwareAgenticAnalysis({ rows = [], columns = [], goal = '' }) {
  const profile = profileRows(rows, columns);
  const audit = [];

  let schemaAnalysis;
  try {
    const schemaRes = await generateWithAgent('schema', schemaPrompt(profile, goal), { json: true });
    schemaAnalysis = schemaRes.json || { fallback: true, message: schemaRes.text };
    audit.push({ step: 'schema_analysis', model: schemaRes.model, status: 'ok' });
  } catch (error) {
    schemaAnalysis = { fallback: true, error: error.message };
    audit.push({ step: 'schema_analysis', model: AGENTIC_MODELS.schemaAnalyst, status: 'fallback', error: error.message });
  }

  let plan;
  try {
    const plannerRes = await generateWithAgent('plan', plannerPrompt(profile, schemaAnalysis, goal), { json: true });
    plan = plannerRes.json || { fallback: true, message: plannerRes.text };
    audit.push({ step: 'master_planning', model: plannerRes.model, status: 'ok' });
  } catch (error) {
    plan = { fallback: true, objective: goal || 'Generate analytics dashboard', steps: [] };
    audit.push({ step: 'master_planning', model: AGENTIC_MODELS.masterPlanner, status: 'fallback', error: error.message });
  }

  const deterministicPlan = deterministicDashboard(profile);

  let guard;
  try {
    const guardRes = await generateWithAgent('guard', guardPrompt(profile, deterministicPlan), { json: true });
    guard = guardRes.json || { valid: true, fixedPlan: deterministicPlan, message: guardRes.text };
    audit.push({ step: 'dashboard_guardian', model: guardRes.model, status: 'ok' });
  } catch (error) {
    guard = { valid: true, fixedPlan: deterministicPlan, fallback: true, error: error.message };
    audit.push({ step: 'dashboard_guardian', model: AGENTIC_MODELS.dashboardGuardian, status: 'fallback', error: error.message });
  }

  const finalDashboard = guard?.fixedPlan?.charts || guard?.fixedPlan?.kpis ? guard.fixedPlan : deterministicPlan;

  return {
    success: true,
    mode: 'model-aware-agentic-analytics',
    models: { ...AGENTIC_MODELS },
    profile,
    schemaAnalysis,
    plan,
    dashboard: finalDashboard,
    audit,
    nextTrainingHooks: {
      ragEmbeddingModel: AGENTIC_MODELS.embedding,
      replaceRetrieverFile: 'apps/backend/src/services/agentic/rag-retriever.js',
      fineTuneTargets: ['schemaAnalyst', 'masterPlanner', 'dashboardGuardian'],
    },
  };
}

export async function runModelAwareAgenticChat({ rows = [], columns = [], message = '', history = [] }) {
  const profile = profileRows(rows, columns);
  const system = {
    role: 'system',
    content: 'You are InsightFlow agentic data analyst. Use schema/profile and computed summaries only. Do not pretend to inspect hidden rows. Give concise dashboard-ready answers.',
  };
  const user = {
    role: 'user',
    content: `Dataset profile:\n${JSON.stringify(profile, null, 2)}\n\nUser question: ${message}`,
  };

  try {
    const res = await chatWithAgent('chat', [system, ...history.slice(-6), user], { json: false });
    return { success: true, model: res.model, answer: res.text, profile };
  } catch (error) {
    return {
      success: true,
      model: 'fallback-local',
      answer: `I analyzed the dataset schema: ${profile.rowCount} rows, ${profile.columnCount} columns. Numeric columns: ${profile.numericColumns.join(', ') || 'none'}. Category columns: ${profile.categoricalColumns.join(', ') || 'none'}.`,
      profile,
      error: error.message,
    };
  }
}
