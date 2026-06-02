const axios = require('axios');

//configuration
const config = {
  apiGateway: 'http://localhost:3000',
  userService: 'http://localhost:3001',
  workflowService: 'http://localhost:3002',
  notificationService: 'http://localhost:3003',
  analyticsService: 'http://localhost:3004',
  graphqlService: 'http://localhost:3005'
};

//test data
let testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'Test23!',
  name: 'Integration Test User'
};

let authToken = null;
let userId = null;
let workflowId = null;

//helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

//test suite
async function runIntegrationTests() {
  console.log('\n========================================');
  console.log('Starting Integration Tests');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  //Test 1: Health Checks
  console.log('Test 1: Service Health Checks');
  const services = ['apiGateway', 'userService', 'workflowService', 'notificationService', 'analyticsService', 'graphqlService'];
  
  for (const service of services) {
    try {
      const url = config[service];
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      if (response.status === 200) {
        console.log(`${service} is healthy`);
        passed++;
      } else {
        console.log(`${service} returned ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`${service} is not responding: ${error.message}`);
      failed++;
    }
  }
  console.log('');

  //Test 2: User Registration
  console.log('Test 2: User Registration');
  try {
    const response = await axios.post(`${config.apiGateway}/api/auth/register`, testUser);
    
    if (response.status === 201 && response.data.data.token) {
      authToken = response.data.data.token;
      userId = response.data.data.user.id;
      console.log(`User registered: ${testUser.email}`);
      console.log(`User ID: ${userId}`);
      console.log(`Token received: ${authToken.substring(0, 50)}...`);
      passed++;
    } else {
      console.log(`Registration failed: ${JSON.stringify(response.data)}`);
      failed++;
    }
  } catch (error) {
    console.log(`Registration error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //Test 3: User Login
  console.log('Test 3: User Login');
  try {
    const response = await axios.post(`${config.apiGateway}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    if (response.status === 200 && response.data.data.token) {
      authToken = response.data.data.token;
      console.log(`Login successful`);
      console.log(`New token received`);
      passed++;
    } else {
      console.log(`Login failed`);
      failed++;
    }
  } catch (error) {
    console.log(`Login error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //Test 4: Create Workflow
  console.log('Test 4: Create Workflow');
  const workflowData = {
    name: 'Integration Test Workflow',
    description: 'Testing workflow creation and execution',
    steps: [
      {
        order: 1,
        type: 'task',
        config: { task: 'Validate input data', duration: 1000 }
      },
      {
        order: 2,
        type: 'notification',
        config: { message: 'Validation complete', type: 'system' }
      },
      {
        order: 3,
        type: 'webhook',
        config: { url: 'https://webhook.site/#!/test', method: 'POST' }
      }
    ]
  };

  try {
    const response = await axios.post(`${config.apiGateway}/api/workflows`, workflowData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status === 201 && response.data.data.workflow.id) {
      workflowId = response.data.data.workflow.id;
      console.log(`Workflow created: ${workflowId}`);
      console.log(`Workflow name: ${response.data.data.workflow.name}`);
      console.log(`Steps count: ${response.data.data.workflow.steps.length}`);
      passed++;
    } else {
      console.log(`Workflow creation failed`);
      failed++;
    }
  } catch (error) {
    console.log(`Workflow error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //Test 5: Get Workflow by ID
  console.log('Test 5: Get Workflow by ID');
  try {
    const response = await axios.get(`${config.apiGateway}/api/workflows/${workflowId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status === 200 && response.data.data.workflow.id === workflowId) {
      console.log(`Workflow retrieved successfully`);
      console.log(`Workflow status: ${response.data.data.workflow.status}`);
      passed++;
    } else {
      console.log(`Failed to retrieve workflow`);
      failed++;
    }
  } catch (error) {
    console.log(`Get workflow error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //Test 6: List Workflows
  console.log('Test 6: List Workflows');
  try {
    const response = await axios.get(`${config.apiGateway}/api/workflows`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { userId: userId, limit: 10 }
    });
    
    if (response.status === 200 && response.data.data.workflows) {
      console.log(`Found ${response.data.data.workflows.length} workflows`);
      console.log(`Pagination: page ${response.data.data.pagination.page} of ${response.data.data.pagination.pages}`);
      passed++;
    } else {
      console.log(`Failed to list workflows`);
      failed++;
    }
  } catch (error) {
    console.log(`List workflows error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //Test 7: Trigger Workflow
  console.log('⚡ Test 7: Trigger Workflow');
  try {
    const response = await axios.post(`${config.apiGateway}/api/workflows/${workflowId}/trigger`, {}, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status === 200) {
      console.log(`Workflow triggered successfully`);
      passed++;
    } else {
      console.log(`Failed to trigger workflow`);
      failed++;
    }
  } catch (error) {
    console.log(`Trigger error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //wait for async processing
  console.log('Waiting for async processing...');
  await delay(3000);

  //Test 8: Get Notifications
  console.log('Test 8: Get Notifications');
  try {
    const response = await axios.get(`${config.apiGateway}/api/notifications`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { userId: userId, limit: 20 }
    });
    
    if (response.status === 200 && response.data.data.notifications) {
      console.log(`Found ${response.data.data.notifications.length} notifications`);
      console.log(`Unread count: ${response.data.data.unreadCount}`);
      passed++;
    } else {
      console.log(`Failed to get notifications`);
      failed++;
    }
  } catch (error) {
    console.log(`Notifications error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //Test 9: GraphQL Query
  console.log('Test 9: GraphQL Query');
  const graphqlQuery = `
    query {
      getUser(id: "${userId}") {
        name
        email
        workflows {
          id
          name
          status
        }
      }
      getSystemMetrics {
        totalUsers
        totalWorkflows
        completionRate
      }
    }
  `;

  try {
    const response = await axios.post(`${config.graphqlService}/graphql`, {
      query: graphqlQuery
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status === 200 && response.data.data) {
      console.log(`GraphQL query successful`);
      console.log(` User: ${response.data.data.getUser?.name}`);
      console.log(` Workflows: ${response.data.data.getUser?.workflows?.length || 0}`);
      console.log(` System metrics: ${response.data.data.getSystemMetrics?.totalUsers} users, ${response.data.data.getSystemMetrics?.totalWorkflows} workflows`);
      passed++;
    } else {
      console.log(` GraphQL query failed: ${JSON.stringify(response.data.errors)}`);
      failed++;
    }
  } catch (error) {
    console.log(` GraphQL error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //Test 10: Get Analytics
  console.log('Test 10: Get User Analytics');
  try {
    const response = await axios.get(`${config.apiGateway}/api/analytics/users/${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { days: 7 }
    });
    
    if (response.status === 200) {
      console.log(` Analytics retrieved successfully`);
      console.log(` Total workflows: ${response.data.data.workflows?.total || 0}`);
      console.log(` Completion rate: ${response.data.data.workflows?.completionRate || 0}%`);
      passed++;
    } else {
      console.log(` Failed to get analytics`);
      failed++;
    }
  } catch (error) {
    console.log(` Analytics error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //Test 11: Update Workflow
  console.log('Test 11: Update Workflow');
  try {
    const response = await axios.put(`${config.apiGateway}/api/workflows/${workflowId}`, {
      name: 'Updated Workflow Name',
      description: 'This workflow was updated by integration test'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status === 200 && response.data.data.workflow.name === 'Updated Workflow Name') {
      console.log(` Workflow updated successfully`);
      passed++;
    } else {
      console.log(` Failed to update workflow`);
      failed++;
    }
  } catch (error) {
    console.log(` Update error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //Test 12: Mark Notification as Read
  console.log('✓ Test 12: Mark Notification as Read');
  try {
    //first get notifications to find one to mark as read
    const notificationsRes = await axios.get(`${config.apiGateway}/api/notifications`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { userId: userId, limit: 1 }
    });
    
    const notificationId = notificationsRes.data.data.notifications[0]?.id;
    
    if (notificationId) {
      const response = await axios.put(`${config.apiGateway}/api/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (response.status === 200) {
        console.log(` Notification marked as read`);
        passed++;
      } else {
        console.log(` Failed to mark notification as read`);
        failed++;
      }
    } else {
      console.log(` No notifications to mark as read`);
      passed++;
    }
  } catch (error) {
    console.log(` Mark read error: ${error.response?.data?.error || error.message}`);
    failed++;
  }
  console.log('');

  //test Results Summary
  console.log('========================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('========================================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
  console.log('========================================\n');

  if (failed === 0) {
    console.log('All integration tests passed! System is ready for deployment.\n');
  } else {
    console.log(`${failed} test(s) failed. Please check the logs above.\n`);
  }
}

//run the tests
runIntegrationTests().catch(console.error);