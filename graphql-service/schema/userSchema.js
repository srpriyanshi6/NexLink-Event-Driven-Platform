const { gql } = require('apollo-server-express');

const userTypeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String!
    role: String!
    isActive: Boolean!
    lastLogin: String
    createdAt: String!
    updatedAt: String!
    workflows: [Workflow!]!
    notifications: [Notification!]!
    analytics: UserAnalytics
  }

  type UserAnalytics {
    totalWorkflows: Int!
    completedWorkflows: Int!
    failedWorkflows: Int!
    completionRate: Float!
    activityScore: Int!
    lastActive: String
  }

  input UserUpdateInput {
    name: String
    role: String
  }

  extend type Query {
    getUser(id: ID!): User
    getCurrentUser: User
    getUsers(page: Int, limit: Int, role: String): UserListResponse!
  }

  extend type Mutation {
    updateUser(id: ID!, input: UserUpdateInput!): User!
    deactivateUser(id: ID!): User!
    reactivateUser(id: ID!): User!
  }

  type UserListResponse {
    users: [User!]!
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
  }
`;

module.exports = userTypeDefs;