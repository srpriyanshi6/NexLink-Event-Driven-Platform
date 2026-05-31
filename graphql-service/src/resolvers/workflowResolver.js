const axios = require('axios');

const workflowResolver = {
  Query: {
    getWorkflow: async (_, { id }) => {
      const response = await axios.get(`${process.env.WORKFLOW_SERVICE_URL}/workflows/${id}`);
      return response.data.data?.workflow;
    },
    
    getWorkflows: async (_, { userId, status, page = 1, limit = 10 }) => {
      const params = { page, limit };
      if (userId) params.userId = userId;
      if (status) params.status = status;
      
      const response = await axios.get(`${process.env.WORKFLOW_SERVICE_URL}/workflows`, { params });
      return response.data.data;
    },
    
    searchWorkflows: async (_, { query, userId }) => {
      //implement search logic
      const response = await axios.get(`${process.env.WORKFLOW_SERVICE_URL}/workflows`, {
        params: { userId, search: query }
      });
      return response.data.data?.workflows || [];
    }
  },
  
  Mutation: {
    createWorkflow: async (_, { input }, context) => {
      const workflowData = {
        ...input,
        createdBy: context.userId
      };
      
      const response = await axios.post(`${process.env.WORKFLOW_SERVICE_URL}/workflows`, workflowData);
      return response.data.data?.workflow;
    },
    
    updateWorkflow: async (_, { id, input }) => {
      const response = await axios.put(`${process.env.WORKFLOW_SERVICE_URL}/workflows/${id}`, input);
      return response.data.data?.workflow;
    },
    
    deleteWorkflow: async (_, { id }) => {
      await axios.delete(`${process.env.WORKFLOW_SERVICE_URL}/workflows/${id}`);
      return true;
    },
    
    triggerWorkflow: async (_, { id }) => {
      const response = await axios.post(`${process.env.WORKFLOW_SERVICE_URL}/workflows/${id}/trigger`);
      const workflowRes = await axios.get(`${process.env.WORKFLOW_SERVICE_URL}/workflows/${id}`);
      return workflowRes.data.data?.workflow;
    },
    
    retryWorkflow: async (_, { id }) => {
      //first reset the workflow, then trigger
      await axios.put(`${process.env.WORKFLOW_SERVICE_URL}/workflows/${id}`, { status: 'active' });
      const response = await axios.post(`${process.env.WORKFLOW_SERVICE_URL}/workflows/${id}/trigger`);
      const workflowRes = await axios.get(`${process.env.WORKFLOW_SERVICE_URL}/workflows/${id}`);
      return workflowRes.data.data?.workflow;
    },
    
    pauseWorkflow: async (_, { id }) => {
      const response = await axios.put(`${process.env.WORKFLOW_SERVICE_URL}/workflows/${id}`, { status: 'paused' });
      return response.data.data?.workflow;
    },
    
    resumeWorkflow: async (_, { id }) => {
      const response = await axios.put(`${process.env.WORKFLOW_SERVICE_URL}/workflows/${id}`, { status: 'active' });
      return response.data.data?.workflow;
    }
  },
  
  Workflow: {
    createdBy: async (parent) => {
      try {
        const response = await axios.get(`${process.env.USER_SERVICE_URL}/users/${parent.createdBy}`);
        return response.data.user;
      } catch (error) {
        console.error('Error fetching workflow creator:', error.message);
        return null;
      }
    },
    
    analytics: async (parent) => {
      try {
        const response = await axios.get(`${process.env.ANALYTICS_SERVICE_URL}/api/analytics/workflows/${parent.id}`);
        return response.data.data;
      } catch (error) {
        console.error('Error fetching workflow analytics:', error.message);
        return null;
      }
    }
  }
};

module.exports = workflowResolver;