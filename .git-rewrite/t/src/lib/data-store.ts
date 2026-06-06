export interface DataColumn {
  name: string;
  type: 'string' | 'number' | 'date';
  sample: string[];
}

export interface Dataset {
  id: string;
  name: string;
  columns: DataColumn[];
  rows: Record<string, any>[];
  uploadedAt: Date;
  rowCount: number;
}

export interface KPI {
  label: string;
  value: string;
  change?: number;
  icon: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  xKey: string;
  yKey: string;
  data: Record<string, any>[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  chart?: ChartConfig;
  insights?: string[];
  timestamp: Date;
}

// Demo data
export const generateDemoData = (): Dataset => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const categories = ['Electronics', 'Clothing', 'Food', 'Software', 'Services'];
  const regions = ['North', 'South', 'East', 'West'];

  const rows: Record<string, any>[] = [];
  for (let i = 0; i < 200; i++) {
    rows.push({
      month: months[Math.floor(Math.random() * 12)],
      category: categories[Math.floor(Math.random() * 5)],
      region: regions[Math.floor(Math.random() * 4)],
      revenue: Math.floor(Math.random() * 50000) + 5000,
      units_sold: Math.floor(Math.random() * 500) + 10,
      profit_margin: (Math.random() * 0.4 + 0.1).toFixed(2),
      customer_rating: (Math.random() * 2 + 3).toFixed(1),
    });
  }

  return {
    id: 'demo-1',
    name: 'Sales Analytics 2024',
    columns: [
      { name: 'month', type: 'string', sample: months.slice(0, 3) },
      { name: 'category', type: 'string', sample: categories.slice(0, 3) },
      { name: 'region', type: 'string', sample: regions.slice(0, 3) },
      { name: 'revenue', type: 'number', sample: ['25000', '18000', '32000'] },
      { name: 'units_sold', type: 'number', sample: ['150', '230', '89'] },
      { name: 'profit_margin', type: 'number', sample: ['0.25', '0.18', '0.32'] },
      { name: 'customer_rating', type: 'number', sample: ['4.2', '3.8', '4.7'] },
    ],
    rows,
    uploadedAt: new Date(),
    rowCount: rows.length,
  };
};

export const generateDemoKPIs = (data: Dataset): KPI[] => {
  const totalRevenue = data.rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalUnits = data.rows.reduce((sum, r) => sum + r.units_sold, 0);
  const avgMargin = data.rows.reduce((sum, r) => sum + parseFloat(r.profit_margin), 0) / data.rows.length;
  const avgRating = data.rows.reduce((sum, r) => sum + parseFloat(r.customer_rating), 0) / data.rows.length;

  return [
    { label: 'Total Revenue', value: `$${(totalRevenue / 1000).toFixed(0)}K`, change: 12.5, icon: 'dollar' },
    { label: 'Units Sold', value: totalUnits.toLocaleString(), change: 8.3, icon: 'package' },
    { label: 'Avg Margin', value: `${(avgMargin * 100).toFixed(1)}%`, change: -2.1, icon: 'percent' },
    { label: 'Avg Rating', value: avgRating.toFixed(1), change: 3.7, icon: 'star' },
  ];
};

export const generateDemoCharts = (data: Dataset): ChartConfig[] => {
  // Revenue by month
  const monthlyRevenue: Record<string, number> = {};
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  months.forEach(m => monthlyRevenue[m] = 0);
  data.rows.forEach(r => { monthlyRevenue[r.month] += r.revenue; });

  const monthlyData = months.map(m => ({ month: m, revenue: monthlyRevenue[m] }));

  // Revenue by category
  const categoryRevenue: Record<string, number> = {};
  data.rows.forEach(r => {
    categoryRevenue[r.category] = (categoryRevenue[r.category] || 0) + r.revenue;
  });
  const categoryData = Object.entries(categoryRevenue).map(([category, revenue]) => ({ category, revenue }));

  // Units by region
  const regionUnits: Record<string, number> = {};
  data.rows.forEach(r => {
    regionUnits[r.region] = (regionUnits[r.region] || 0) + r.units_sold;
  });
  const regionData = Object.entries(regionUnits).map(([region, units]) => ({ region, units }));

  // Margin trend
  const marginByMonth: Record<string, { sum: number; count: number }> = {};
  months.forEach(m => marginByMonth[m] = { sum: 0, count: 0 });
  data.rows.forEach(r => {
    marginByMonth[r.month].sum += parseFloat(r.profit_margin);
    marginByMonth[r.month].count += 1;
  });
  const marginData = months.map(m => ({
    month: m,
    margin: marginByMonth[m].count > 0 ? +(marginByMonth[m].sum / marginByMonth[m].count * 100).toFixed(1) : 0,
  }));

  return [
    { type: 'area', title: 'Revenue Trend', xKey: 'month', yKey: 'revenue', data: monthlyData },
    { type: 'bar', title: 'Revenue by Category', xKey: 'category', yKey: 'revenue', data: categoryData },
    { type: 'bar', title: 'Units Sold by Region', xKey: 'region', yKey: 'units', data: regionData },
    { type: 'line', title: 'Profit Margin Trend', xKey: 'month', yKey: 'margin', data: marginData },
  ];
};
