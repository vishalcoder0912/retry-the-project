import {
  OLLAMA_AGENT_MODELS,
  OLLAMA_HOST,
  OLLAMA_OPTIONS,
} from './ollama-agent-models.js';

// Backward-compatible role map for older routes/services.
// New code should prefer OLLAMA_AGENT_MODELS and the explicit agent role names.
export { OLLAMA_HOST };

export const AGENTIC_MODELS = Object.freeze({
  manager: OLLAMA_AGENT_MODELS.manager,
  schema: OLLAMA_AGENT_MODELS.schema,
  dashboardPlanner: OLLAMA_AGENT_MODELS.dashboardPlanner,
  dashboardChat: OLLAMA_AGENT_MODELS.dashboardChat,
  generalChat: OLLAMA_AGENT_MODELS.generalChat,
  embedding: OLLAMA_AGENT_MODELS.embedding,
  fallback: OLLAMA_AGENT_MODELS.fallback,

  masterPlanner: OLLAMA_AGENT_MODELS.manager,
  schemaAnalyst: OLLAMA_AGENT_MODELS.schema,
  schemaAnalystFallback: OLLAMA_AGENT_MODELS.fallback,
  dashboardGuardian: OLLAMA_AGENT_MODELS.dashboardPlanner,

  deepReasoner: process.env.AGENTIC_DEEP_MODEL || 'minimax-m2.7:cloud',
  codeAnalyst: process.env.AGENTIC_CODE_MODEL || 'qwen2.5-coder:7b',
  generalReasoner: OLLAMA_AGENT_MODELS.generalChat,
  fallbackChat: OLLAMA_AGENT_MODELS.fallback,
  friendlyChat: OLLAMA_AGENT_MODELS.generalChat,
});

export const AGENTIC_RUNTIME = Object.freeze({
  provider: process.env.AGENTIC_LLM_PROVIDER || 'ollama',
  useCloudDeepReasoner: process.env.AGENTIC_USE_CLOUD_DEEP_REASONER === 'true',
  timeoutMs: Number(process.env.AGENTIC_OLLAMA_TIMEOUT_MS || OLLAMA_OPTIONS.timeoutMs),
  temperature: Number(process.env.AGENTIC_TEMPERATURE ?? OLLAMA_OPTIONS.temperature),
  numCtx: Number(process.env.AGENTIC_NUM_CTX || OLLAMA_OPTIONS.num_ctx),
  numPredict: OLLAMA_OPTIONS.num_predict,
  keepAlive: OLLAMA_OPTIONS.keep_alive,
});

export function getModelForTask(task) {
  switch (task) {
    case 'manager':
    case 'plan':
      return AGENTIC_MODELS.masterPlanner;
    case 'dashboardPlanner':
      return AGENTIC_MODELS.dashboardPlanner;
    case 'dashboardChat':
      return AGENTIC_MODELS.dashboardChat;
    case 'generalChat':
      return AGENTIC_MODELS.generalChat;
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
    agentRoles: { ...OLLAMA_AGENT_MODELS },
    roles: { ...AGENTIC_MODELS },
    options: {
      temperature: AGENTIC_RUNTIME.temperature,
      num_ctx: AGENTIC_RUNTIME.numCtx,
      num_predict: AGENTIC_RUNTIME.numPredict,
      keep_alive: AGENTIC_RUNTIME.keepAlive,
      timeoutMs: AGENTIC_RUNTIME.timeoutMs,
    },
  };
}
