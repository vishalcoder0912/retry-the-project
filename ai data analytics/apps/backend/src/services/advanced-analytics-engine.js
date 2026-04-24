/**
 * Advanced Analytics Engine
 * Handles intelligent analysis for 20+ dataset types
 * Supports: Sales, Customer, Product, Inventory, Marketing, HR, Financial,
 * Web Analytics, Education, Healthcare, Supply Chain, Real Estate,
 * Food Service, Telecom, Airline, Retail + more
 */

/**
 * Comprehensive dataset type definitions with analysis rules
 */
const DATASET_TYPE_DEFINITIONS = {
  sales: {
    name: 'Sales Analytics',
    priority: 1,
    patterns: ['revenue', 'sales', 'order', 'product', 'customer', 'amount', 'price'],
    keyMetrics: [
      'total_revenue',
      'average_order_value',
      'total_orders',
      'revenue_growth',
      'top_product',
      'sales_by_region',
      'conversion_rate'
    ],
    analysisTypes: ['trend', 'comparison', 'drill-down', 'forecast'],
    requiredColumns: ['date', 'amount'],
    visualizations: ['line_chart', 'bar_chart', 'pie_chart', 'scatter_plot'],
  },
  customer: {
    name: 'Customer Analytics',
    priority: 1,
    patterns: ['customer', 'user', 'client', 'segment', 'ltv', 'churn'],
    keyMetrics: [
      'total_customers',
      'customer_churn_rate',
      'customer_lifetime_value',
      'customer_acquisition_cost',
      'repeat_purchase_rate',
      'customer_segments',
      'retention_rate'
    ],
    analysisTypes: ['segmentation', 'cohort', 'retention', 'churn_prediction'],
    requiredColumns: ['customer_id'],
    visualizations: ['bar_chart', 'pie_chart', 'scatter_plot', 'heatmap'],
  },
  product: {
    name: 'Product Analytics',
    priority: 2,
    patterns: ['product', 'sku', 'category', 'brand', 'inventory', 'stock'],
    keyMetrics: [
      'total_products',
      'products_by_category',
      'average_price',
      'total_inventory_value',
      'slow_moving_products',
      'bestsellers',
      'product_performance'
    ],
    analysisTypes: ['performance', 'categorization', 'pricing'],
    requiredColumns: ['product_id', 'price'],
    visualizations: ['bar_chart', 'pie_chart', 'histogram', 'table'],
  },
  inventory: {
    name: 'Inventory Management',
    priority: 2,
    patterns: ['inventory', 'stock', 'warehouse', 'quantity', 'sku', 'location'],
    keyMetrics: [
      'total_inventory_value',
      'stock_turnover_rate',
      'out_of_stock_items',
      'inventory_accuracy',
      'warehouse_utilization',
      'reorder_point_analysis',
      'carrying_cost'
    ],
    analysisTypes: ['movement', 'optimization', 'forecasting'],
    requiredColumns: ['quantity', 'warehouse'],
    visualizations: ['line_chart', 'bar_chart', 'gauge_chart', 'heatmap'],
  },
  marketing: {
    name: 'Marketing Analytics',
    priority: 2,
    patterns: ['campaign', 'impressions', 'clicks', 'ctr', 'roi', 'cost', 'conversion'],
    keyMetrics: [
      'total_impressions',
      'click_through_rate',
      'cost_per_click',
      'roi',
      'conversion_rate',
      'campaign_performance',
      'channel_effectiveness'
    ],
    analysisTypes: ['performance', 'attribution', 'optimization'],
    requiredColumns: ['impressions', 'clicks'],
    visualizations: ['line_chart', 'bar_chart', 'scatter_plot', 'funnel_chart'],
  },
  hr: {
    name: 'HR Analytics',
    priority: 2,
    patterns: ['employee', 'salary', 'department', 'hire', 'performance', 'turnover'],
    keyMetrics: [
      'total_employees',
      'average_salary',
      'turnover_rate',
      'department_distribution',
      'performance_ratings',
      'engagement_score',
      'training_impact'
    ],
    analysisTypes: ['workforce', 'performance', 'retention'],
    requiredColumns: ['employee_id', 'department'],
    visualizations: ['bar_chart', 'pie_chart', 'histogram', 'heatmap'],
  },
  financial: {
    name: 'Financial Analytics',
    priority: 1,
    patterns: ['revenue', 'cost', 'expense', 'budget', 'income', 'transaction', 'amount'],
    keyMetrics: [
      'total_revenue',
      'total_expenses',
      'profit_margin',
      'budget_variance',
      'cash_flow',
      'departmental_spending',
      'cost_center_analysis'
    ],
    analysisTypes: ['budget', 'variance', 'forecasting', 'trend'],
    requiredColumns: ['amount', 'date'],
    visualizations: ['line_chart', 'bar_chart', 'waterfall_chart', 'scatter_plot'],
  },
  web_analytics: {
    name: 'Web Analytics',
    priority: 2,
    patterns: ['session', 'user', 'page', 'traffic', 'bounce', 'conversion', 'device'],
    keyMetrics: [
      'total_sessions',
      'unique_users',
      'bounce_rate',
      'avg_session_duration',
      'pages_per_session',
      'conversion_rate',
      'traffic_sources'
    ],
    analysisTypes: ['user_flow', 'conversion_funnel', 'device_analysis'],
    requiredColumns: ['session_id', 'user_id'],
    visualizations: ['line_chart', 'bar_chart', 'funnel_chart', 'pie_chart'],
  },
  education: {
    name: 'Education Analytics',
    priority: 2,
    patterns: ['student', 'grade', 'score', 'attendance', 'subject', 'enrollment'],
    keyMetrics: [
      'average_gpa',
      'student_retention',
      'subject_performance',
      'attendance_rate',
      'completion_rate',
      'scholarship_distribution',
      'at_risk_students'
    ],
    analysisTypes: ['performance', 'retention', 'engagement'],
    requiredColumns: ['student_id', 'grade_level'],
    visualizations: ['bar_chart', 'histogram', 'scatter_plot', 'heatmap'],
  },
  healthcare: {
    name: 'Healthcare Analytics',
    priority: 2,
    patterns: ['patient', 'admission', 'diagnosis', 'treatment', 'cost', 'department'],
    keyMetrics: [
      'average_length_of_stay',
      'patient_readmission_rate',
      'average_treatment_cost',
      'department_efficiency',
      'patient_satisfaction',
      'outcome_analysis',
      'resource_utilization'
    ],
    analysisTypes: ['clinical', 'operational', 'financial'],
    requiredColumns: ['patient_id', 'admission_date'],
    visualizations: ['bar_chart', 'scatter_plot', 'heatmap', 'timeline_chart'],
  },
  supply_chain: {
    name: 'Supply Chain Analytics',
    priority: 2,
    patterns: ['supplier', 'delivery', 'order', 'procurement', 'lead_time', 'cost'],
    keyMetrics: [
      'on_time_delivery_rate',
      'supplier_performance',
      'lead_time_average',
      'procurement_efficiency',
      'cost_savings',
      'inventory_level',
      'supplier_quality'
    ],
    analysisTypes: ['supplier_performance', 'logistics', 'cost_analysis'],
    requiredColumns: ['po_number', 'delivery_date'],
    visualizations: ['bar_chart', 'scatter_plot', 'line_chart', 'gauge_chart'],
  },
  real_estate: {
    name: 'Real Estate Analytics',
    priority: 2,
    patterns: ['property', 'price', 'sale', 'rent', 'location', 'agent', 'listing'],
    keyMetrics: [
      'average_price',
      'average_days_on_market',
      'price_per_sqft',
      'market_trend',
      'agent_performance',
      'property_type_distribution',
      'location_analysis'
    ],
    analysisTypes: ['market_analysis', 'price_prediction', 'agent_performance'],
    requiredColumns: ['property_id', 'price'],
    visualizations: ['scatter_plot', 'bar_chart', 'map_chart', 'line_chart'],
  },
  food_service: {
    name: 'Food Service Analytics',
    priority: 3,
    patterns: ['restaurant', 'menu', 'transaction', 'food', 'customer', 'sale'],
    keyMetrics: [
      'average_check_size',
      'food_cost_percentage',
      'customer_satisfaction',
      'item_performance',
      'waste_analysis',
      'revenue_per_item',
      'peak_hours'
    ],
    analysisTypes: ['operations', 'menu_engineering', 'waste_management'],
    requiredColumns: ['transaction_id', 'amount'],
    visualizations: ['bar_chart', 'pie_chart', 'line_chart', 'heatmap'],
  },
  telecom: {
    name: 'Telecom Analytics',
    priority: 2,
    patterns: ['customer', 'service', 'churn', 'plan', 'bill', 'usage', 'network'],
    keyMetrics: [
      'customer_churn_rate',
      'arpu',
      'customer_lifetime_value',
      'network_usage',
      'plan_adoption',
      'customer_satisfaction',
      'acquisition_cost'
    ],
    analysisTypes: ['churn_prediction', 'usage_analysis', 'segmentation'],
    requiredColumns: ['customer_id', 'monthly_bill'],
    visualizations: ['line_chart', 'bar_chart', 'scatter_plot', 'gauge_chart'],
  },
  airline: {
    name: 'Airline Analytics',
    priority: 2,
    patterns: ['flight', 'passenger', 'route', 'revenue', 'aircraft', 'delay'],
    keyMetrics: [
      'average_load_factor',
      'revenue_per_passenger',
      'on_time_performance',
      'route_profitability',
      'fleet_utilization',
      'passenger_satisfaction',
      'fuel_efficiency'
    ],
    analysisTypes: ['route_optimization', 'fleet_management', 'revenue_management'],
    requiredColumns: ['flight_id', 'departure_date'],
    visualizations: ['bar_chart', 'line_chart', 'scatter_plot', 'map_chart'],
  },
  retail: {
    name: 'Retail Analytics',
    priority: 1,
    patterns: ['store', 'sales', 'product', 'transaction', 'customer', 'inventory'],
    keyMetrics: [
      'total_sales',
      'sales_per_store',
      'product_category_performance',
      'inventory_turnover',
      'customer_traffic',
      'basket_size',
      'shrinkage_rate'
    ],
    analysisTypes: ['performance', 'merchandising', 'store_comparison'],
    requiredColumns: ['store_id', 'transaction_id'],
    visualizations: ['bar_chart', 'line_chart', 'pie_chart', 'heatmap'],
  },
};

/**
 * Detect dataset type and return analysis configuration
 */
export function detectDatasetTypeAdvanced(columns) {
  const columnNames = columns.map(c => c.name.toLowerCase());
  const typeScores = {};

  for (const [type, definition] of Object.entries(DATASET_TYPE_DEFINITIONS)) {
    typeScores[type] = {
      score: 0,
      matchedPatterns: [],
      confidence: 0,
    };

    for (const pattern of definition.patterns) {
      for (const colName of columnNames) {
        if (colName.includes(pattern) || pattern.includes(colName)) {
          typeScores[type].score += 2;
          typeScores[type].matchedPatterns.push(pattern);
        }
      }
    }

    let requiredMet = true;
    for (const required of definition.requiredColumns) {
      if (!columnNames.some(c => c.includes(required))) {
        requiredMet = false;
        break;
      }
    }
    if (requiredMet) {
      typeScores[type].score += 5;
    }

    typeScores[type].confidence = typeScores[type].score / (columnNames.length + 5);
  }

  const sorted = Object.entries(typeScores)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3);

  const topMatch = sorted[0];
  const definition = DATASET_TYPE_DEFINITIONS[topMatch[0]];

  return {
    primaryType: topMatch[0],
    definition,
    confidence: topMatch[1].confidence,
    alternativeTypes: sorted.slice(1).map(([type, scores]) => ({
      type,
      confidence: scores.confidence,
    })),
    matchedPatterns: topMatch[1].matchedPatterns,
  };
}

/**
 * Generate comprehensive analysis plan for dataset
 */
export function generateAnalysisPlan(dataset, detectionResult) {
  const { primaryType, definition } = detectionResult;

  return {
    datasetName: dataset.name,
    detectedType: primaryType,
    typeDefinition: definition,
    suggestedAnalyses: definition.analysisTypes,
    suggestedMetrics: definition.keyMetrics,
    suggestedVisualizations: definition.visualizations,
    analysisQuestions: generateAnalysisQuestions(primaryType, dataset.columns),
    dimensionsForAnalysis: identifyDimensions(dataset.columns),
    measuresForAnalysis: identifyMeasures(dataset.columns),
  };
}

/**
 * Generate specific analysis questions based on dataset type
 */
function generateAnalysisQuestions(type, columns) {
  const questions = {
    sales: [
      'What are the top performing products by revenue?',
      'How does sales performance vary by region?',
      'What is the trend in sales over time?',
      'Which customers contribute the most revenue?',
      'What is the average order value?',
    ],
    customer: [
      'What are the main customer segments?',
      'Who are the high-value customers?',
      'What is the customer churn rate?',
      'Which acquisition channels are most effective?',
    ],
    product: [
      'Which products have the highest profit margin?',
      'What are the slow-moving products?',
      'How does product category perform?',
    ],
    marketing: [
      'Which campaigns have the best ROI?',
      'What is the cost per acquisition by channel?',
      'How does conversion rate vary by audience?',
    ],
    hr: [
      'What is the employee turnover rate?',
      'How does compensation vary by role?',
      'Which departments have high performers?',
    ],
    financial: [
      'What are the major cost drivers?',
      'How does actual spending compare to budget?',
      'What is the profit margin by department?',
    ],
    web_analytics: [
      'What is the bounce rate by page?',
      'How does traffic source impact conversion?',
      'What is the user journey to conversion?',
    ],
    education: [
      'Which students are at risk?',
      'What is the subject performance trend?',
      'How does attendance impact grades?',
    ],
    healthcare: [
      'What is the average length of stay?',
      'What is the readmission rate?',
      'How does treatment cost vary by diagnosis?',
    ],
    retail: [
      'Which stores are performing best?',
      'What is the inventory turnover rate?',
      'What is the customer basket size?',
    ],
    default: [
      'What are the key trends in the data?',
      'How do different segments perform?',
      'What correlations exist?',
    ],
  };

  return questions[type] || questions.default;
}

/**
 * Identify dimension columns (text/categorical)
 */
function identifyDimensions(columns) {
  return columns
    .filter(c => c.type === 'text' || c.type === 'string' || c.type === 'date')
    .map(c => c.name);
}

/**
 * Identify measure columns (numeric)
 */
function identifyMeasures(columns) {
  return columns
    .filter(c => c.type === 'numeric' || c.type === 'number')
    .map(c => c.name);
}

/**
 * Generate KPI recommendations specific to dataset type
 */
export function generateTypeSpecificKPIs(type, rows, columns) {
  const definition = DATASET_TYPE_DEFINITIONS[type];
  if (!definition) return [];

  const kpis = [];

  for (const metric of definition.keyMetrics) {
    const kpi = calculateMetricValue(metric, rows, columns);
    if (kpi) {
      kpis.push(kpi);
    }
  }

  return kpis;
}

/**
 * Calculate specific metric value
 */
function calculateMetricValue(metric, rows, columns) {
  if (!rows || rows.length === 0) return null;

  const metricMap = {
    'total_revenue': () => {
      const col = findColumnByPattern(columns, ['revenue', 'amount', 'total']);
      if (!col) return null;
      return {
        name: 'Total Revenue',
        value: rows.reduce((sum, row) => sum + (parseFloat(row[col]) || 0), 0),
        format: 'currency',
      };
    },
    'total_sales': () => {
      const col = findColumnByPattern(columns, ['sales', 'revenue', 'amount']);
      if (!col) return null;
      return {
        name: 'Total Sales',
        value: rows.reduce((sum, row) => sum + (parseFloat(row[col]) || 0), 0),
        format: 'currency',
      };
    },
    'average_order_value': () => {
      const col = findColumnByPattern(columns, ['amount', 'revenue', 'price']);
      if (!col) return null;
      const avg = rows.reduce((sum, row) => sum + (parseFloat(row[col]) || 0), 0) / rows.length;
      return {
        name: 'Average Order Value',
        value: avg.toFixed(2),
        format: 'currency',
      };
    },
    'total_customers': () => ({
      name: 'Total Customers',
      value: new Set(rows.map(r => r.customer_id)).size,
      format: 'number',
    }),
    'total_orders': () => ({
      name: 'Total Orders',
      value: rows.length,
      format: 'number',
    }),
    'total_products': () => ({
      name: 'Total Products',
      value: new Set(rows.map(r => r.product_id)).size,
      format: 'number',
    }),
  };

  const calculator = metricMap[metric];
  return calculator ? calculator() : null;
}

/**
 * Find column by pattern matching
 */
function findColumnByPattern(columns, patterns) {
  for (const pattern of patterns) {
    const col = columns.find(c => c.name.toLowerCase().includes(pattern));
    if (col) return col.name;
  }
  return null;
}

/**
 * Get analysis recommendations
 */
export function getAnalysisRecommendations(type) {
  const recommendations = {
    sales: {
      priority: 'HIGH',
      analyses: ['Trend analysis', 'Regional comparison', 'Product performance'],
      alerts: ['Low sales days', 'High return rates'],
    },
    customer: {
      priority: 'HIGH',
      analyses: ['Segmentation', 'Churn prediction', 'Lifetime value'],
      alerts: ['High churn risk', 'Inactive customers'],
    },
    product: {
      priority: 'MEDIUM',
      analyses: ['Performance ranking', 'Inventory optimization'],
      alerts: ['Low inventory', 'Slow movers'],
    },
    marketing: {
      priority: 'HIGH',
      analyses: ['Campaign ROI', 'Channel attribution'],
      alerts: ['Poor performing campaigns', 'High CAC'],
    },
    hr: {
      priority: 'MEDIUM',
      analyses: ['Turnover analysis', 'Compensation review'],
      alerts: ['High turnover', 'Low engagement'],
    },
    financial: {
      priority: 'HIGH',
      analyses: ['Budget variance', 'Cost analysis'],
      alerts: ['Over budget', 'Cash flow issues'],
    },
    web_analytics: {
      priority: 'MEDIUM',
      analyses: ['Conversion funnel', 'User flow'],
      alerts: ['High bounce rate', 'Broken pages'],
    },
    education: {
      priority: 'MEDIUM',
      analyses: ['Student performance', 'At-risk identification'],
      alerts: ['Low grades', 'High absenteeism'],
    },
    healthcare: {
      priority: 'HIGH',
      analyses: ['Patient outcomes', 'Readmission risk'],
      alerts: ['High readmission', 'Cost overrun'],
    },
    retail: {
      priority: 'HIGH',
      analyses: ['Store performance', 'Product mix'],
      alerts: ['Low sales', 'High shrinkage'],
    },
  };

  return recommendations[type] || { priority: 'MEDIUM', analyses: [], alerts: [] };
}

/**
 * Export all type definitions
 */
export function getAllDatasetTypeDefinitions() {
  return DATASET_TYPE_DEFINITIONS;
}