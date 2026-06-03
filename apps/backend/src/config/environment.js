// Environment configuration with validation
import dotenv from 'dotenv';

dotenv.config();

// Get configured providers dynamically based on API keys
function getConfiguredProviders() {
  const providers = [];
  
  // Check Ollama (always available if enabled)
  if (process.env.OLLAMA_ENABLED !== 'false') {
    providers.push('ollama');
  }
  
  // Check Gemini API key
  if (process.env.GOOGLE_API_KEY) {
    providers.push('gemini');
  }
  
  // Check OpenAI API key
  if (process.env.OPENAI_API_KEY) {
    providers.push('openai');
  }
  
  // Check Anthropic API key
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push('anthropic');
  }
  
  return providers;
}

// Get dynamic provider priority based on configured API keys
function getDynamicProviderPriority() {
  const envPriority = process.env.AI_PROVIDER_PRIORITY || 'ollama,gemini,openai,anthropic';
  const configured = getConfiguredProviders();
  
  // If custom priority is set, respect it but filter out unavailable providers
  if (process.env.AI_PROVIDER_PRIORITY) {
    return envPriority.split(',')
      .map(p => p.trim())
      .filter(p => configured.includes(p));
  }
  
  // Default priority: Ollama first (local), then cloud providers
  return configured.length > 0 ? configured : ['ollama'];
}

export const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // Ollama Configuration (Local LLM)
  ollama: {
    baseUrl: process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    enabled: process.env.OLLAMA_ENABLED !== 'false',
    primaryModel: process.env.OLLAMA_MODEL || 'llama3.2:3b',
    chatModel: process.env.OLLAMA_CHAT_MODEL || 'qwen3:4b',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10),
    maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
    topP: parseFloat(process.env.OLLAMA_TOP_P || '0.9'),
    frequencyPenalty: parseFloat(process.env.OLLAMA_FREQUENCY_PENALTY || '0.0')
  },

  // Google Gemini Configuration
  gemini: {
    apiKey: process.env.GOOGLE_API_KEY || '',
    enabled: !!process.env.GOOGLE_API_KEY,
    model: 'gemini-1.5-pro',
    timeout: 60000,
    maxTokens: 4096
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    enabled: !!process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    timeout: 60000,
    maxTokens: 4096
  },

  // Anthropic Configuration
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    enabled: !!process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-5-sonnet-20241022',
    timeout: 60000,
    maxTokens: 4096
  },

  // AI Global Settings
  ai: {
    providerPriority: getDynamicProviderPriority(),
    fallbackEnabled: process.env.ENABLE_AI_FALLBACK !== 'false',
    localOnlyMode: process.env.LOCAL_AI_ONLY === 'true',
    timeout: parseInt(process.env.AI_TIMEOUT_MS || '120000', 10),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    configuredProviders: getConfiguredProviders()
  },

  // Database Configuration
  database: {
    path: process.env.DATABASE_PATH || './data/insightflow.db',
    dataDir: process.env.DATA_DIR || './data'
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    verbose: process.env.VERBOSE_LOGGING === 'true'
  },

  // Feature Flags
  features: {
    localNlp: process.env.LOCAL_NLP_ENABLED !== 'false',
    autoChartGeneration: process.env.AUTO_CHART_GENERATION !== 'false',
    correlationAnalysis: process.env.CORRELATION_ANALYSIS !== 'false',
    outlierDetection: process.env.OUTLIER_DETECTION !== 'false',
    chatHistory: process.env.CHAT_HISTORY_ENABLED !== 'false',
    smartChart: process.env.SMARTCHART_ENABLED !== 'false'
  }
};

// Validation function
export function validateConfig() {
  const errors = [];

  // Validate server port
  if (isNaN(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
    errors.push('Invalid PORT: must be between 1 and 65535');
  }

  // Validate Ollama URL
  try {
    new URL(config.ollama.baseUrl);
  } catch {
    errors.push('Invalid OLLAMA_HOST/OLLAMA_BASE_URL: must be a valid URL');
  }

  // Validate AI provider priority
  const validProviders = ['ollama', 'gemini', 'openai', 'anthropic'];
  const invalidProviders = config.ai.providerPriority.filter(p => !validProviders.includes(p));
  if (invalidProviders.length > 0) {
    errors.push(`Invalid AI providers: ${invalidProviders.join(', ')}`);
  }

  // Validate database path
  if (!config.database.path) {
    errors.push('DATABASE_PATH is required');
  }

  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:'); // audit-ignore: console-log
    errors.forEach(error => console.error(`   - ${error}`)); // audit-ignore: console-log
    process.exit(1);
  }

  console.log('✅ Configuration validation passed'); // audit-ignore: console-log
  return true;
}

// Print configuration summary
export function printConfigSummary() {
  console.log('\n🤖 ===== AI CONFIGURATION SUMMARY ====='); // audit-ignore: console-log
  console.log('\n📍 OLLAMA (LOCAL LLM)'); // audit-ignore: console-log
  console.log(`   Base URL: ${config.ollama.baseUrl}`); // audit-ignore: console-log
  console.log(`   Primary Model: ${config.ollama.primaryModel}`); // audit-ignore: console-log
  console.log(`   Chat Model: ${config.ollama.chatModel}`); // audit-ignore: console-log
  console.log(`   Status: ${config.ollama.enabled ? '✅ ENABLED' : '❌ DISABLED'}`); // audit-ignore: console-log

  console.log('\n📍 GOOGLE GEMINI'); // audit-ignore: console-log
  console.log(`   Status: ${config.gemini.enabled ? '✅ ENABLED' : '❌ DISABLED (No API key)'}`); // audit-ignore: console-log

  console.log('\n📍 OPENAI'); // audit-ignore: console-log
  console.log(`   Status: ${config.openai.enabled ? '✅ ENABLED' : '❌ DISABLED (No API key)'}`); // audit-ignore: console-log

  console.log('\n📍 ANTHROPIC'); // audit-ignore: console-log
  console.log(`   Status: ${config.anthropic.enabled ? '✅ ENABLED' : '❌ DISABLED (No API key)'}`); // audit-ignore: console-log

  console.log('\n⚙️  GLOBAL SETTINGS'); // audit-ignore: console-log
  console.log(`   Fallback Enabled: ${config.ai.fallbackEnabled}`); // audit-ignore: console-log
  console.log(`   Local Only Mode: ${config.ai.localOnlyMode}`); // audit-ignore: console-log

  const available = getAvailableProviders();
  console.log(`\n✅ Configured Providers: ${available.join(', ') || 'NONE'}`); // audit-ignore: console-log
  console.log(`\n🎯 Dynamic Priority (auto-arranged):`); // audit-ignore: console-log
  config.ai.providerPriority.forEach((p, i) => {
    const status = i === 0 ? '(Primary)' : `(Fallback ${i})`;
    console.log(`   ${i + 1}. ${p.toUpperCase()} ${status}`); // audit-ignore: console-log
  });
  console.log('\n' + '='.repeat(40) + '\n'); // audit-ignore: console-log
}

// Get available providers
export function getAvailableProviders() {
  const available = [];

  if (config.ollama.enabled) available.push('ollama');
  if (config.gemini.enabled) available.push('gemini');
  if (config.openai.enabled) available.push('openai');
  if (config.anthropic.enabled) available.push('anthropic');

  return available;
}

export default config;
