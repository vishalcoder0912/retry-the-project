import { buildSchemaProfile } from "./schema-fingerprint.js";
import { applyTrainedTemplates, mergePlans } from "./dashboard-plan-engine.js";
import { embedText, cosineSimilarity } from "./schema-rag-embeddings.js";
import {
  buildSchemaRagMemoryEntry,
  removeEmbeddingsForPublicResponse,
  schemaProfileToRagText,
} from "./schema-rag-memory-builder.js";
import {
  getSchemaRagStats,
  readSchemaRagMemory,
  upsertSchemaRagMemory,
} from "./schema-rag-store.js";

function tokenize(text = "") {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

function jaccardTextSimilarity(left = "", right = "") {
  const a = tokenize(left);
  const b = tokenize(right);

  if (!a.size || !b.size) return 0;

  let intersection = 0;

  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = new Set([...a, ...b]).size;

  return union ? intersection / union : 0;
}

function normalizeCosine(value) {
  return Math.max(0, Math.min(1, (Number(value || 0) + 1) / 2));
}

function toPublicMatch(match) {
  return {
    ...match,
    entry: removeEmbeddingsForPublicResponse(match.entry),
  };
}

function hasUsableDashboardPlan(entry = {}) {
  const plan = entry.dashboardPlan || {};
  return Array.isArray(plan.kpis) || Array.isArray(plan.charts);
}

function getMeasures(cols) {
  return (cols || []).filter(c => {
    const role = (c.role || "").toLowerCase();
    const type = (c.type || "").toLowerCase();
    return role.includes("metric") || role.includes("measure") || type === "number";
  }).map(c => (c.name || "").toLowerCase()).filter(Boolean);
}

function getDimensions(cols) {
  return (cols || []).filter(c => {
    const role = (c.role || "").toLowerCase();
    const type = (c.type || "").toLowerCase();
    return ["string", "category", "dimension", "location", "target"].includes(type) ||
           ["dimension", "category", "location", "target"].includes(role);
  }).map(c => (c.name || "").toLowerCase()).filter(Boolean);
}

function calculateJaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

export async function retrieveSchemaRagMemories(schemaProfile, options = {}) {
  const limit = Number(options.limit || 5);
  const threshold = Number(options.threshold ?? 0.50);
  const profile = schemaProfile?.columns ? schemaProfile : buildSchemaProfile(schemaProfile || {});
  const queryText = schemaProfileToRagText(profile);

  const embeddingResult = await embedText(queryText, {
    useOllama: options.useOllama,
    allowFallback: true,
  });

  const memory = readSchemaRagMemory();

  const matches = memory
    .filter(hasUsableDashboardPlan)
    .map((entry) => {
      const vectorScore = Array.isArray(entry.embedding) && entry.embedding.length
        ? normalizeCosine(cosineSimilarity(embeddingResult.embedding, entry.embedding))
        : 0;

      const textScore = jaccardTextSimilarity(queryText, entry.schemaText || "");

      // 1. domainMatch
      const domainMatch = (entry.domain && profile.domain && entry.domain.toLowerCase() === profile.domain.toLowerCase()) ? 1.0 : 0.0;

      // 2. columnOverlap
      const profileColNames = new Set((profile.columns || []).map(c => (c.name || "").toLowerCase()).filter(Boolean));
      const entryColNames = new Set((entry.columns || entry.schemaProfile?.columns || []).map(c => (c.name || "").toLowerCase()).filter(Boolean));
      const columnOverlap = calculateJaccard(profileColNames, entryColNames);

      // 3. measureOverlap
      const profileMeasures = new Set(getMeasures(profile.columns));
      const entryMeasures = new Set(getMeasures(entry.columns || entry.schemaProfile?.columns));
      const measureOverlap = calculateJaccard(profileMeasures, entryMeasures);

      // 4. dimensionOverlap
      const profileDimensions = new Set(getDimensions(profile.columns));
      const entryDimensions = new Set(getDimensions(entry.columns || entry.schemaProfile?.columns));
      const dimensionOverlap = calculateJaccard(profileDimensions, entryDimensions);

      // 5. feedbackScore
      const ratingMap = {
        excellent: 1.0,
        good: 0.8,
        average: 0.5,
        poor: 0.1,
      };
      const rating = entry.rating || entry.feedback?.rating || entry.feedback || "good";
      const feedbackScore = ratingMap[rating] || 0.5;

      const finalScore =
        domainMatch * 0.30 +
        columnOverlap * 0.30 +
        measureOverlap * 0.20 +
        dimensionOverlap * 0.15 +
        feedbackScore * 0.05;

      return {
        entry,
        score: finalScore,
        vectorScore,
        textScore,
        domainMatch,
        columnOverlap,
        measureOverlap,
        dimensionOverlap,
        feedbackScore,
      };
    })
    .filter((match) => match.score >= threshold)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return {
    used: matches.length > 0,
    threshold,
    query: {
      domain: profile.domain,
      signature: profile.signature,
      embeddingProvider: embeddingResult.provider,
      embeddingModel: embeddingResult.model,
      embeddingFallback: embeddingResult.fallback,
      embeddingError: embeddingResult.error,
    },
    matches: matches.map(toPublicMatch),
    stats: getSchemaRagStats(),
  };
}

export function buildRagDashboardPlan(profile, matches = []) {
  const plans = (matches || [])
    .map((match) => {
      const entry = match.entry || match;
      return applyTrainedTemplates(profile, {
        entry: {
          ...entry,
          name: entry.name || entry.id,
          domain: entry.domain || profile.domain,
          dashboardPlan: entry.dashboardPlan || {},
        },
        score: match.score || 0,
      });
    })
    .filter(Boolean);

  if (!plans.length) return null;

  return mergePlans(profile, ...plans.map((plan) => ({
    ...plan,
    source: `rag:${plan.source || "memory"}`,
  })));
}

export async function trainSchemaRagMemoryFromDataset({
  dataset,
  schemaProfile,
  acceptedDashboardPlan,
  dashboardPlan,
  rating = "good",
  notes = "",
  source = "user-feedback",
  useOllama,
} = {}) {
  const profile = schemaProfile?.columns ? schemaProfile : buildSchemaProfile(dataset || {});
  const schemaText = schemaProfileToRagText(profile);

  const embeddingResult = await embedText(schemaText, {
    useOllama,
    allowFallback: true,
  });

  const entry = buildSchemaRagMemoryEntry({
    dataset,
    schemaProfile: profile,
    dashboardPlan: acceptedDashboardPlan || dashboardPlan || {},
    embedding: embeddingResult.embedding,
    rating,
    notes,
    source,
  });

  const saved = upsertSchemaRagMemory(entry);

  return {
    entry: removeEmbeddingsForPublicResponse(saved),
    embedding: {
      provider: embeddingResult.provider,
      model: embeddingResult.model,
      fallback: embeddingResult.fallback,
      error: embeddingResult.error,
    },
    stats: getSchemaRagStats(),
  };
}
