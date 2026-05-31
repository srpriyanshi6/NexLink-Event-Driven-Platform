const axios = require('axios');
const DataLoader = require('dataloader');

//Data loader for batching user requests
const userLoader = new DataLoader(async (userIds) => {
  const promises = userIds.map(id => 
    axios.get(`${process.env.USER_SERVICE_URL}/users/${id}`)
      .then(res => res.data.user)
      .catch(err => null)
  );
  return Promise.all(promises);
});

const userResolver = {
  Query: {
    getUser: async (_, { id }) => {
      const response = await axios.get(`${process.env.USER_SERVICE_URL}/users/${id}`);
      return response.data.user;
    },
    
    getCurrentUser: async (_, __, context) => {
      if (!context.userId) {
        throw new Error('Not authenticated');
      }
      const response = await axios.get(`${process.env.USER_SERVICE_URL}/users/${context.userId}`);
      return response.data.user;
    },
    
    getUsers: async (_, { page = 1, limit = 10, role }) => {
      const params = { page, limit };
      if (role) params.role = role;
      
      const response = await axios.get(`${process.env.USER_SERVICE_URL}/users`, { params });
      return response.data.data;
    }
  },
  
  Mutation: {
    updateUser: async (_, { id, input }, context) => {
      // Check authorization
      if (context.role !== 'admin' && context.userId !== id) {
        throw new Error('Not authorized to update this user');
      }
      
      const response = await axios.put(`${process.env.USER_SERVICE_URL}/users/${id}`, input);
      return response.data.data.user;
    },
    
    deactivateUser: async (_, { id }, context) => {
      if (context.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      const response = await axios.put(`${process.env.USER_SERVICE_URL}/users/${id}`, { isActive: false });
      return response.data.data.user;
    },
    
    reactivateUser: async (_, { id }, context) => {
      if (context.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      const response = await axios.put(`${process.env.USER_SERVICE_URL}/users/${id}`, { isActive: true });
      return response.data.data.user;
    }
  },
  
  User: {
    workflows: async (parent) => {
      try {
        const response = await axios.get(`${process.env.WORKFLOW_SERVICE_URL}/workflows`, {
          params: { userId: parent.id }
        });
        return response.data.data?.workflows || [];
      } catch (error) {
        console.error('Error fetching user workflows:', error.message);
        return [];
      }
    },
    
    notifications: async (parent) => {
      try {
        const response = await axios.get(`${process.env.NOTIFICATION_SERVICE_URL}/api/notifications`, {
          params: { userId: parent.id, limit: 10 }
        });
        return response.data.data?.notifications || [];
      } catch (error) {
        console.error('Error fetching user notifications:', error.message);
        return [];
      }
    },
    
    analytics: async (parent) => {
      try {
        const response = await axios.get(`${process.env.ANALYTICS_SERVICE_URL}/api/analytics/users/${parent.id}`);
        return response.data.data;
      } catch (error) {
        console.error('Error fetching user analytics:', error.message);
        return null;
      }
    }
  }
};

module.exports = userResolver;