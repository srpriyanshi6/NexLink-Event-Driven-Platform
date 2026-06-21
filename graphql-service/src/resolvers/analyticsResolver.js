const axios = require('axios');

const analyticsResolver = {
  Query: {
    getSystemMetrics: async (_, { days = 7 }) => {
      const response = await axios.get(`${process.env.ANALYTICS_SERVICE_URL}/analytics/system`, {
        params: { days }
      });
      return response.data.data;
    },
    
    getWorkflowStats: async (_, { userId, days = 30 }) => {
      if (userId) {
        const response = await axios.get(`${process.env.ANALYTICS_SERVICE_URL}/analytics/users/${userId}`);
        const data = response.data.data;
        return {
          created: data.workflows?.total || 0,
          completed: data.workflows?.completed || 0,
          failed: data.workflows?.failed || 0,
          inProgress: (data.workflows?.total || 0) - (data.workflows?.completed || 0) - (data.workflows?.failed || 0),
          averageDuration: data.workflows?.averageExecutionTime || 0
        };
      }
      
      const system = await axios.get(`${process.env.ANALYTICS_SERVICE_URL}/analytics/system`, {
        params: { days }
      });
      
      return {
        created: system.data.data.summary.totalWorkflows || 0,
        completed: system.data.data.summary.workflowsCompleted || 0,
        failed: system.data.data.summary.workflowsFailed || 0,
        inProgress: (system.data.data.summary.totalWorkflows || 0) - 
                   (system.data.data.summary.workflowsCompleted || 0) - 
                   (system.data.data.summary.workflowsFailed || 0),
        averageDuration: system.data.data.performance.averageWorkflowExecutionTime || 0
      };
    },
    
    getUserActivity: async (_, { userId, days = 30 }) => {
      const response = await axios.get(`${process.env.ANALYTICS_SERVICE_URL}/analytics/users/${userId}`, {
        params: { days }
      });
      return response.data.data.activity?.dailyBreakdown || [];
    },
    
    getDailyMetrics: async (_, { days = 7 }) => {
      const response = await axios.get(`${process.env.ANALYTICS_SERVICE_URL}/analytics/system`, {
        params: { days }
      });
      return response.data.data.trends?.daily || [];
    },
    
    getPerformanceMetrics: async (_, { hours = 24 }) => {
      const response = await axios.get(`${process.env.ANALYTICS_SERVICE_URL}/analytics/dashboard`);
      const data = response.data.data;
      
      return {
        avgWorkflowExecutionTime: data.performance?.averageWorkflowExecutionTime || 0,
        p95ExecutionTime: data.performance?.averageWorkflowExecutionTime ? 
          data.performance.averageWorkflowExecutionTime * 1.5 : 0,
        p99ExecutionTime: data.performance?.averageWorkflowExecutionTime ? 
          data.performance.averageWorkflowExecutionTime * 2 : 0,
        successRate: data.performance?.completionRate || 0,
        throughput: data.realtime?.lastHour?.workflows?.completed || 0
      };
    },
    
    getDashboardData: async (_, { userId }, context) => {
      const [systemMetrics, recentWorkflows, userStats, workflowStats, activity] = await Promise.all([
        axios.get(`${process.env.ANALYTICS_SERVICE_URL}/analytics/system`),
        axios.get(`${process.env.WORKFLOW_SERVICE_URL}/workflows`, {
          params: { userId: userId || context.userId, limit: 10 }
        }),
        userId ? axios.get(`${process.env.ANALYTICS_SERVICE_URL}/analytics/users/${userId}`) : Promise.resolve(null),
        axios.get(`${process.env.ANALYTICS_SERVICE_URL}/analytics/system`),
        userId ? axios.get(`${process.env.ANALYTICS_SERVICE_URL}/analytics/users/${userId}`, {
          params: { days: 7 }
        }) : Promise.resolve(null)
      ]);
      
      return {
        systemMetrics: systemMetrics.data.data,
        recentWorkflows: recentWorkflows.data.data?.workflows || [],
        userStats: userStats?.data.data || null,
        workflowStats: {
          created: workflowStats.data.data.summary.totalWorkflows || 0,
          completed: workflowStats.data.data.summary.workflowsCompleted || 0,
          failed: workflowStats.data.data.summary.workflowsFailed || 0,
          inProgress: (workflowStats.data.data.summary.totalWorkflows || 0) - 
                     (workflowStats.data.data.summary.workflowsCompleted || 0) - 
                     (workflowStats.data.data.summary.workflowsFailed || 0),
          averageDuration: workflowStats.data.data.performance.averageWorkflowExecutionTime || 0
        },
        activity: activity?.data.data.activity?.dailyBreakdown || []
      };
    }
  }
};

module.exports = analyticsResolver;