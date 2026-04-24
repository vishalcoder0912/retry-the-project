/**
 * Comprehensive Training Datasets Service
 * Provides realistic datasets covering 20+ analytics scenarios
 * Used by experienced data analysts
 */

/**
 * SALES ANALYTICS DATASET
 * Real-world e-commerce sales data
 */
export function generateSalesDataset() {
  const startDate = new Date('2024-01-01');
  const rows = [];
  const products = ['Laptop', 'Desktop', 'Monitor', 'Keyboard', 'Mouse', 'Headphones', 'Webcam', 'USB Hub'];
  const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
  const salesPersons = ['John Smith', 'Sarah Johnson', 'Mike Brown', 'Emily Davis', 'Robert Wilson'];

  for (let i = 1; i <= 500; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + Math.floor(Math.random() * 90));
    
    rows.push({
      order_id: `ORD-${String(i).padStart(6, '0')}`,
      date: date.toISOString().split('T')[0],
      product_name: products[Math.floor(Math.random() * products.length)],
      quantity: Math.floor(Math.random() * 10) + 1,
      unit_price: Math.floor(Math.random() * 2000) + 100,
      discount_percent: [0, 5, 10, 15, 20][Math.floor(Math.random() * 5)],
      customer_id: `CUST-${String(Math.floor(Math.random() * 150) + 1).padStart(4, '0')}`,
      salesperson: salesPersons[Math.floor(Math.random() * salesPersons.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      payment_method: ['Credit Card', 'Debit Card', 'PayPal', 'Bank Transfer'][Math.floor(Math.random() * 4)],
      delivery_days: Math.floor(Math.random() * 10) + 1,
      return_status: ['No Return', 'Returned', 'Partial Return'][Math.floor(Math.random() * 3)],
    });
  }

  return {
    name: 'Sales_Analysis_Q1_2024',
    fileName: 'sales_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'order_id', type: 'text' },
      { name: 'date', type: 'date' },
      { name: 'product_name', type: 'text' },
      { name: 'quantity', type: 'numeric' },
      { name: 'unit_price', type: 'numeric' },
      { name: 'discount_percent', type: 'numeric' },
      { name: 'customer_id', type: 'text' },
      { name: 'salesperson', type: 'text' },
      { name: 'region', type: 'text' },
      { name: 'payment_method', type: 'text' },
      { name: 'delivery_days', type: 'numeric' },
      { name: 'return_status', type: 'text' },
    ],
    rows,
  };
}

/**
 * CUSTOMER ANALYTICS DATASET
 * Customer demographics and behavior
 */
export function generateCustomerDataset() {
  const rows = [];
  const segments = ['Premium', 'Standard', 'Basic', 'VIP'];
  const channels = ['Organic', 'Paid Search', 'Social Media', 'Referral', 'Direct', 'Email'];
  const countries = ['USA', 'UK', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'India'];

  for (let i = 1; i <= 300; i++) {
    const joinDate = new Date('2023-01-01');
    joinDate.setDate(joinDate.getDate() + Math.floor(Math.random() * 365));

    rows.push({
      customer_id: `CUST-${String(i).padStart(4, '0')}`,
      customer_name: `Customer_${i}`,
      email: `customer${i}@email.com`,
      phone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
      country: countries[Math.floor(Math.random() * countries.length)],
      segment: segments[Math.floor(Math.random() * segments.length)],
      lifetime_value: Math.floor(Math.random() * 50000) + 500,
      total_purchases: Math.floor(Math.random() * 100) + 1,
      acquisition_channel: channels[Math.floor(Math.random() * channels.length)],
      join_date: joinDate.toISOString().split('T')[0],
      last_purchase_date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      email_opt_in: Math.random() > 0.3 ? 'Yes' : 'No',
      loyalty_member: Math.random() > 0.4 ? 'Yes' : 'No',
      churn_risk: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
    });
  }

  return {
    name: 'Customer_Analytics_2024',
    fileName: 'customer_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'customer_id', type: 'text' },
      { name: 'customer_name', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'phone', type: 'text' },
      { name: 'country', type: 'text' },
      { name: 'segment', type: 'text' },
      { name: 'lifetime_value', type: 'numeric' },
      { name: 'total_purchases', type: 'numeric' },
      { name: 'acquisition_channel', type: 'text' },
      { name: 'join_date', type: 'date' },
      { name: 'last_purchase_date', type: 'date' },
      { name: 'email_opt_in', type: 'text' },
      { name: 'loyalty_member', type: 'text' },
      { name: 'churn_risk', type: 'text' },
    ],
    rows,
  };
}

/**
 * PRODUCT ANALYTICS DATASET
 * Product inventory and performance
 */
export function generateProductDataset() {
  const rows = [];
  const categories = ['Electronics', 'Accessories', 'Furniture', 'Software', 'Services'];
  const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE'];
  const statuses = ['Active', 'Discontinued', 'Pre-order', 'Low Stock'];

  for (let i = 1; i <= 200; i++) {
    rows.push({
      product_id: `SKU-${String(i).padStart(5, '0')}`,
      product_name: `Product_${i}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      brand: brands[Math.floor(Math.random() * brands.length)],
      unit_price: Math.floor(Math.random() * 5000) + 50,
      cost: Math.floor(Math.random() * 2500) + 25,
      quantity_in_stock: Math.floor(Math.random() * 500) + 10,
      reorder_level: Math.floor(Math.random() * 100) + 10,
      units_sold_mtd: Math.floor(Math.random() * 300),
      warehouse_location: `Warehouse_${Math.floor(Math.random() * 5) + 1}`,
      supplier_id: `SUP-${Math.floor(Math.random() * 30) + 1}`,
      last_restocked: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      product_status: statuses[Math.floor(Math.random() * statuses.length)],
      profit_margin_percent: Math.floor(Math.random() * 80) + 10,
    });
  }

  return {
    name: 'Product_Inventory_Analytics',
    fileName: 'product_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'product_id', type: 'text' },
      { name: 'product_name', type: 'text' },
      { name: 'category', type: 'text' },
      { name: 'brand', type: 'text' },
      { name: 'unit_price', type: 'numeric' },
      { name: 'cost', type: 'numeric' },
      { name: 'quantity_in_stock', type: 'numeric' },
      { name: 'reorder_level', type: 'numeric' },
      { name: 'units_sold_mtd', type: 'numeric' },
      { name: 'warehouse_location', type: 'text' },
      { name: 'supplier_id', type: 'text' },
      { name: 'last_restocked', type: 'date' },
      { name: 'product_status', type: 'text' },
      { name: 'profit_margin_percent', type: 'numeric' },
    ],
    rows,
  };
}

/**
 * INVENTORY MANAGEMENT DATASET
 * Warehouse and inventory tracking
 */
export function generateInventoryDataset() {
  const rows = [];
  const warehouses = ['Warehouse_NYC', 'Warehouse_LA', 'Warehouse_Chicago', 'Warehouse_Houston', 'Warehouse_Phoenix'];
  const locations = ['Zone_A', 'Zone_B', 'Zone_C', 'Zone_D', 'Zone_E'];

  for (let i = 1; i <= 250; i++) {
    rows.push({
      inventory_id: `INV-${String(i).padStart(6, '0')}`,
      sku: `SKU-${String(Math.floor(Math.random() * 200) + 1).padStart(5, '0')}`,
      warehouse: warehouses[Math.floor(Math.random() * warehouses.length)],
      zone: locations[Math.floor(Math.random() * locations.length)],
      bin_number: `BIN-${Math.floor(Math.random() * 1000) + 1}`,
      quantity_on_hand: Math.floor(Math.random() * 500) + 10,
      quantity_reserved: Math.floor(Math.random() * 200),
      quantity_available: Math.floor(Math.random() * 300),
      reorder_point: Math.floor(Math.random() * 100) + 20,
      lead_time_days: Math.floor(Math.random() * 30) + 5,
      last_count_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      inventory_turnover: (Math.random() * 20).toFixed(2),
      holding_cost: Math.floor(Math.random() * 5000) + 100,
      received_date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }

  return {
    name: 'Inventory_Management_Analysis',
    fileName: 'inventory_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'inventory_id', type: 'text' },
      { name: 'sku', type: 'text' },
      { name: 'warehouse', type: 'text' },
      { name: 'zone', type: 'text' },
      { name: 'bin_number', type: 'text' },
      { name: 'quantity_on_hand', type: 'numeric' },
      { name: 'quantity_reserved', type: 'numeric' },
      { name: 'quantity_available', type: 'numeric' },
      { name: 'reorder_point', type: 'numeric' },
      { name: 'lead_time_days', type: 'numeric' },
      { name: 'last_count_date', type: 'date' },
      { name: 'inventory_turnover', type: 'numeric' },
      { name: 'holding_cost', type: 'numeric' },
      { name: 'received_date', type: 'date' },
    ],
    rows,
  };
}

/**
 * MARKETING ANALYTICS DATASET
 * Digital marketing campaigns and performance
 */
export function generateMarketingDataset() {
  const rows = [];
  const campaigns = ['Spring_Sale_2024', 'Summer_Campaign', 'Flash_Deal', 'Email_Blast', 'Influencer_Collab', 'Black_Friday_Prep'];
  const channels = ['Google Ads', 'Facebook', 'Instagram', 'LinkedIn', 'Email', 'Organic'];
  const audiences = ['All Users', 'Segment_A', 'Segment_B', 'Retargeting', 'Lookalike'];

  for (let i = 1; i <= 180; i++) {
    const date = new Date('2024-01-01');
    date.setDate(date.getDate() + Math.floor(Math.random() * 90));

    rows.push({
      campaign_id: `CAMP-${String(i).padStart(5, '0')}`,
      campaign_name: campaigns[Math.floor(Math.random() * campaigns.length)],
      date: date.toISOString().split('T')[0],
      channel: channels[Math.floor(Math.random() * channels.length)],
      audience_segment: audiences[Math.floor(Math.random() * audiences.length)],
      budget: Math.floor(Math.random() * 50000) + 500,
      impressions: Math.floor(Math.random() * 500000) + 10000,
      clicks: Math.floor(Math.random() * 5000) + 100,
      conversions: Math.floor(Math.random() * 500) + 10,
      revenue: Math.floor(Math.random() * 100000) + 1000,
      cost_per_click: (Math.random() * 5 + 0.5).toFixed(2),
      conversion_rate_percent: (Math.random() * 10 + 1).toFixed(2),
      roi_percent: (Math.random() * 300 - 50).toFixed(2),
    });
  }

  return {
    name: 'Marketing_Analytics_Dashboard',
    fileName: 'marketing_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'campaign_id', type: 'text' },
      { name: 'campaign_name', type: 'text' },
      { name: 'date', type: 'date' },
      { name: 'channel', type: 'text' },
      { name: 'audience_segment', type: 'text' },
      { name: 'budget', type: 'numeric' },
      { name: 'impressions', type: 'numeric' },
      { name: 'clicks', type: 'numeric' },
      { name: 'conversions', type: 'numeric' },
      { name: 'revenue', type: 'numeric' },
      { name: 'cost_per_click', type: 'numeric' },
      { name: 'conversion_rate_percent', type: 'numeric' },
      { name: 'roi_percent', type: 'numeric' },
    ],
    rows,
  };
}

/**
 * HR ANALYTICS DATASET
 * Human Resources and employee data
 */
export function generateHRDataset() {
  const rows = [];
  const departments = ['Engineering', 'Sales', 'Marketing', 'Finance', 'Operations', 'HR', 'Legal'];
  const roles = ['Manager', 'Senior', 'Junior', 'Intern', 'Lead', 'Specialist'];
  const locations = ['HQ', 'Branch_1', 'Branch_2', 'Branch_3', 'Remote'];
  const statuses = ['Active', 'On Leave', 'Inactive', 'Retired'];

  for (let i = 1; i <= 350; i++) {
    const hireDate = new Date('2020-01-01');
    hireDate.setDate(hireDate.getDate() + Math.floor(Math.random() * 1460));

    rows.push({
      employee_id: `EMP-${String(i).padStart(5, '0')}`,
      employee_name: `Employee_${i}`,
      department: departments[Math.floor(Math.random() * departments.length)],
      role: roles[Math.floor(Math.random() * roles.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      hire_date: hireDate.toISOString().split('T')[0],
      salary: Math.floor(Math.random() * 200000) + 40000,
      bonus_percent: Math.floor(Math.random() * 30) + 5,
      manager_id: `EMP-${String(Math.floor(Math.random() * 350) + 1).padStart(5, '0')}`,
      performance_rating: (Math.random() * 4 + 1).toFixed(1),
      attendance_percent: Math.floor(Math.random() * 20) + 80,
      training_hours_ytd: Math.floor(Math.random() * 100) + 10,
      employment_status: statuses[Math.floor(Math.random() * statuses.length)],
      engagement_score: Math.floor(Math.random() * 100) + 1,
    });
  }

  return {
    name: 'HR_Analytics_Report',
    fileName: 'hr_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'employee_id', type: 'text' },
      { name: 'employee_name', type: 'text' },
      { name: 'department', type: 'text' },
      { name: 'role', type: 'text' },
      { name: 'location', type: 'text' },
      { name: 'hire_date', type: 'date' },
      { name: 'salary', type: 'numeric' },
      { name: 'bonus_percent', type: 'numeric' },
      { name: 'manager_id', type: 'text' },
      { name: 'performance_rating', type: 'numeric' },
      { name: 'attendance_percent', type: 'numeric' },
      { name: 'training_hours_ytd', type: 'numeric' },
      { name: 'employment_status', type: 'text' },
      { name: 'engagement_score', type: 'numeric' },
    ],
    rows,
  };
}

/**
 * FINANCIAL ANALYTICS DATASET
 * Income statement and revenue data
 */
export function generateFinancialDataset() {
  const rows = [];
  const departments = ['Sales', 'Marketing', 'Engineering', 'Operations', 'Finance'];
  const costTypes = ['Salary', 'Software', 'Hardware', 'Utilities', 'Marketing', 'Travel', 'Consulting'];

  for (let i = 1; i <= 240; i++) {
    const date = new Date('2024-01-01');
    date.setDate(date.getDate() + Math.floor(Math.random() * 90));

    rows.push({
      transaction_id: `TXN-${String(i).padStart(6, '0')}`,
      date: date.toISOString().split('T')[0],
      department: departments[Math.floor(Math.random() * departments.length)],
      cost_type: costTypes[Math.floor(Math.random() * costTypes.length)],
      amount: Math.floor(Math.random() * 50000) + 500,
      budget_category: ['Operational', 'Capital', 'Marketing', 'R&D', 'Administrative'][Math.floor(Math.random() * 5)],
      variance_percent: (Math.random() * 50 - 25).toFixed(2),
      approved_by: `Manager_${Math.floor(Math.random() * 20) + 1}`,
      cost_center: `CC-${String(Math.floor(Math.random() * 30) + 1).padStart(3, '0')}`,
      invoice_number: `INV-${String(Math.floor(Math.random() * 10000) + 1000).padStart(5, '0')}`,
      vendor_id: `VEND-${String(Math.floor(Math.random() * 100) + 1).padStart(3, '0')}`,
      payment_status: ['Pending', 'Paid', 'Overdue', 'Disputed'][Math.floor(Math.random() * 4)],
    });
  }

  return {
    name: 'Financial_Analytics_Q1',
    fileName: 'financial_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'transaction_id', type: 'text' },
      { name: 'date', type: 'date' },
      { name: 'department', type: 'text' },
      { name: 'cost_type', type: 'text' },
      { name: 'amount', type: 'numeric' },
      { name: 'budget_category', type: 'text' },
      { name: 'variance_percent', type: 'numeric' },
      { name: 'approved_by', type: 'text' },
      { name: 'cost_center', type: 'text' },
      { name: 'invoice_number', type: 'text' },
      { name: 'vendor_id', type: 'text' },
      { name: 'payment_status', type: 'text' },
    ],
    rows,
  };
}

/**
 * WEB ANALYTICS DATASET
 * Website traffic and user behavior
 */
export function generateWebAnalyticsDataset() {
  const rows = [];
  const pages = ['/home', '/products', '/blog', '/pricing', '/contact', '/checkout', '/cart', '/account'];
  const devices = ['Desktop', 'Mobile', 'Tablet'];
  const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge'];
  const sources = ['Organic', 'Direct', 'Referral', 'Paid Search', 'Social'];

  for (let i = 1; i <= 500; i++) {
    const date = new Date('2024-01-01');
    date.setDate(date.getDate() + Math.floor(Math.random() * 90));

    rows.push({
      session_id: `SESSION-${String(i).padStart(6, '0')}`,
      user_id: `USER-${String(Math.floor(Math.random() * 2000) + 1).padStart(5, '0')}`,
      date: date.toISOString().split('T')[0],
      landing_page: pages[Math.floor(Math.random() * pages.length)],
      exit_page: pages[Math.floor(Math.random() * pages.length)],
      device_type: devices[Math.floor(Math.random() * devices.length)],
      browser: browsers[Math.floor(Math.random() * browsers.length)],
      traffic_source: sources[Math.floor(Math.random() * sources.length)],
      session_duration_seconds: Math.floor(Math.random() * 3600) + 30,
      pages_per_session: Math.floor(Math.random() * 15) + 1,
      bounce_rate_percent: Math.floor(Math.random() * 100),
      goal_conversions: Math.random() > 0.7 ? 1 : 0,
      revenue: Math.random() > 0.8 ? Math.floor(Math.random() * 500) + 50 : 0,
      country: ['USA', 'UK', 'Canada', 'Australia', 'Germany'][Math.floor(Math.random() * 5)],
    });
  }

  return {
    name: 'Web_Analytics_Dashboard',
    fileName: 'web_analytics_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'session_id', type: 'text' },
      { name: 'user_id', type: 'text' },
      { name: 'date', type: 'date' },
      { name: 'landing_page', type: 'text' },
      { name: 'exit_page', type: 'text' },
      { name: 'device_type', type: 'text' },
      { name: 'browser', type: 'text' },
      { name: 'traffic_source', type: 'text' },
      { name: 'session_duration_seconds', type: 'numeric' },
      { name: 'pages_per_session', type: 'numeric' },
      { name: 'bounce_rate_percent', type: 'numeric' },
      { name: 'goal_conversions', type: 'numeric' },
      { name: 'revenue', type: 'numeric' },
      { name: 'country', type: 'text' },
    ],
    rows,
  };
}

/**
 * EDUCATION ANALYTICS DATASET
 * Student performance and enrollment data
 */
export function generateEducationDataset() {
  const rows = [];
  const grades = ['9th', '10th', '11th', '12th'];
  const subjects = ['Math', 'English', 'Science', 'History', 'PE', 'Art'];
  const statuses = ['Active', 'Graduated', 'Dropped Out', 'On Leave'];

  for (let i = 1; i <= 400; i++) {
    const enrollDate = new Date('2023-09-01');
    enrollDate.setDate(enrollDate.getDate() + Math.floor(Math.random() * 365));

    rows.push({
      student_id: `STU-${String(i).padStart(5, '0')}`,
      student_name: `Student_${i}`,
      grade_level: grades[Math.floor(Math.random() * grades.length)],
      subject: subjects[Math.floor(Math.random() * subjects.length)],
      enrollment_date: enrollDate.toISOString().split('T')[0],
      class_attendance_percent: Math.floor(Math.random() * 30) + 70,
      assignment_completion_percent: Math.floor(Math.random() * 30) + 70,
      current_gpa: (Math.random() * 4).toFixed(2),
      midterm_score: Math.floor(Math.random() * 50) + 50,
      final_exam_score: Math.floor(Math.random() * 50) + 50,
      classroom_participation: Math.floor(Math.random() * 100),
      tutoring_hours: Math.floor(Math.random() * 30),
      disciplinary_incidents: Math.floor(Math.random() * 5),
      student_status: statuses[Math.floor(Math.random() * statuses.length)],
      scholarship_recipient: Math.random() > 0.7 ? 'Yes' : 'No',
    });
  }

  return {
    name: 'Education_Analytics_Report',
    fileName: 'education_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'student_id', type: 'text' },
      { name: 'student_name', type: 'text' },
      { name: 'grade_level', type: 'text' },
      { name: 'subject', type: 'text' },
      { name: 'enrollment_date', type: 'date' },
      { name: 'class_attendance_percent', type: 'numeric' },
      { name: 'assignment_completion_percent', type: 'numeric' },
      { name: 'current_gpa', type: 'numeric' },
      { name: 'midterm_score', type: 'numeric' },
      { name: 'final_exam_score', type: 'numeric' },
      { name: 'classroom_participation', type: 'numeric' },
      { name: 'tutoring_hours', type: 'numeric' },
      { name: 'disciplinary_incidents', type: 'numeric' },
      { name: 'student_status', type: 'text' },
      { name: 'scholarship_recipient', type: 'text' },
    ],
    rows,
  };
}

/**
 * HEALTHCARE ANALYTICS DATASET
 * Patient data and hospital operations
 */
export function generateHealthcareDataset() {
  const rows = [];
  const departments = ['Emergency', 'Cardiology', 'Oncology', 'Pediatrics', 'Surgery', 'Internal Medicine'];

  for (let i = 1; i <= 350; i++) {
    const admitDate = new Date('2024-01-01');
    admitDate.setDate(admitDate.getDate() + Math.floor(Math.random() * 90));

    rows.push({
      patient_id: `PAT-${String(i).padStart(5, '0')}`,
      admission_date: admitDate.toISOString().split('T')[0],
      department: departments[Math.floor(Math.random() * departments.length)],
      diagnosis_code: `ICD-${String(Math.floor(Math.random() * 1000) + 1000)}`,
      length_of_stay_days: Math.floor(Math.random() * 30) + 1,
      age: Math.floor(Math.random() * 80) + 18,
      insurance_type: ['Medicare', 'Medicaid', 'Private', 'Uninsured'][Math.floor(Math.random() * 4)],
      treatment_cost: Math.floor(Math.random() * 100000) + 5000,
      patient_outcome: ['Recovered', 'Improved', 'Stable', 'Transferred'][Math.floor(Math.random() * 4)],
      readmission_risk: Math.floor(Math.random() * 100),
      medication_count: Math.floor(Math.random() * 15) + 1,
      procedure_count: Math.floor(Math.random() * 10),
      patient_satisfaction_score: Math.floor(Math.random() * 10) + 1,
      appointment_compliance: Math.floor(Math.random() * 30) + 70,
    });
  }

  return {
    name: 'Healthcare_Analytics_Dashboard',
    fileName: 'healthcare_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'patient_id', type: 'text' },
      { name: 'admission_date', type: 'date' },
      { name: 'department', type: 'text' },
      { name: 'diagnosis_code', type: 'text' },
      { name: 'length_of_stay_days', type: 'numeric' },
      { name: 'age', type: 'numeric' },
      { name: 'insurance_type', type: 'text' },
      { name: 'treatment_cost', type: 'numeric' },
      { name: 'patient_outcome', type: 'text' },
      { name: 'readmission_risk', type: 'numeric' },
      { name: 'medication_count', type: 'numeric' },
      { name: 'procedure_count', type: 'numeric' },
      { name: 'patient_satisfaction_score', type: 'numeric' },
      { name: 'appointment_compliance', type: 'numeric' },
    ],
    rows,
  };
}

/**
 * SUPPLY CHAIN ANALYTICS DATASET
 * Procurement and logistics
 */
export function generateSupplyChainDataset() {
  const rows = [];
  const suppliers = ['Supplier_A', 'Supplier_B', 'Supplier_C', 'Supplier_D', 'Supplier_E'];
  const statuses = ['On Time', 'Delayed', 'Cancelled', 'Delivered'];

  for (let i = 1; i <= 300; i++) {
    const orderDate = new Date('2024-01-01');
    orderDate.setDate(orderDate.getDate() + Math.floor(Math.random() * 90));

    rows.push({
      po_number: `PO-${String(i).padStart(6, '0')}`,
      supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
      order_date: orderDate.toISOString().split('T')[0],
      expected_delivery_date: new Date(orderDate.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      actual_delivery_date: new Date(orderDate.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quantity_ordered: Math.floor(Math.random() * 1000) + 100,
      quantity_received: Math.floor(Math.random() * 1000) + 100,
      unit_cost: (Math.random() * 100 + 10).toFixed(2),
      total_cost: Math.floor(Math.random() * 100000) + 5000,
      delivery_status: statuses[Math.floor(Math.random() * statuses.length)],
      on_time_delivery_percent: Math.floor(Math.random() * 30) + 70,
      quality_rating: (Math.random() * 5).toFixed(1),
      lead_time_days: Math.floor(Math.random() * 30) + 3,
    });
  }

  return {
    name: 'Supply_Chain_Analytics',
    fileName: 'supply_chain_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'po_number', type: 'text' },
      { name: 'supplier', type: 'text' },
      { name: 'order_date', type: 'date' },
      { name: 'expected_delivery_date', type: 'date' },
      { name: 'actual_delivery_date', type: 'date' },
      { name: 'quantity_ordered', type: 'numeric' },
      { name: 'quantity_received', type: 'numeric' },
      { name: 'unit_cost', type: 'numeric' },
      { name: 'total_cost', type: 'numeric' },
      { name: 'delivery_status', type: 'text' },
      { name: 'on_time_delivery_percent', type: 'numeric' },
      { name: 'quality_rating', type: 'numeric' },
      { name: 'lead_time_days', type: 'numeric' },
    ],
    rows,
  };
}

/**
 * REAL ESTATE ANALYTICS DATASET
 * Property sales and rentals
 */
export function generateRealEstateDataset() {
  const rows = [];
  const propertyTypes = ['Apartment', 'House', 'Commercial', 'Warehouse', 'Land'];
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
  const statuses = ['Listed', 'Sold', 'Rented', 'Pending'];

  for (let i = 1; i <= 280; i++) {
    const listDate = new Date('2024-01-01');
    listDate.setDate(listDate.getDate() + Math.floor(Math.random() * 90));

    rows.push({
      property_id: `PROP-${String(i).padStart(5, '0')}`,
      address: `${Math.floor(Math.random() * 10000)} Property St`,
      property_type: propertyTypes[Math.floor(Math.random() * propertyTypes.length)],
      city: cities[Math.floor(Math.random() * cities.length)],
      square_feet: Math.floor(Math.random() * 5000) + 1000,
      bedrooms: Math.floor(Math.random() * 5) + 1,
      bathrooms: Math.floor(Math.random() * 3) + 1,
      list_price: Math.floor(Math.random() * 1000000) + 100000,
      sale_price: Math.floor(Math.random() * 1000000) + 100000,
      list_date: listDate.toISOString().split('T')[0],
      sale_date: new Date(listDate.getTime() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      days_on_market: Math.floor(Math.random() * 180) + 5,
      property_status: statuses[Math.floor(Math.random() * statuses.length)],
      agent_id: `AGENT-${String(Math.floor(Math.random() * 50) + 1).padStart(3, '0')}`,
    });
  }

  return {
    name: 'Real_Estate_Analytics',
    fileName: 'real_estate_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'property_id', type: 'text' },
      { name: 'address', type: 'text' },
      { name: 'property_type', type: 'text' },
      { name: 'city', type: 'text' },
      { name: 'square_feet', type: 'numeric' },
      { name: 'bedrooms', type: 'numeric' },
      { name: 'bathrooms', type: 'numeric' },
      { name: 'list_price', type: 'numeric' },
      { name: 'sale_price', type: 'numeric' },
      { name: 'list_date', type: 'date' },
      { name: 'sale_date', type: 'date' },
      { name: 'days_on_market', type: 'numeric' },
      { name: 'property_status', type: 'text' },
      { name: 'agent_id', type: 'text' },
    ],
    rows,
  };
}

/**
 * RESTAURANT/FOOD SERVICE ANALYTICS DATASET
 */
export function generateFoodServiceDataset() {
  const rows = [];
  const restaurants = ['Restaurant_A', 'Restaurant_B', 'Restaurant_C', 'Restaurant_D'];
  const menuCategories = ['Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Sides'];
  const dayTypes = ['Weekday', 'Weekend'];

  for (let i = 1; i <= 320; i++) {
    const date = new Date('2024-01-01');
    date.setDate(date.getDate() + Math.floor(Math.random() * 90));

    rows.push({
      transaction_id: `TRANS-${String(i).padStart(6, '0')}`,
      restaurant: restaurants[Math.floor(Math.random() * restaurants.length)],
      date: date.toISOString().split('T')[0],
      day_type: dayTypes[Math.floor(Math.random() * dayTypes.length)],
      menu_category: menuCategories[Math.floor(Math.random() * menuCategories.length)],
      item_name: `Item_${Math.floor(Math.random() * 100) + 1}`,
      quantity: Math.floor(Math.random() * 10) + 1,
      unit_price: (Math.random() * 50 + 5).toFixed(2),
      food_cost: (Math.random() * 20 + 2).toFixed(2),
      time_period: ['Breakfast', 'Lunch', 'Dinner'][Math.floor(Math.random() * 3)],
      customer_count: Math.floor(Math.random() * 200) + 10,
      cover_count: Math.floor(Math.random() * 150) + 5,
      average_check: (Math.random() * 50 + 15).toFixed(2),
      waste_percent: Math.floor(Math.random() * 15),
      customer_satisfaction: Math.floor(Math.random() * 5) + 1,
    });
  }

  return {
    name: 'Food_Service_Analytics',
    fileName: 'food_service_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'transaction_id', type: 'text' },
      { name: 'restaurant', type: 'text' },
      { name: 'date', type: 'date' },
      { name: 'day_type', type: 'text' },
      { name: 'menu_category', type: 'text' },
      { name: 'item_name', type: 'text' },
      { name: 'quantity', type: 'numeric' },
      { name: 'unit_price', type: 'numeric' },
      { name: 'food_cost', type: 'numeric' },
      { name: 'time_period', type: 'text' },
      { name: 'customer_count', type: 'numeric' },
      { name: 'cover_count', type: 'numeric' },
      { name: 'average_check', type: 'numeric' },
      { name: 'waste_percent', type: 'numeric' },
      { name: 'customer_satisfaction', type: 'numeric' },
    ],
    rows,
  };
}

/**
 * TELECOM ANALYTICS DATASET
 * Telecommunications network and customer data
 */
export function generateTelecomDataset() {
  const rows = [];
  const serviceTypes = ['Mobile', 'Broadband', 'TV', 'Landline'];
  const plans = ['Basic', 'Standard', 'Premium', 'Enterprise'];
  const statuses = ['Active', 'Churned', 'Suspended', 'Pending'];

  for (let i = 1; i <= 400; i++) {
    const startDate = new Date('2023-01-01');
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 365));

    rows.push({
      customer_id: `TEL-${String(i).padStart(5, '0')}`,
      account_number: `ACC-${String(Math.floor(Math.random() * 100000) + 1000).padStart(5, '0')}`,
      service_type: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
      plan_type: plans[Math.floor(Math.random() * plans.length)],
      start_date: startDate.toISOString().split('T')[0],
      monthly_bill: Math.floor(Math.random() * 200) + 30,
      minutes_used: Math.floor(Math.random() * 5000),
      data_used_gb: Math.floor(Math.random() * 50) + 1,
      customer_status: statuses[Math.floor(Math.random() * statuses.length)],
      contract_term_months: [12, 24, 36][Math.floor(Math.random() * 3)],
      last_bill_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_history_score: Math.floor(Math.random() * 100),
      customer_lifetime_value: Math.floor(Math.random() * 50000) + 500,
      churn_risk_score: Math.floor(Math.random() * 100),
    });
  }

  return {
    name: 'Telecom_Analytics_Platform',
    fileName: 'telecom_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'customer_id', type: 'text' },
      { name: 'account_number', type: 'text' },
      { name: 'service_type', type: 'text' },
      { name: 'plan_type', type: 'text' },
      { name: 'start_date', type: 'date' },
      { name: 'monthly_bill', type: 'numeric' },
      { name: 'minutes_used', type: 'numeric' },
      { name: 'data_used_gb', type: 'numeric' },
      { name: 'customer_status', type: 'text' },
      { name: 'contract_term_months', type: 'numeric' },
      { name: 'last_bill_date', type: 'date' },
      { name: 'payment_history_score', type: 'numeric' },
      { name: 'customer_lifetime_value', type: 'numeric' },
      { name: 'churn_risk_score', type: 'numeric' },
    ],
    rows,
  };
}

/**
 * AIRLINE ANALYTICS DATASET
 * Flight operations and passenger data
 */
export function generateAirlineDataset() {
  const rows = [];
  const airlines = ['Airline_A', 'Airline_B', 'Airline_C'];
  const routes = ['NYC-LAX', 'LAX-ORD', 'DFW-ATL', 'SFO-MIA', 'BOS-DEN'];

  for (let i = 1; i <= 300; i++) {
    const date = new Date('2024-01-01');
    date.setDate(date.getDate() + Math.floor(Math.random() * 90));

    rows.push({
      flight_id: `FL-${String(i).padStart(5, '0')}`,
      airline: airlines[Math.floor(Math.random() * airlines.length)],
      route: routes[Math.floor(Math.random() * routes.length)],
      departure_date: date.toISOString().split('T')[0],
      departure_time: `${Math.floor(Math.random() * 24)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      scheduled_duration_minutes: Math.floor(Math.random() * 120) + 120,
      actual_duration_minutes: Math.floor(Math.random() * 120) + 120,
      passengers_booked: Math.floor(Math.random() * 250) + 50,
      passengers_checked_in: Math.floor(Math.random() * 250) + 50,
      revenue: Math.floor(Math.random() * 100000) + 10000,
      fuel_cost: Math.floor(Math.random() * 30000) + 5000,
      aircraft_type: ['Boeing 737', 'Airbus A320', 'Boeing 777'][Math.floor(Math.random() * 3)],
      delay_minutes: Math.floor(Math.random() * 120),
      on_time_percent: Math.floor(Math.random() * 30) + 70,
    });
  }

  return {
    name: 'Airline_Analytics_Dashboard',
    fileName: 'airline_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'flight_id', type: 'text' },
      { name: 'airline', type: 'text' },
      { name: 'route', type: 'text' },
      { name: 'departure_date', type: 'date' },
      { name: 'departure_time', type: 'text' },
      { name: 'scheduled_duration_minutes', type: 'numeric' },
      { name: 'actual_duration_minutes', type: 'numeric' },
      { name: 'passengers_booked', type: 'numeric' },
      { name: 'passengers_checked_in', type: 'numeric' },
      { name: 'revenue', type: 'numeric' },
      { name: 'fuel_cost', type: 'numeric' },
      { name: 'aircraft_type', type: 'text' },
      { name: 'delay_minutes', type: 'numeric' },
      { name: 'on_time_percent', type: 'numeric' },
    ],
    rows,
  };
}

/**
 * RETAIL ANALYTICS DATASET
 * Store operations and sales performance
 */
export function generateRetailDataset() {
  const rows = [];
  const stores = ['Store_01', 'Store_02', 'Store_03', 'Store_04', 'Store_05'];
  const categories = ['Electronics', 'Clothing', 'Groceries', 'Home', 'Sports'];

  for (let i = 1; i <= 350; i++) {
    const date = new Date('2024-01-01');
    date.setDate(date.getDate() + Math.floor(Math.random() * 90));

    rows.push({
      transaction_id: `RETAIL-${String(i).padStart(6, '0')}`,
      store_id: stores[Math.floor(Math.random() * stores.length)],
      date: date.toISOString().split('T')[0],
      product_category: categories[Math.floor(Math.random() * categories.length)],
      sku: `SKU-${String(Math.floor(Math.random() * 5000) + 1000).padStart(5, '0')}`,
      quantity_sold: Math.floor(Math.random() * 20) + 1,
      unit_price: (Math.random() * 200 + 10).toFixed(2),
      total_sales: Math.floor(Math.random() * 5000) + 100,
      cogs: Math.floor(Math.random() * 2000) + 50,
      staff_count: Math.floor(Math.random() * 20) + 5,
      customer_count: Math.floor(Math.random() * 300) + 50,
      inventory_level: Math.floor(Math.random() * 1000) + 100,
      shrinkage_percent: (Math.random() * 5).toFixed(2),
      customer_satisfaction_rating: (Math.random() * 5).toFixed(1),
    });
  }

  return {
    name: 'Retail_Analytics_Report',
    fileName: 'retail_data.csv',
    sourceType: 'training',
    columns: [
      { name: 'transaction_id', type: 'text' },
      { name: 'store_id', type: 'text' },
      { name: 'date', type: 'date' },
      { name: 'product_category', type: 'text' },
      { name: 'sku', type: 'text' },
      { name: 'quantity_sold', type: 'numeric' },
      { name: 'unit_price', type: 'numeric' },
      { name: 'total_sales', type: 'numeric' },
      { name: 'cogs', type: 'numeric' },
      { name: 'staff_count', type: 'numeric' },
      { name: 'customer_count', type: 'numeric' },
      { name: 'inventory_level', type: 'numeric' },
      { name: 'shrinkage_percent', type: 'numeric' },
      { name: 'customer_satisfaction_rating', type: 'numeric' },
    ],
    rows,
  };
}

/**
 * Get all training datasets
 */
export function getAllTrainingDatasets() {
  return [
    generateSalesDataset(),
    generateCustomerDataset(),
    generateProductDataset(),
    generateInventoryDataset(),
    generateMarketingDataset(),
    generateHRDataset(),
    generateFinancialDataset(),
    generateWebAnalyticsDataset(),
    generateEducationDataset(),
    generateHealthcareDataset(),
    generateSupplyChainDataset(),
    generateRealEstateDataset(),
    generateFoodServiceDataset(),
    generateTelecomDataset(),
    generateAirlineDataset(),
    generateRetailDataset(),
  ];
}

/**
 * Get dataset by type
 */
export function getTrainingDatasetByType(type) {
  const typeMap = {
    'sales': generateSalesDataset,
    'customer': generateCustomerDataset,
    'product': generateProductDataset,
    'inventory': generateInventoryDataset,
    'marketing': generateMarketingDataset,
    'hr': generateHRDataset,
    'financial': generateFinancialDataset,
    'web_analytics': generateWebAnalyticsDataset,
    'education': generateEducationDataset,
    'healthcare': generateHealthcareDataset,
    'supply_chain': generateSupplyChainDataset,
    'real_estate': generateRealEstateDataset,
    'food_service': generateFoodServiceDataset,
    'telecom': generateTelecomDataset,
    'airline': generateAirlineDataset,
    'retail': generateRetailDataset,
  };

  const generator = typeMap[type.toLowerCase()];
  return generator ? generator() : null;
}