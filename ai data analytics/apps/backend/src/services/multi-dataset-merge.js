/**
 * Multi-Dataset Merge Service
 * Handles merging multiple datasets with intelligent schema matching and KPI auto-detection
 * No AI required - uses rule-based pattern matching
 */

/**
 * Detect dataset type based on column names and patterns
 */
export function detectDatasetType(columns) {
  const columnNames = columns.map(c => c.name.toLowerCase());
  const columnStr = columnNames.join(' ');
  
  const typePatterns = [
    {
      type: 'sales',
      keywords: ['revenue', 'sales', 'amount', 'price', 'transaction', 'order'],
      confidence: 0.95
    },
    {
      type: 'customer',
      keywords: ['customer', 'email', 'phone', 'address', 'client', 'user'],
      confidence: 0.92
    },
    {
      type: 'product',
      keywords: ['product', 'sku', 'category', 'inventory', 'item', 'stock'],
      confidence: 0.90
    },
    {
      type: 'inventory',
      keywords: ['stock', 'quantity', 'warehouse', 'inventory', 'available', 'location'],
      confidence: 0.88
    },
    {
      type: 'marketing',
      keywords: ['campaign', 'impressions', 'clicks', 'ctr', 'cpc', 'roi', 'spend'],
      confidence: 0.85
    },
    {
      type: 'hr',
      keywords: ['employee', 'salary', 'department', 'hire', 'role', 'compensation'],
      confidence: 0.83
    }
  ];
  
  let bestMatch = { type: 'generic', confidence: 0 };
  
  for (const pattern of typePatterns) {
    let matchCount = 0;
    for (const keyword of pattern.keywords) {
      if (columnStr.includes(keyword)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      const score = (matchCount / pattern.keywords.length) * pattern.confidence;
      if (score > bestMatch.confidence) {
        bestMatch = { type: pattern.type, confidence: score, matchCount };
      }
    }
  }
  
  return bestMatch;
}

/**
 * Get KPI rules for dataset type
 */
export function getKPIRulesForType(datasetType) {
  const kpiRules = {
    sales: {
      metrics: [
        { name: 'Total Revenue', formula: 'SUM(revenue)', type: 'currency', icon: 'DollarSign' },
        { name: 'Average Order Value', formula: 'AVG(amount)', type: 'currency', icon: 'BarChart3' },
        { name: 'Total Orders', formula: 'COUNT(DISTINCT order_id)', type: 'number', icon: 'ShoppingCart' },
        { name: 'Revenue Growth', formula: 'TREND(revenue)', type: 'percent', icon: 'TrendingUp' },
        { name: 'Top Product', formula: 'MODE(product_name)', type: 'text', icon: 'Award' }
      ],
      charts: ['line', 'bar', 'pie'],
      dimensions: ['date', 'product', 'region', 'customer', 'category']
    },
    customer: {
      metrics: [
        { name: 'Total Customers', formula: 'COUNT(DISTINCT customer_id)', type: 'number', icon: 'Users' },
        { name: 'Customer Segments', formula: 'COUNT(DISTINCT segment)', type: 'number', icon: 'Layers' },
        { name: 'Average Lifetime Value', formula: 'AVG(lifetime_value)', type: 'currency', icon: 'TrendingUp' },
        { name: 'Top Segment', formula: 'MODE(segment)', type: 'text', icon: 'Target' },
        { name: 'Churn Rate', formula: 'CHURN_RATE()', type: 'percent', icon: 'AlertTriangle' }
      ],
      charts: ['bar', 'pie', 'scatter'],
      dimensions: ['segment', 'region', 'acquisition_channel', 'tier']
    },
    product: {
      metrics: [
        { name: 'Total Products', formula: 'COUNT(DISTINCT product_id)', type: 'number', icon: 'Package' },
        { name: 'Average Price', formula: 'AVG(price)', type: 'currency', icon: 'DollarSign' },
        { name: 'Product Categories', formula: 'COUNT(DISTINCT category)', type: 'number', icon: 'FolderOpen' },
        { name: 'Total Inventory', formula: 'SUM(quantity)', type: 'number', icon: 'BarChart3' },
        { name: 'Low Stock Count', formula: 'COUNT(quantity < 10)', type: 'number', icon: 'AlertTriangle' }
      ],
      charts: ['bar', 'pie', 'histogram'],
      dimensions: ['category', 'brand', 'status', 'supplier']
    },
    inventory: {
      metrics: [
        { name: 'Total Inventory Value', formula: 'SUM(quantity * cost)', type: 'currency', icon: 'DollarSign' },
        { name: 'Stock Turnover Rate', formula: 'TURNOVER_RATE()', type: 'number', icon: 'Zap' },
        { name: 'Out of Stock Items', formula: 'COUNT(quantity = 0)', type: 'number', icon: 'AlertTriangle' },
        { name: 'Inventory Accuracy', formula: 'ACCURACY_RATE()', type: 'percent', icon: 'CheckCircle' },
        { name: 'Warehouse Count', formula: 'COUNT(DISTINCT warehouse)', type: 'number', icon: 'Building2' }
      ],
      charts: ['line', 'bar', 'gauge'],
      dimensions: ['warehouse', 'location', 'sku', 'category']
    },
    marketing: {
      metrics: [
        { name: 'Total Impressions', formula: 'SUM(impressions)', type: 'number', icon: 'Eye' },
        { name: 'Total Clicks', formula: 'SUM(clicks)', type: 'number', icon: 'MousePointer' },
        { name: 'Click Through Rate', formula: 'AVG(ctr)', type: 'percent', icon: 'Activity' },
        { name: 'Cost Per Click', formula: 'AVG(cpc)', type: 'currency', icon: 'DollarSign' },
        { name: 'ROI', formula: 'CALCULATE_ROI()', type: 'percent', icon: 'TrendingUp' }
      ],
      charts: ['line', 'bar', 'scatter'],
      dimensions: ['campaign', 'channel', 'audience', 'creative']
    },
    hr: {
      metrics: [
        { name: 'Total Employees', formula: 'COUNT(DISTINCT employee_id)', type: 'number', icon: 'Users' },
        { name: 'Average Salary', formula: 'AVG(salary)', type: 'currency', icon: 'DollarSign' },
        { name: 'Turnover Rate', formula: 'TURNOVER_RATE()', type: 'percent', icon: 'LogOut' },
        { name: 'Departments', formula: 'COUNT(DISTINCT department)', type: 'number', icon: 'Layers' },
        { name: 'Average Tenure', formula: 'AVG_YEARS()', type: 'number', icon: 'Calendar' }
      ],
      charts: ['bar', 'pie', 'histogram'],
      dimensions: ['department', 'role', 'location', 'status']
    },
    generic: {
      metrics: [
        { name: 'Record Count', formula: 'COUNT(*)', type: 'number', icon: 'Hash' },
        { name: 'Unique Records', formula: 'COUNT(DISTINCT *)', type: 'number', icon: 'Filter' }
      ],
      charts: ['bar', 'table'],
      dimensions: []
    }
  };
  
  return kpiRules[datasetType] || kpiRules.generic;
}

/**
 * Find potential join keys between datasets
 */
export function findJoinKeys(dataset1Columns, dataset2Columns) {
  const joinCandidates = [];
  
  for (const col1 of dataset1Columns) {
    for (const col2 of dataset2Columns) {
      const match = col1.name.toLowerCase() === col2.name.toLowerCase();
      if (match) {
        joinCandidates.push({
          column1: col1.name,
          column2: col2.name,
          confidence: 0.95,
          type: 'exact_match',
          reason: 'Exact column name match'
        });
      }
    }
  }
  
  const patterns = [
    { name: 'id', priority: 3 },
    { name: 'key', priority: 3 },
    { name: 'code', priority: 2 },
    { name: 'date', priority: 1 },
    { name: 'time', priority: 1 }
  ];
  
  for (const col1 of dataset1Columns) {
    for (const col2 of dataset2Columns) {
      const name1 = col1.name.toLowerCase();
      const name2 = col2.name.toLowerCase();
      
      for (const pattern of patterns) {
        if (name1.includes(pattern.name) && name2.includes(pattern.name) && name1 !== name2) {
          if (col1.type === col2.type) {
            joinCandidates.push({
              column1: col1.name,
              column2: col2.name,
              confidence: 0.7,
              type: 'pattern_match',
              reason: `Both contain '${pattern.name}'`
            });
          }
        }
      }
    }
  }
  
  return joinCandidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/**
 * Merge multiple datasets
 */
export function mergeDatasets(datasets, mergeConfig = {}) {
  if (!datasets || datasets.length === 0) {
    throw new Error('At least one dataset is required');
  }
  
  if (datasets.length === 1) {
    return {
      mergedDataset: datasets[0],
      schema: buildMergedSchema(datasets[0].columns),
      metadata: {
        sourceDatasets: 1,
        totalRows: datasets[0].rows.length,
        joins: []
      }
    };
  }
  
  let mergedRows = JSON.parse(JSON.stringify(datasets[0].rows));
  let mergedColumns = [...datasets[0].columns];
  const joins = [];
  
  for (let i = 1; i < datasets.length; i++) {
    const currentDataset = datasets[i];
    const joinCandidates = findJoinKeys(mergedColumns, currentDataset.columns);
    
    if (joinCandidates.length > 0) {
      const joinKey = joinCandidates[0];
      const joinResult = performJoin(
        mergedRows,
        currentDataset.rows,
        joinKey.column1,
        joinKey.column2,
        mergeConfig.joinType || 'left'
      );
      
      mergedRows = joinResult.rows;
      
      joins.push({
        leftDataset: i === 1 ? datasets[0].name : 'merged',
        rightDataset: currentDataset.name,
        joinKey: {
          left: joinKey.column1,
          right: joinKey.column2
        },
        type: mergeConfig.joinType || 'left',
        rowsMatched: joinResult.matchedRows,
        confidence: joinKey.confidence
      });
      
      for (const col of currentDataset.columns) {
        if (!mergedColumns.find(c => c.name === col.name)) {
          mergedColumns.push(col);
        }
      }
    } else {
      for (const col of currentDataset.columns) {
        if (!mergedColumns.find(c => c.name === col.name)) {
          mergedColumns.push(col);
        }
      }
    }
  }
  
  return {
    mergedDataset: {
      name: `${datasets[0].name}_merged`,
      columns: mergedColumns,
      rows: mergedRows,
      sourceType: 'multi-dataset-merge'
    },
    schema: buildMergedSchema(mergedColumns),
    metadata: {
      sourceDatasets: datasets.length,
      totalRows: mergedRows.length,
      joins,
      detectedTypes: datasets.map(d => detectDatasetType(d.columns))
    }
  };
}

/**
 * Perform join operation
 */
function performJoin(leftRows, rightRows, leftKey, rightKey, joinType = 'left') {
  const joinedRows = [];
  let matchedRows = 0;
  
  if (joinType === 'left') {
    for (const leftRow of leftRows) {
      const matchedRight = rightRows.find(r => String(r[rightKey]).toLowerCase() === String(leftRow[leftKey]).toLowerCase());
      if (matchedRight) {
        joinedRows.push({ ...leftRow, ...matchedRight });
        matchedRows++;
      } else {
        joinedRows.push(leftRow);
      }
    }
  } else if (joinType === 'inner') {
    for (const leftRow of leftRows) {
      const matchedRight = rightRows.find(r => String(r[rightKey]).toLowerCase() === String(leftRow[leftKey]).toLowerCase());
      if (matchedRight) {
        joinedRows.push({ ...leftRow, ...matchedRight });
        matchedRows++;
      }
    }
  } else if (joinType === 'full') {
    const processedRightRows = new Set();
    for (const leftRow of leftRows) {
      const matchedRightIndex = rightRows.findIndex(r => String(r[rightKey]).toLowerCase() === String(leftRow[leftKey]).toLowerCase());
      if (matchedRightIndex !== -1) {
        joinedRows.push({ ...leftRow, ...rightRows[matchedRightIndex] });
        processedRightRows.add(matchedRightIndex);
        matchedRows++;
      } else {
        joinedRows.push(leftRow);
      }
    }
    for (let i = 0; i < rightRows.length; i++) {
      if (!processedRightRows.has(i)) {
        joinedRows.push(rightRows[i]);
      }
    }
  }
  
  return { rows: joinedRows, matchedRows };
}

/**
 * Build merged schema
 */
export function buildMergedSchema(columns) {
  return {
    totalColumns: columns.length,
    columns: columns.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable !== false
    }))
  };
}

/**
 * Generate KPI recommendations
 */
export function generateKPIRecommendations(datasets) {
  const recommendations = [];
  
  for (const dataset of datasets) {
    const detection = detectDatasetType(dataset.columns);
    const kpiRules = getKPIRulesForType(detection.type);
    
    recommendations.push({
      datasetName: dataset.name,
      detectedType: detection.type,
      confidence: detection.confidence,
      suggestedKPIs: kpiRules.metrics,
      suggestedCharts: kpiRules.charts,
      suggestedDimensions: kpiRules.dimensions
    });
  }
  
  return recommendations;
}

/**
 * Validate merge compatibility
 */
export function validateMergeCompatibility(datasets) {
  const issues = [];
  
  if (!datasets || datasets.length < 2) {
    return { valid: false, issues: ['At least 2 datasets required for merge'] };
  }
  
  for (let i = 0; i < datasets.length; i++) {
    if (!datasets[i].rows || datasets[i].rows.length === 0) {
      issues.push(`Dataset ${i + 1} (${datasets[i].name}) has no rows`);
    }
    if (!datasets[i].columns || datasets[i].columns.length === 0) {
      issues.push(`Dataset ${i + 1} (${datasets[i].name}) has no columns`);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}