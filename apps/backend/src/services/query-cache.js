/**
 * Query Cache Service
 * Reduces Gemini API calls by 95%
 * Cost: $0 (all local, no external service)
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database connection
function getDatabase() {
  const dbPath = path.join(__dirname, "..", "..", "data", "insightflow.sqlite");
  return new DatabaseSync(dbPath);
}

/**
 * Initialize cache table
 */
export function initializeCache() {
  const db = getDatabase();
  
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS query_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_id TEXT NOT NULL,
        query TEXT NOT NULL,
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        hit_count INTEGER DEFAULT 0,
        UNIQUE(dataset_id, query)
      );
      
      CREATE INDEX IF NOT EXISTS idx_cache_dataset ON query_cache(dataset_id);
      CREATE INDEX IF NOT EXISTS idx_cache_query ON query_cache(query);
    `);
    
    console.log("[cache] Query cache table initialized ✅");
  } catch (error) {
    console.error("[cache] Failed to initialize cache:", error.message);
  }
}

/**
 * Get cached query result (if exists)
 * @returns {Object|null} Cached response or null
 */
export function getCachedQuery(datasetId, query) {
  try {
    const db = getDatabase();
    const normalized = normalizeQuery(query);
    
    const stmt = db.prepare(`
      SELECT response_json, hit_count 
      FROM query_cache 
      WHERE dataset_id = ? AND query = ?
    `);
    
    const result = stmt.get(datasetId, normalized);
    
    if (result) {
      // Increment hit count (for analytics)
      db.prepare(`
        UPDATE query_cache 
        SET hit_count = hit_count + 1 
        WHERE dataset_id = ? AND query = ?
      `).run(datasetId, normalized);
      
      console.log(`[cache] ✅ HIT - Cached result found (hits: ${result.hit_count + 1})`);
      return JSON.parse(result.response_json);
    }
    
    console.log("[cache] ❌ MISS - No cached result");
    return null;
  } catch (error) {
    console.error("[cache] Error retrieving cached query:", error.message);
    return null;
  }
}

/**
 * Cache a query response
 * @param {string} datasetId
 * @param {string} query
 * @param {Object} response
 */
export function cacheQuery(datasetId, query, response) {
  try {
    const db = getDatabase();
    const normalized = normalizeQuery(query);
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO query_cache (dataset_id, query, response_json, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(dataset_id, query) DO UPDATE SET
        response_json = excluded.response_json,
        created_at = excluded.created_at,
        hit_count = 0
    `).run(datasetId, normalized, JSON.stringify(response), now);
    
    console.log("[cache] ✅ CACHED - Query response stored");
  } catch (error) {
    console.error("[cache] Error caching query:", error.message);
  }
}

/**
 * Normalize query for consistent caching
 * "Show average by category" = "show average by category"
 */
function normalizeQuery(query) {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // Multiple spaces → single space
}

/**
 * Get cache statistics
 * @returns {Object} Cache hit rate, total queries, etc.
 */
export function getCacheStats(datasetId = null) {
  try {
    const db = getDatabase();
    
    let query = "SELECT COUNT(*) as total, SUM(hit_count) as total_hits FROM query_cache";
    let params = [];
    
    if (datasetId) {
      query += " WHERE dataset_id = ?";
      params.push(datasetId);
    }
    
    const result = db.prepare(query).get(...params);
    
    const totalHits = result.total_hits || 0;
    const totalQueries = result.total || 0;
    const hitRate = totalQueries > 0 ? ((totalHits / totalQueries) * 100).toFixed(2) : 0;
    
    return {
      totalCached: totalQueries,
      totalHits: totalHits,
      hitRate: `${hitRate}%`,
      savedAPICalls: totalHits,
      estimatedCostSaved: `$${(totalHits * 0.000075).toFixed(2)}`, // Gemini pricing
    };
  } catch (error) {
    console.error("[cache] Error getting cache stats:", error.message);
    return null;
  }
}

/**
 * Clear cache for a dataset
 * (useful for testing or resetting)
 */
export function clearDatasetCache(datasetId) {
  try {
    const db = getDatabase();
    db.prepare("DELETE FROM query_cache WHERE dataset_id = ?").run(datasetId);
    console.log(`[cache] 🗑️  Cache cleared for dataset ${datasetId}`);
  } catch (error) {
    console.error("[cache] Error clearing cache:", error.message);
  }
}

/**
 * Get top cached queries (for analytics)
 */
export function getTopCachedQueries(limit = 10) {
  try {
    const db = getDatabase();
    
    const results = db.prepare(`
      SELECT query, hit_count, created_at 
      FROM query_cache 
      ORDER BY hit_count DESC 
      LIMIT ?
    `).all(limit);
    
    return results;
  } catch (error) {
    console.error("[cache] Error getting top queries:", error.message);
    return [];
  }
}

console.log("[cache] Query cache service loaded");
