import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { pipelineService } from './pipeline-service.js';

export class ReportGenerator {
  constructor() {
    this.scheduledReports = new Map();
  }

  async generatePDFReport(dataset, options = {}) {
    const {
      title = 'Data Analytics Report',
      includeCharts = true,
      includeStats = true,
      includeInsights = true
    } = options;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(25).text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
      doc.moveDown(2);

      if (includeStats) {
        doc.fontSize(16).text('Summary Statistics');
        doc.moveDown();
        this.addStatsSection(doc, dataset);
        doc.moveDown(2);
      }

      if (includeInsights && dataset.insights?.length > 0) {
        doc.fontSize(16).text('Key Insights');
        doc.moveDown();
        dataset.insights.slice(0, 10).forEach((insight, i) => {
          doc.fontSize(11).text(`${i + 1}. ${insight.message || JSON.stringify(insight)}`);
          doc.moveDown(0.5);
        });
      }

      if (includeCharts && dataset.charts?.length > 0) {
        doc.fontSize(16).text('Visualizations');
        doc.moveDown();
        dataset.charts.slice(0, 5).forEach(chart => {
          doc.fontSize(12).text(`- ${chart.title}`);
          doc.moveDown(0.5);
        });
      }

      doc.end();
    });
  }

  addStatsSection(doc, dataset) {
    const stats = dataset.columnStats || {};
    Object.entries(stats).forEach(([col, stat]) => {
      if (stat.type === 'numeric') {
        doc.fontSize(10).text(
          `${col}: min=${stat.min}, max=${stat.max}, avg=${stat.mean?.toFixed(2)}`
        );
      } else {
        doc.fontSize(10).text(`${col}: ${stat.unique} unique values`);
      }
      doc.moveDown(0.3);
    });
  }

  async generateExcelReport(dataset, options = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'InsightFlow';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric' },
      { header: 'Value', key: 'value' }
    ];
    summarySheet.addRow({ metric: 'Dataset Name', value: dataset.name });
    summarySheet.addRow({ metric: 'Row Count', value: dataset.rowCount });
    summarySheet.addRow({ metric: 'Column Count', value: dataset.columns?.length });

    const dataSheet = workbook.addWorksheet('Data');
    if (dataset.rows?.length > 0) {
      const headers = Object.keys(dataset.rows[0]);
      dataSheet.columns = headers.map(h => ({ header: h, key: h }));
      dataset.rows.slice(0, 10000).forEach(row => {
        dataSheet.addRow(row);
      });
    }

    if (dataset.charts?.length > 0) {
      const chartsSheet = workbook.addWorksheet('Charts');
      chartsSheet.columns = [
        { header: 'Type', key: 'type' },
        { header: 'Title', key: 'title' },
        { header: 'X Key', key: 'xKey' },
        { header: 'Y Key', key: 'yKey' }
      ];
      dataset.charts.forEach(chart => {
        chartsSheet.addRow({
          type: chart.type,
          title: chart.title,
          xKey: chart.xKey,
          yKey: chart.yKey
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateHTMLReport(dataset, options = {}) {
    const { title = 'Data Analytics Report' } = options;
    
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat-card { background: #f9fafb; padding: 15px; border-radius: 8px; }
    .stat-label { color: #6b7280; font-size: 12px; }
    .stat-value { color: #1a1a2e; font-size: 24px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; }
    .insight { padding: 10px; margin: 5px 0; background: #eff6ff; border-left: 3px solid #4f46e5; }
    .chart-preview { margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  
  <h2>Overview</h2>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-label">Rows</div>
      <div class="stat-value">${dataset.rowCount?.toLocaleString() || 'N/A'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Columns</div>
      <div class="stat-value">${dataset.columns?.length || 'N/A'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Data Type</div>
      <div class="stat-value">${dataset.schema?.dataTypeLabel || 'Generic'}</div>
    </div>
  </div>`;

    if (dataset.insights?.length > 0) {
      html += `
  <h2>Key Insights</h2>
  ${dataset.insights.slice(0, 10).map(i => 
    `<div class="insight">${i.message || JSON.stringify(i)}</div>`
  ).join('')}`;
    }

    if (dataset.charts?.length > 0) {
      html += `
  <h2>Visualizations</h2>
  ${dataset.charts.slice(0, 7).map(c => 
    `<div class="chart-preview"><strong>${c.title}</strong> (${c.type})</div>`
  ).join('')}`;
    }

    html += `
</body>
</html>`;

    return Buffer.from(html);
  }

  async scheduleReport(config) {
    const { id, cronExpression, datasetId, format, recipients } = config;
    
    this.scheduledReports.set(id, {
      ...config,
      enabled: true,
      lastRun: null,
      nextRun: this.calculateNextRun(cronExpression)
    });

    return { success: true, id, nextRun: this.calculateNextRun(cronExpression) };
  }

  calculateNextRun(cronExpression) {
    return new Date(Date.now() + 60000);
  }

  async runScheduledReports() {
    const results = [];
    const now = new Date();

    for (const [id, report] of this.scheduledReports) {
      if (!report.enabled) continue;
      if (report.nextRun <= now) {
        try {
          const dataset = await pipelineService.getDataset(report.datasetId);
          if (dataset) {
            const buffer = await this.generateReport(dataset, { format: report.format });
            results.push({ id, status: 'generated', size: buffer.length });
          }
        } catch (error) {
          results.push({ id, status: 'error', error: error.message });
        }
        
        report.lastRun = now;
        report.nextRun = this.calculateNextRun(report.cronExpression);
      }
    }

    return results;
  }

  async generateReport(dataset, options = {}) {
    const { format = 'html' } = options;
    
    switch (format) {
      case 'pdf':
        return this.generatePDFReport(dataset, options);
      case 'excel':
        return this.generateExcelReport(dataset, options);
      case 'html':
      default:
        return this.generateHTMLReport(dataset, options);
    }
  }
}

export const reportGenerator = new ReportGenerator();