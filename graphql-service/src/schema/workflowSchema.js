const { gql } = require('apollo-server-express');

const workflowTypeDefs = gql`
  type Workflow {
    id: ID!
    name: String!
    description: String
    status: WorkflowStatus!
    steps: [WorkflowStep!]!
    createdBy: User!
    priority: Priority!
    tags: [String!]!
    completionPercentage: Float!
    startedAt: String
    completedAt: String
    createdAt: String!
    updatedAt: String!
    analytics: WorkflowAnalytics
  }

  type WorkflowStep {
    order: Int!
    type: StepType!
    config: JSON!
    status: StepStatus!
    startedAt: String
    completedAt: String
    error: String
    output: JSON
  }

  type WorkflowAnalytics {
    executionTime: Int
    stepCount: Int!
    completedSteps: Int!
    failedSteps: Int!
    status: String!
  }

  enum WorkflowStatus {
    draft
    active
    in_progress
    completed
    failed
    paused
    cancelled
  }

  enum StepType {
    task
    approval
    notification
    webhook
    condition
    delay
    parallel
  }

  enum StepStatus {
    pending
    in_progress
    completed
    failed
    skipped
  }

  enum Priority {
    low
    medium
    high
    critical
  }

  input WorkflowStepInput {
    order: Int
    type: StepType!
    config: JSON!
  }

  input CreateWorkflowInput {
    name: String!
    description: String
    steps: [WorkflowStepInput!]!
    priority: Priority
    tags: [String!]
  }

  input UpdateWorkflowInput {
    name: String
    description: String
    priority: Priority
    tags: [String!]
    status: WorkflowStatus
  }

  extend type Query {
    getWorkflow(id: ID!): Workflow
    getWorkflows(userId: ID, status: WorkflowStatus, page: Int, limit: Int): WorkflowListResponse!
    searchWorkflows(query: String!, userId: ID): [Workflow!]!
  }

  extend type Mutation {
    createWorkflow(input: CreateWorkflowInput!): Workflow!
    updateWorkflow(id: ID!, input: UpdateWorkflowInput!): Workflow!
    deleteWorkflow(id: ID!): Boolean!
    triggerWorkflow(id: ID!): Workflow!
    retryWorkflow(id: ID!): Workflow!
    pauseWorkflow(id: ID!): Workflow!
    resumeWorkflow(id: ID!): Workflow!
  }

  type WorkflowListResponse {
    workflows: [Workflow!]!
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
  }

  scalar JSON
`;

module.exports = workflowTypeDefs;