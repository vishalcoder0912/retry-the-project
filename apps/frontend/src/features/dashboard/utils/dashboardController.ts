export interface DashboardCommand {
  action: 'SHOW_ALL' | 'SHOW_CHART' | 'FILTER' | 'GENERATE_CHART' | 'MODIFY_CHART' | 'ANSWER';
  charts?: string[];
  filter?: Record<string, string>;
  chart?: string | {
    type: string;
    x: string;
    y: string;
    aggregation?: string;
  };
  changes?: Record<string, unknown>;
  message?: string;
}

export function processQuery(query: string, datasetColumns: string[]): DashboardCommand {
  const q = query.toLowerCase();
  const cols = datasetColumns.map(c => c.toLowerCase());
  
  if (q.includes('show all') || q.includes('all chart') || q.includes('everything') || q.includes('full dashboard')) {
    return { action: 'SHOW_ALL' };
  }
  
  if (q.includes('salary') && q.includes('country')) {
    return { action: 'SHOW_CHART', charts: ['salary_by_country'] };
  }
  if (q.includes('experience') && q.includes('country')) {
    return { action: 'SHOW_CHART', charts: ['experience_by_country'] };
  }
  if (q.includes('language') || q.includes('popular')) {
    return { action: 'SHOW_CHART', charts: ['language_frequency'] };
  }
  if (q.includes('education')) {
    return { action: 'SHOW_CHART', charts: ['education_distribution', 'salary_by_education'] };
  }
  if (q.includes('salary') && q.includes('experience') || q.includes('vs')) {
    return { action: 'SHOW_CHART', charts: ['salary_vs_experience'] };
  }
  
  const filterMatch = q.match(/(?:filter|show|only)\s+(?:by|from|in)\s+(\w+)/);
  if (filterMatch && filterMatch[1]) {
    const filterCol = cols.find(c => c.includes(filterMatch[1]));
    if (filterCol) {
      const filter: Record<string, string> = {};
      filter[filterMatch[1]] = 'value';
      return { action: 'FILTER', filter };
    }
  }
  
  if (q.includes('bar')) {
    return { action: 'GENERATE_CHART', chart: { type: 'bar', x: cols[0], y: cols.find(c => c.includes('salary') || c.includes('revenue')) || cols[1], aggregation: 'avg' } };
  }
  if (q.includes('line') || q.includes('trend')) {
    return { action: 'GENERATE_CHART', chart: { type: 'line', x: cols[0], y: cols.find(c => c.includes('salary') || c.includes('revenue')) || cols[1], aggregation: 'avg' } };
  }
  if (q.includes('pie') || q.includes('distribution')) {
    return { action: 'GENERATE_CHART', chart: { type: 'pie', x: cols.find(c => c.includes('country') || c.includes('category')) || cols[0], y: cols.find(c => c.includes('salary') || c.includes('revenue')) || cols[1], aggregation: 'sum' } };
  }
  if (q.includes('scatter') || q.includes('correlation')) {
    return { action: 'GENERATE_CHART', chart: { type: 'scatter', x: cols.find(c => c.includes('experience')) || cols[0], y: cols.find(c => c.includes('salary')) || cols[1] } };
  }
  
  if (q.includes('change') || q.includes('modify') || q.includes('convert') || q.includes('make it')) {
    const chartMatch = q.match(/(?:chart|graph)\s+(\w+)/);
    if (chartMatch) {
      const newType = q.includes('line') ? 'line' : q.includes('pie') ? 'pie' : q.includes('bar') ? 'bar' : q.includes('scatter') ? 'scatter' : 'area';
      return { action: 'MODIFY_CHART', chart: chartMatch[1], changes: { type: newType } };
    }
  }
  
  if (q.includes('what') || q.includes('how') || q.includes('explain') || q.includes('describe') || q.includes('tell me')) {
    let msg = 'Here are some things I can do:\n';
    msg += '• "Show all charts" - Display entire dashboard\n';
    msg += '• "Show salary by country" - Display specific chart\n';
    msg += '• "Create a bar chart for salary" - Generate new chart\n';
    msg += '• "Filter by country USA" - Apply filters\n';
    msg += '• "Change to line chart" - Modify existing chart\n';
    return { action: 'ANSWER', message: msg };
  }
  
  return { action: 'ANSWER', message: `I understood "${query}" but couldn't map it to a dashboard action. Try: "show all charts", "create bar chart", "filter by country", etc.` };
}