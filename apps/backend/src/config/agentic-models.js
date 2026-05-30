// Agentic model role map for InsightFlow.
// Keep this file small and explicit so you can swap models later without touching agent logic.

export const OLLAMA_HOST =
  process.env.OLLAMA_HOST ||
  process.env.OLLAMA_BASE_URL ||
  'http://localhost:11434';

export const AGENTIC_MODELS = Object.freeze({
  // Main brain: breaks user goal into steps and chooses tools.
  masterPlanner: process.env.AGENTIC_MASTER_MODEL || 'insightflow-master:latest',

  // Strict schema analyst: receives schema/profile, not full raw rows.
  schemaAnalyst: process.env.AGENTIC_SCHEMA_MODEL || 'insightflow-strict-schema-analyst:latest',
  schemaAnalystFallback: process.env.AGENTIC_SCHEMA_FALLBACK_MODEL || 'strict-schema-analyst:latest',

  // Dashboard validator: checks chart/KPI specs before frontend renders them.
  dashboardGuardian: process.env.AGENTIC_GUARDIAN_MODEL || 'insightflow-dashboard-guardian:latest',

  // Expensive/deeper reasoning. Use only when enabled because it may be cloud-backed.
  deepReasoner: process.env.AGENTIC_DEEP_MODEL || 'minimax-m2.7:cloud',

  // Embeddings for future vector RAG.
  embedding: process.env.AGENTIC_EMBED_MODEL || 'nomic-embed-text:latest',

  // Good for formulas, SQL, code/debug style tasks.
  codeAnalyst: process.env.AGENTIC_CODE_MODEL || 'qwen2.5-coder:7b',

  // General chat/synthesis.
  generalReasoner: process.env.AGENTIC_GENERAL_MODEL || 'qwen3:8b',
  fallbackChat: process.env.AGENTIC_FALLBACK_MODEL || 'llama3.2:latest',
  friendlyChat: process.env.AGENTIC_FRIENDLY_MODEL || 'neural-chat:7b',
});

export const AGENTIC_RUNTIME = Object.freeze({
  provider: process.env.AGENTIC_LLM_PROVIDER || 'ollama',
  useCloudDeepReasoner: process.env.AGENTIC_USE_CLOUD_DEEP_REASONER === 'true',
  timeoutMs: Number(process.env.AGENTIC_OLLAMA_TIMEOUT_MS || 120000),
  temperature: Number(process.env.AGENTIC_TEMPERATURE || 0.1),
  numCtx: Number(process.env.AGENTIC_NUM_CTX || 8192),
});

export function getModelForTask(task) {
  switch (task) {
    case 'plan':
      return AGENTIC_MODELS.masterPlanner;
    case 'schema':
      return AGENTIC_MODELS.schemaAnalyst;
    case 'schemaFallback':
      return AGENTIC_MODELS.schemaAnalystFallback;
    case 'guard':
      return AGENTIC_MODELS.dashboardGuardian;
    case 'embed':
      return AGENTIC_MODELS.embedding;
    case 'code':
    case 'sql':
    case 'formula':
      return AGENTIC_MODELS.codeAnalyst;
    case 'deep':
      return AGENTIC_RUNTIME.useCloudDeepReasoner
        ? AGENTIC_MODELS.deepReasoner
        : AGENTIC_MODELS.generalReasoner;
    case 'friendly':
      return AGENTIC_MODELS.friendlyChat;
    case 'chat':
    case 'synthesis':
    default:
      return AGENTIC_MODELS.generalReasoner || AGENTIC_MODELS.fallbackChat;
  }
}

export function publicModelConfig() {
  return {
    provider: AGENTIC_RUNTIME.provider,
    ollamaHost: OLLAMA_HOST,
    useCloudDeepReasoner: AGENTIC_RUNTIME.useCloudDeepReasoner,
    roles: { ...AGENTIC_MODELS },
  };
}
