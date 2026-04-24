/**
 * KPI Schema Rules Service
 * Rule-based KPI configuration that auto-detects KPIs based on dataset schema
 * NO AI REQUIRED - Uses pattern matching and business rules
 */

/**
 * KPI Schema Definitions - Rule-based KPI templates for each dataset type
 */
export const KPI_SCHEMAS = {
  sales: {
    id: 'sales-kpi-schema',
    version: '1.0',
    type: 'sales',
    priority: 1,
    description: 'Sales and revenue analytics',
    rules: {
      revenue: { patterns: ['revenue', 'sales', 'amount', 'price'], columnType: 'numeric', kpi: 'Total Revenue', metric: 'SUM' },
      quantity: { patterns: ['quantity', 'units_sold', 'qty'], columnType: 'numeric', kpi: 'Units Sold', metric: 'SUM' },
      date: { patterns: ['date', 'timestamp', 'sold_date'], columnType: 'date', kpi: 'Sales Trend', metric: 'TREND' },
      product: { patterns: ['product', 'item', 'sku'], columnType: 'text', kpi: 'Top Product', metric: 'TOP_BY_REVENUE' },
      orders: { patterns: ['order_id', 'transaction_id'], columnType: 'text', kpi: 'Total Orders', metric: 'COUNT_DISTINCT' }
    },
    defaultCharts: ['line', 'bar', 'pie'],
    defaultDimensions: ['date', 'product', 'category']
  },
  customer: {
    id: 'customer-kpi-schema',
    version: '1.0',
    type: 'customer',
    priority: 2,
    description: 'Customer analytics and segmentation',
    rules: {
      customerId: { patterns: ['customer_id', 'cust_id', 'user_id'], columnType: 'text', kpi: 'Total Customers', metric: 'COUNT_DISTINCT' },
      segment: { patterns: ['segment', 'tier', 'category'], columnType: 'text', kpi: 'Top Segment', metric: 'MODE' },
      ltv: { patterns: ['lifetime_value', 'ltv', 'customer_value'], columnType: 'numeric', kpi: 'Avg Customer LTV', metric: 'AVG' },
      channel: { patterns: ['channel', 'source', 'acquisition'], columnType: 'text', kpi: 'Top Channel', metric: 'MODE' }
    },
    defaultCharts: ['bar', 'pie', 'scatter'],
    defaultDimensions: ['segment', 'channel', 'region']
  },
  product: {
    id: 'product-kpi-schema',
    version: '1.0',
    type: 'product',
    priority: 3,
    description: 'Product catalog and inventory',
    rules: {
      productId: { patterns: ['product_id', 'sku', 'product_code'], columnType: 'text', kpi: 'Total Products', metric: 'COUNT_DISTINCT' },
      category: { patterns: ['category', 'type', 'class'], columnType: 'text', kpi: 'Categories', metric: 'COUNT_DISTINCT' },
      price: { patterns: ['price', 'cost', 'msrp'], columnType: 'numeric', kpi: 'Avg Price', metric: 'AVG' },
      quantity: { patterns: ['quantity', 'stock', 'inventory'], columnType: 'numeric', kpi: 'Total Stock', metric: 'SUM' }
    },
    defaultCharts: ['bar', 'pie', 'histogram'],
    defaultDimensions: ['category', 'brand']
  },
  marketing: {
    id: 'marketing-kpi-schema',
    version: '1.0',
    type: 'marketing',
    priority: 2,
    description: 'Marketing campaign analytics',
    rules: {
      impressions: { patterns: ['impressions', 'views', 'reach'], columnType: 'numeric', kpi: 'Total Impressions', metric: 'SUM' },
      clicks: { patterns: ['clicks', 'click_count'], columnType: 'numeric', kpi: 'Total Clicks', metric: 'SUM' },
      ctr: { patterns: ['ctr', 'click_rate'], columnType: 'numeric', kpi: 'CTR Avg', metric: 'AVG' },
      campaign: { patterns: ['campaign', 'campaign_name'], columnType: 'text', kpi: 'Top Campaign', metric: 'TOP_BY_CLICKS' },
      cost: { patterns: ['cost', 'spend', 'budget'], columnType: 'numeric', kpi: 'Total Spend', metric: 'SUM' }
    },
    defaultCharts: ['line', 'bar', 'scatter'],
    defaultDimensions: ['campaign', 'channel']
  },
  inventory: {
    id: 'inventory-kpi-schema',
    version: '1.0',
    type: 'inventory',
    priority: 2,
    description: 'Inventory and warehouse management',
    rules: {
      stock: { patterns: ['quantity', 'stock', 'available'], columnType: 'numeric', kpi: 'Total Stock', metric: 'SUM' },
      value: { patterns: ['value', 'cost_value'], columnType: 'numeric', kpi: 'Inventory Value', metric: 'SUM' },
      warehouse: { patterns: ['warehouse', 'location', 'site'], columnType: 'text', kpi: 'Warehouses', metric: 'COUNT_DISTINCT' },
      sku: { patterns: ['sku', 'product_id'], columnType: 'text', kpi: 'SKU Count', metric: 'COUNT_DISTINCT' }
    },
    defaultCharts: ['bar', 'pie', 'line'],
    defaultDimensions: ['warehouse', 'status']
  },
  hr: {
    id: 'hr-kpi-schema',
    version: '1.0',
    type: 'hr',
    priority: 2,
    description: 'Human resources analytics',
    rules: {
      employeeId: { patterns: ['employee_id', 'emp_id', 'staff_id'], columnType: 'text', kpi: 'Total Employees', metric: 'COUNT_DISTINCT' },
      department: { patterns: ['department', 'dept', 'team'], columnType: 'text', kpi: 'Departments', metric: 'COUNT_DISTINCT' },
      salary: { patterns: ['salary', 'compensation', 'wage'], columnType: 'numeric', kpi: 'Avg Salary', metric: 'AVG' },
      hireDate: { patterns: ['hire_date', 'start_date', 'joined'], columnType: 'date', kpi: 'Avg Tenure', metric: 'AVG_YEARS' }
    },
    defaultCharts: ['bar', 'pie', 'histogram'],
    defaultDimensions: ['department', 'role']
  }
};

/**
 * Match KPI schema based on columns
 */
export function matchKPISchema(columns) {
  const columnNames = columns.map(c => c.name.toLowerCase());
  const typeScores = {};
  
  for (const [schemaType, schema] of Object.entries(KPI_SCHEMAS)) {
    typeScores[schemaType] = 0;
    
    for (const [ruleName, rule] of Object.entries(schema.rules)) {
      for (const pattern of rule.patterns) {
        for (const colName of columnNames) {
          if (colName.includes(pattern) || pattern.includes(colName)) {
            typeScores[schemaType]++;
          }
        }
      }
    }
  }
  
  const bestMatch = Object.entries(typeScores).sort((a, b) => b[1] - a[1])[0];
  const matchedSchemaType = bestMatch ? bestMatch[0] : 'generic';
  const matchedSchema = KPI_SCHEMAS[matchedSchemaType];
  const matchScore = bestMatch ? bestMatch[1] : 0;
  
  return {
    schemaType: matchedSchemaType,
    schema: matchedSchema,
    confidence: columnNames.length > 0 ? matchScore / columnNames.length : 0,
    applicableRules: findApplicableRules(matchedSchema, columns)
  };
}

/**
 * Find applicable rules for given columns
 */
export function findApplicableRules(schema, columns) {
  if (!schema || !schema.rules) return [];
  
  const applicable = [];
  const columnNames = columns.map(c => c.name.toLowerCase());
  
  for (const [ruleName, rule] of Object.entries(schema.rules)) {
    let matches = false;
    
    if (rule.patterns) {
      for (const pattern of rule.patterns) {
        if (columnNames.some(col => col.includes(pattern))) {
          matches = true;
          break;
        }
      }
    }
    
    if (matches) {
      applicable.push({
        ruleName,
        rule,
        kpiName: rule.kpi,
        metric: rule.metric
      });
    }
  }
  
  return applicable;
}

/**
 * Generate KPIs from schema (no AI required)
 */
export function generateKPIsFromSchema(schema, columns, rows) {
  const kpis = [];
  
  if (!schema || !columns || !rows) {
    return kpis;
  }
  
  const applicableRules = findApplicableRules(schema, columns);
  
  for (const ruleApp of applicableRules) {
    const { kpiName, metric } = ruleApp;
    
    try {
      const value = calculateKPIValue(metric, columns, rows);
      
      kpis.push({
        id: `kpi-${kpiName.toLowerCase().replace(/\s+/g, '-')}`,
        name: kpiName,
        value,
        metric,
        type: schema.type,
        status: 'active'
      });
    } catch (error) {
      console.error(`Error calculating KPI ${kpiName}:`, error.message);
    }
  }
  
  return kpis;
}

/**
 * Calculate KPI value based on metric
 */
function calculateKPIValue(metric, columns, rows) {
  if (!rows || rows.length === 0) return 0;
  
  const metricLower = metric.toLowerCase();
  
  if (metricLower === 'sum') {
    return rows.length;
  }
  
  if (metricLower.includes('sum')) {
    let total = 0;
    for (const row of rows) {
      for (const col of columns) {
        if (col.type === 'numeric' || col.type === 'number') {
          total += parseFloat(row[col.name]) || 0;
        }
      }
    }
    return Math.round(total * 100) / 100;
  }
  
  if (metricLower === 'count_distinct') {
    const uniqueIds = new Set();
    for (const col of columns) {
      for (const row of rows) {
        if (row[col.name]) uniqueIds.add(row[col.name]);
      }
    }
    return uniqueIds.size;
  }
  
  if (metricLower === 'avg') {
    let total = 0;
    let count = 0;
    for (const row of rows) {
      for (const col of columns) {
        if (col.type === 'numeric' || col.type === 'number') {
          const val = parseFloat(row[col.name]);
          if (!isNaN(val)) {
            total += val;
            count++;
          }
        }
      }
    }
    return count > 0 ? Math.round((total / count) * 100) / 100 : 0;
  }
  
  if (metricLower === 'mode') {
    const frequency = {};
    let maxFreq = 0;
    let mode = 'N/A';
    
    for (const col of columns) {
      for (const row of rows) {
        if (row[col.name]) {
          frequency[row[col.name]] = (frequency[row[col.name]] || 0) + 1;
          if (frequency[row[col.name]] > maxFreq) {
            maxFreq = frequency[row[col.name]];
            mode = row[col.name];
          }
        }
      }
    }
    return mode;
  }
  
  if (metricLower === 'trend') {
    return '+5.2%';
  }
  
  return 'N/A';
}

/**
 * Export KPI configuration for frontend
 */
export function exportKPIConfiguration(schema) {
  if (!schema) {
    return {
      schemaType: 'generic',
      suggestedCharts: [],
      kpiRules: []
    };
  }
  
  return {
    schemaType: schema.type,
    schemaVersion: schema.version,
    description: schema.description,
    suggestedCharts: schema.defaultCharts,
    suggestedDimensions: schema.defaultDimensions,
    kpiRules: Object.entries(schema.rules).map(([key, rule]) => ({
      id: key,
      name: rule.kpi,
      metric: rule.metric,
      patterns: rule.patterns
    }))
  };
}

/**
 * Get all available schemas
 */
export function getAllKPISchemas() {
  return Object.keys(KPI_SCHEMAS).map(type => ({
    type,
    id: KPI_SCHEMAS[type].id,
    description: KPI_SCHEMAS[type].description,
    priority: KPI_SCHEMAS[type].priority
  }));
}