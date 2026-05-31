const axios = require('axios');

const notificationResolver = {
  Query: {
    getNotifications: async (_, { userId, read, page = 1, limit = 20 }) => {
      const params = { page, limit };
      if (userId) params.userId = userId;
      if (read !== undefined) params.read = read;
      
      const response = await axios.get(`${process.env.NOTIFICATION_SERVICE_URL}/api/notifications`, { params });
      return response.data.data;
    },
    
    getUnreadCount: async (_, { userId }) => {
      const response = await axios.get(`${process.env.NOTIFICATION_SERVICE_URL}/api/notifications`, {
        params: { userId, read: false, limit: 1 }
      });
      return response.data.data?.unreadCount || 0;
    }
  },
  
  Mutation: {
    sendNotification: async (_, { input }) => {
      const response = await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/send`, input);
      return response.data.data?.notification;
    },
    
    markNotificationRead: async (_, { id }) => {
      const response = await axios.put(`${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/${id}/read`);
      return response.data.data?.notification;
    },
    
    markAllNotificationsRead: async (_, { userId }) => {
      await axios.put(`${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/read-all`, { userId });
      return true;
    },
    
    deleteNotification: async (_, { id }) => {
      await axios.delete(`${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/${id}`);
      return true;
    },
    
    deleteAllNotifications: async (_, { userId }) => {
      //require a bulk delete endpoint
      return true;
    }
  },
  
  Notification: {
    //additional resolvers if needed
  }
};

module.exports = notificationResolver;