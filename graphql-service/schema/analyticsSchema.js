const { gql } = require('apollo-server-express');

const analyticsTypeDefs = gql`
  type SystemMetrics {
    totalUsers: Int!
    totalWorkflows: Int!
    workflowsCompleted: Int!
    workflowsFailed: Int!
    completionRate: Float!
    averageExecutionTime: Int!
    activeUsers: Int!
    notificationsSent: Int!
    eventsLastHour: Int!
    timestamp: String!
  }

  type WorkflowStats {
    created: Int!
    completed: Int!
    failed: Int!
    inProgress: Int!
    averageDuration: Int!
  }

  type UserActivity {
    date: String!
    events: Int!
    workflowsCreated: Int!
    workflowsCompleted: Int!
  }

  type DailyMetric {
    date: String!
    metrics: DailyMetricsData!
  }

  type DailyMetricsData {
    users: UserDailyMetrics!
    workflows: WorkflowDailyMetrics!
    notifications: NotificationDailyMetrics!
  }

  type UserDailyMetrics {
    total: Int!
    new: Int!
    active: Int!
  }

  type WorkflowDailyMetrics {
    total: Int!
    created: Int!
    completed: Int!
    failed: Int!
    averageExecutionTime: Int!
  }

  type NotificationDailyMetrics {
    total: Int!
    delivered: Int!
    failed: Int!
  }

  type PerformanceMetrics {
    avgWorkflowExecutionTime: Int!
    p95ExecutionTime: Int!
    p99ExecutionTime: Int!
    successRate: Float!
    throughput: Int!
  }

  extend type Query {
    getSystemMetrics(days: Int): SystemMetrics!
    getWorkflowStats(userId: ID, days: Int): WorkflowStats!
    getUserActivity(userId: ID!, days: Int): [UserActivity!]!
    getDailyMetrics(days: Int): [DailyMetric!]!
    getPerformanceMetrics(hours: Int): PerformanceMetrics!
    getDashboardData(userId: ID): DashboardData!
  }

  type DashboardData {
    systemMetrics: SystemMetrics!
    recentWorkflows: [Workflow!]!
    userStats: UserAnalytics
    workflowStats: WorkflowStats!
    activity: [UserActivity!]!
  }
`;

module.exports = analyticsTypeDefs;