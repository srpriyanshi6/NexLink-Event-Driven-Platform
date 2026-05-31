const { gql } = require('apollo-server-express');

const notificationTypeDefs = gql`
  type Notification {
    id: ID!
    userId: ID!
    type: NotificationType!
    title: String!
    message: String!
    read: Boolean!
    readAt: String
    priority: NotificationPriority!
    data: JSON
    createdAt: String!
  }

  enum NotificationType {
    email
    system
    webhook
    push
    sms
  }

  enum NotificationPriority {
    low
    medium
    high
    urgent
  }

  input SendNotificationInput {
    userId: ID!
    title: String!
    message: String!
    type: NotificationType
    priority: NotificationPriority
    data: JSON
  }

  extend type Query {
    getNotifications(userId: ID, read: Boolean, page: Int, limit: Int): NotificationListResponse!
    getUnreadCount(userId: ID!): Int!
  }

  extend type Mutation {
    sendNotification(input: SendNotificationInput!): Notification!
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead(userId: ID!): Boolean!
    deleteNotification(id: ID!): Boolean!
    deleteAllNotifications(userId: ID!): Boolean!
  }

  type NotificationListResponse {
    notifications: [Notification!]!
    unreadCount: Int!
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
  }

  scalar JSON
`;

module.exports = notificationTypeDefs;