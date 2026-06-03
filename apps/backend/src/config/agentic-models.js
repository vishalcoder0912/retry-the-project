// Agentic model role map for InsightFlow.
// Optimized for your 5 available Ollama models:
//   nomic-embed-text:latest | llama3.2:3b | qwen3:4b | qwen3:8b | qwen3:latest
//
// Keep this file small and explicit — swap model names in .env without touching agent logic.

export const OLLAMA_HOST =
  process.env.OLLAMA_HOST ||
  process.env.OLLAMA_BASE_URL ||
  'http://localhost:11434';

export const AGENTIC_MODELS = Object.freeze({
  // Main brain: breaks user goal into steps and chooses tools.
  // qwen3:8b has the best instruction-following depth for multi-step planning.
  masterPlanner: process.env.AGENTIC_MASTER_MODEL || 'qwen3:8b',

  // Strict schema analyst: receives schema/profile (not raw rows) → returns structured JSON.
  // qwen3:8b is deterministic enough at temperature=0.1 for reliable JSON output.
  schemaAnalyst:         process.env.AGENTIC_SCHEMA_MODEL          || 'qwen3:8b',
  schemaAnalystFallback: process.env.AGENTIC_SCHEMA_FALLBACK_MODEL || 'qwen3:4b',

  // Dashboard validator: checks chart/KPI specs before the frontend renders them.
  // qwen3:4b is fast enough for validation (shorter prompts, shorter outputs).
  dashboardGuardian: process.env.AGENTIC_GUARDIAN_MODEL || 'qwen3:4b',

  // Deep / complex multi-hop reasoning — stays fully local, no cloud required.
  deepReasoner: process.env.AGENTIC_DEEP_MODEL || 'qwen3:8b',

  // Embeddings for schema similarity & semantic memory.
  // nomic-embed-text is purpose-built — never substitute an LLM here.
  embedding: process.env.AGENTIC_EMBED_MODEL || 'nomic-embed-text:latest',

  // Code, SQL, formula generation.
  // qwen3:8b handles structured output (SQL/JSON) better than 4b.
  codeAnalyst: process.env.AGENTIC_CODE_MODEL || 'qwen3:8b',

  // General chat and narrative synthesis.
  // qwen3:4b is the daily-driver: fast responses for interactive sessions.
  generalReasoner: process.env.AGENTIC_GENERAL_MODEL  || 'qwen3:4b',

  // Lightweight fallback — triggered when a faster response beats accuracy.
  fallbackChat: process.env.AGENTIC_FALLBACK_MODEL || 'llama3.2:3b',

  // Friendly conversational interface (same as fallback on 16 GB RAM setup).
  friendlyChat: process.env.AGENTIC_FRIENDLY_MODEL || 'llama3.2:3b',
});

export const AGENTIC_RUNTIME = Object.freeze({
  provider: process.env.AGENTIC_LLM_PROVIDER || 'ollama',

  // false → deepReasoner stays local (qwen3:8b), no cloud calls.
  useCloudDeepReasoner: process.env.AGENTIC_USE_CLOUD_DEEP_REASONER === 'true',

  timeoutMs:   Number(process.env.AGENTIC_OLLAMA_TIMEOUT_MS || 120_000),
  temperature: Number(process.env.AGENTIC_TEMPERATURE        || 0.1),   // Low = deterministic
  numCtx:      Number(process.env.AGENTIC_NUM_CTX            || 8192),  // Sweet spot for 16 GB
});

/**
 * Return the right model name for a given task key.
 *
 * @param {'plan'|'schema'|'schemaFallback'|'guard'|'validate'|'embed'|'embedding'|
 *          'code'|'sql'|'formula'|'deep'|'reasoning'|'friendly'|'fallback'|
 *          'chat'|'synthesis'} task
 * @returns {string} Ollama model name
 */
export function getModelForTask(task) {
  switch (task) {
    case 'plan':
      return AGENTIC_MODELS.masterPlanner;

    case 'schema':
      return AGENTIC_MODELS.schemaAnalyst;
    case 'schemaFallback':
      return AGENTIC_MODELS.schemaAnalystFallback;

    case 'guard':
    case 'validate':
      return AGENTIC_MODELS.dashboardGuardian;

    case 'embed':
    case 'embedding':
    case 'similarity':
      return AGENTIC_MODELS.embedding;

    case 'code':
    case 'sql':
    case 'formula':
      return AGENTIC_MODELS.codeAnalyst;

    case 'deep':
    case 'reasoning':
      // Stays local unless AGENTIC_USE_CLOUD_DEEP_REASONER=true
      return AGENTIC_RUNTIME.useCloudDeepReasoner
        ? AGENTIC_MODELS.deepReasoner
        : AGENTIC_MODELS.generalReasoner;

    case 'friendly':
      return AGENTIC_MODELS.friendlyChat;

    case 'fallback':
      return AGENTIC_MODELS.fallbackChat;

    case 'chat':
    case 'synthesis':
    default:
      return AGENTIC_MODELS.generalReasoner;
  }
}

export function publicModelConfig() {
  return {
    provider:             AGENTIC_RUNTIME.provider,
    ollamaHost:           OLLAMA_HOST,
    useCloudDeepReasoner: AGENTIC_RUNTIME.useCloudDeepReasoner,
    roles:                { ...AGENTIC_MODELS },
  };
}
