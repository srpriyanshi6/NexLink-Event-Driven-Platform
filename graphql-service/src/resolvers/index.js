const userResolver = require('./userResolver');
const workflowResolver = require('./workflowResolver');
const analyticsResolver = require('./analyticsResolver');
const notificationResolver = require('./notificationResolver');

const resolvers = {
  Query: {
    ...userResolver.Query,
    ...workflowResolver.Query,
    ...analyticsResolver.Query,
    ...notificationResolver.Query
  },
  Mutation: {
    ...userResolver.Mutation,
    ...workflowResolver.Mutation,
    ...notificationResolver.Mutation
  },
  User: userResolver.User,
  Workflow: workflowResolver.Workflow,
  Notification: notificationResolver.Notification
};

module.exports = resolvers;