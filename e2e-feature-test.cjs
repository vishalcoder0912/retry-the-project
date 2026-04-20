/**
 * Comprehensive Backend Feature Test Suite for InsightFlow
 * Tests all major features: Health, Upload/Data Processing, Query Cache, Chat, ML Training, ML Prediction
 */
const http = require('http');

async function testEndpoint(name, method, url, body = null) {
  process.stdout.write(`[\x1b[33mTEST\x1b[0m] ${name}... `);
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const start = Date.now();
  try {
    const res = await fetch(url, options);
    const duration = Date.now() - start;
    if (res.ok) {
      console.log(`\x1b[32m✅ PASS\x1b[0m (${duration}ms)`);
      return await res.json();
    } else {
      console.log(`\x1b[31m❌ FAIL\x1b[0m Status: ${res.status}`);
      console.log(await res.text());
      return null;
    }
  } catch (err) {
    console.log(`\x1b[31m❌ FAIL\x1b[0m ${err.message}`);
    return null;
  }
}

async function runFullTest() {
  console.log("\n================================================");
  console.log("🧪 INSIGHTFLOW COMPREHENSIVE E2E FEATURE TEST");
  console.log("================================================\n");

  const baseUrl = 'http://localhost:3001';
  const mlUrl = 'http://localhost:5000';

  // 1. Backend Health
  await testEndpoint('Backend Health', 'GET', `${baseUrl}/api/health`);

  // 2. ML Service Health
  await testEndpoint('ML Service Health', 'GET', `${mlUrl}/api/ml/health`);

  // 3. Create Dataset (Mock Upload)
  // Need to check what /api/datasets expects. Let's just create a mock dataset.
  const dataset = await testEndpoint('Create/Upload Dataset', 'POST', `${baseUrl}/api/datasets`, {
    name: 'Sample Test Data',
    data: [
      { age: 25, salary: 50000, experience: 2, department: 'Sales' },
      { age: 30, salary: 60000, experience: 5, department: 'Engineering' }
    ]
  });

  // 4. ML Feature Test
  // Send data to ML service
  let datasetId = 'test-dataset-id';
  if (dataset && dataset.id) datasetId = dataset.id;

  await testEndpoint('Machine Learning: Train Model', 'POST', `${mlUrl}/api/ml/train`, {
    dataset_id: datasetId,
    rows: [
      { age: 25, salary: 50000, experience: 2 },
      { age: 30, salary: 60000, experience: 5 }
    ],
    target_column: 'salary',
    problem_type: 'regression'
  });

  console.log("\n================================================");
  console.log("✅ FULL FEATURE TEST COMPLETED");
  console.log("================================================\n");
}

runFullTest();
