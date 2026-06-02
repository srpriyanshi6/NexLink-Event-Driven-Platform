import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

//custom metrics
const registrationDuration = new Trend('registration_duration');
const workflowDuration = new Trend('workflow_duration');
const errorRate = new Rate('error_rate');
const requestsTotal = new Counter('requests_total');

//configuration
const BASE_URL = 'http://localhost:3000';
const USERS_COUNT = 50;

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up
    { duration: '2m', target: 50 },   // Stay at peak
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
    registration_duration: ['p(95)<1000'],
    workflow_duration: ['p(95)<2000'],
  },
};

export default function() {
  const vuId = __VU;
  const iterId = __ITER;
  const uniqueEmail = `user_${vuId}_${iterId}_${Date.now()}@loadtest.com`;
  
  //Test 1: User Registration
  let registerStart = Date.now();
  const registerRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email: uniqueEmail,
    password: 'Test123!',
    name: `Load Test User ${vuId}`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  registrationDuration.add(Date.now() - registerStart);
  requestsTotal.add(1);
  
  const registerSuccess = check(registerRes, {
    'registration status is 201': (r) => r.status === 201,
    'registration returns token': (r) => r.json('data.token') !== undefined,
  });
  
  errorRate.add(!registerSuccess);
  
  if (!registerSuccess) {
    console.log(`Registration failed: ${registerRes.status} - ${registerRes.body}`);
    return;
  }
  
  const token = registerRes.json('data.token');
  const userId = registerRes.json('data.user.id');
  
  sleep(1);
  
  //Test 2: Create Workflow
  let workflowStart = Date.now();
  const workflowRes = http.post(`${BASE_URL}/api/workflows`, JSON.stringify({
    name: `Load Test Workflow ${vuId}_${iterId}`,
    description: 'Created during load test',
    steps: [
      { order: 1, type: 'task', config: { task: 'Process data', duration: 500 } },
      { order: 2, type: 'notification', config: { message: 'Step complete', type: 'system' } }
    ]
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  
  workflowDuration.add(Date.now() - workflowStart);
  requestsTotal.add(1);
  
  const workflowSuccess = check(workflowRes, {
    'workflow creation status is 201': (r) => r.status === 201,
    'workflow has id': (r) => r.json('data.workflow.id') !== undefined,
  });
  
  errorRate.add(!workflowSuccess);
  
  if (workflowSuccess) {
    const workflowId = workflowRes.json('data.workflow.id');
    
    sleep(1);
    
    //Test 3: Trigger Workflow
    const triggerRes = http.post(`${BASE_URL}/api/workflows/${workflowId}/trigger`, null, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    requestsTotal.add(1);
    
    check(triggerRes, {
      'workflow trigger status is 200': (r) => r.status === 200,
    });
  }
  
  sleep(2);
}

export function handleSummary(data) {
  console.log('=== Load Test Summary ===');
  console.log(`Total requests: ${data.metrics.requests_total?.values?.count || 0}`);
  console.log(`Error rate: ${(data.metrics.error_rate?.values?.rate * 100).toFixed(2)}%`);
  console.log(`Registration p95: ${data.metrics.registration_duration?.values['p(95)']?.toFixed(2)}ms`);
  console.log(`Workflow p95: ${data.metrics.workflow_duration?.values['p(95)']?.toFixed(2)}ms`);
  
  return {
    'summary.json': JSON.stringify(data, null, 2),
  };
}