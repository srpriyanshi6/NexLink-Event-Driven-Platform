const { gql } = require('apollo-server-express');
const userTypeDefs = require('./userSchema');
const workflowTypeDefs = require('./workflowSchema');
const analyticsTypeDefs = require('./analyticsSchema');
const notificationTypeDefs = require('./notificationSchema');

const rootTypeDefs = gql`
  type Query {
    _root: String
  }

  type Mutation {
    _root: String
  }
`;

const typeDefs = [
  rootTypeDefs,
  userTypeDefs,
  workflowTypeDefs,
  analyticsTypeDefs,
  notificationTypeDefs
];

module.exports = typeDefs;