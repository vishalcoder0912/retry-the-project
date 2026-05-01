/**
 * Schema extraction utilities for AI interactions
 * Ensures only schema information (not actual data) is sent to AI services
 */

export const extractSchemaForAI = (dataset, schema) => {
  return {
    dataset: {
      name: dataset.name,
      rowCount: dataset.rowCount,
      columnCount: schema.columns.length,
      // Only include metadata, not actual data
    },
    schema: {
      columns: schema.columns.map(col => ({
        name: col.name,
        type: col.type,
        role: col.role,
        // Include sample values if available, but limit to 3-5 generic examples
        sampleValues: col.sample ? Array.isArray(col.sample) ? col.sample.slice(0, 3) : [col.sample] : []
      })),
      primaryDimension: schema.primaryDimension ? {
        name: schema.primaryDimension.name,
        type: schema.primaryDimension.type
      } : null,
      secondaryDimension: schema.secondaryDimension ? {
        name: schema.secondaryDimension.name,
        type: schema.secondaryDimension.type
      } : null,
      primaryMetric: schema.primaryMetric ? {
        name: schema.primaryMetric.name,
        type: schema.primaryMetric.type
      } : null,
      secondaryMetric: schema.secondaryMetric ? {
        name: schema.secondaryMetric.name,
        type: schema.secondaryMetric.type
      } : null,
    },
    // Explicitly exclude actual data rows
    dataSummary: {
      totalRows: dataset.rowCount,
      totalColumns: schema.columns.length,
      numericColumns: schema.columns.filter(col => col.type === 'number').length,
      textColumns: schema.columns.filter(col => col.type === 'string').length,
      dateColumns: schema.columns.filter(col => col.type === 'date').length,
    }
  };
};

export const sanitizeQueryContext = (context) => {
  // Remove any actual data rows from context
  const sanitized = { ...context };
  
  if (sanitized.dataset && sanitized.dataset.rows) {
    delete sanitized.dataset.rows;
  }
  
  if (sanitized.analyticsDataset && sanitized.analyticsDataset.rows) {
    delete sanitized.analyticsDataset.rows;
  }
  
  // Ensure we only have schema information
  if (sanitized.schema && sanitized.dataset) {
    sanitized.schemaOnly = extractSchemaForAI(sanitized.dataset, sanitized.schema);
  }
  
  return sanitized;
};

export const buildSchemaOnlyPrompt = (query, schemaInfo) => {
  const { dataset, schema, dataSummary } = schemaInfo;
  
  let prompt = `You are analyzing a dataset based on its schema only. You do NOT have access to actual data values.

Dataset Information:
- Name: ${dataset.name}
- Total Rows: ${dataset.rowCount}
- Total Columns: ${dataset.columnCount}

Schema Structure:
${schema.columns.map(col => `- ${col.name} (${col.type}, ${col.role})`).join('\n')}

Data Summary:
- Numeric columns: ${dataSummary.numericColumns}
- Text columns: ${dataSummary.textColumns}
- Date columns: ${dataSummary.dateColumns}

Available Analysis Types:
- Trend analysis over time
- Comparisons between categories
- Distribution analysis
- Correlation between numeric variables

Important: You can only suggest queries and analysis based on the schema structure. You cannot reference specific data values since you don't have access to the actual data.

User Query: ${query}

Provide a helpful response based on the schema structure and suggest appropriate SQL queries or analysis approaches.`;

  return prompt;
};

export const validateSchemaOnlyContext = (context) => {
  // Ensure no actual data is being sent to AI
  const forbiddenKeys = ['rows', 'data', 'actualData', 'realData'];
  const violations = [];
  
  const checkObject = (obj, path = '') => {
    if (typeof obj !== 'object' || obj === null) return;
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (forbiddenKeys.includes(key.toLowerCase())) {
        violations.push(`Found potential data at path: ${currentPath}`);
      }
      
      if (Array.isArray(value) && key.toLowerCase().includes('row')) {
        violations.push(`Found potential row data at path: ${currentPath}`);
      }
      
      if (typeof value === 'object' && value !== null) {
        checkObject(value, currentPath);
      }
    }
  };
  
  checkObject(context);
  
  return {
    isValid: violations.length === 0,
    violations,
  };
};
