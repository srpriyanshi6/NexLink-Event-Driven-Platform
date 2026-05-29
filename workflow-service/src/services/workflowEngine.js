const axios = require('axios');
const Workflow = require('../models/Workflow');

//asynchronous workflow execution with step retry logic
class WorkflowEngine {
  constructor(kafkaProducer) {
    this.kafkaProducer = kafkaProducer;
    this.runningWorkflows = new Map(); 
  }

  //execute workflow by ID
  async executeWorkflow(workflowId) {
    //prevent duplicate execution
    if (this.runningWorkflows.has(workflowId)) {
      console.log(`Workflow ${workflowId} already running`);
      return;
    }

    const workflow = await Workflow.findById(workflowId);
    
    if (!workflow || workflow.status !== 'active') {
      throw new Error(`Cannot execute workflow ${workflowId}: not active`);
    }

    this.runningWorkflows.set(workflowId, true);
    workflow.status = 'in_progress';
    workflow.startedAt = new Date();
    await workflow.save();

    const startTime = Date.now();

    try {
      for (const step of workflow.steps) {
        if (step.status === 'pending' || step.status === 'failed') {
          await this.executeStep(step, workflow);
        }
      }

      workflow.status = 'completed';
      workflow.completedAt = new Date();
      workflow.executionTime = Date.now() - startTime;
      await workflow.save();

      //emit workflow completion event
      await this.emitEvent('WORKFLOW_COMPLETED', {
        workflowId: workflow._id,
        executionTime: workflow.executionTime,
        completedAt: workflow.completedAt,
        stepsCompleted: workflow.steps.filter(s => s.status === 'completed').length
      });

      console.log(`yayy workflow ${workflowId} completed successfully`);

    } catch (error) {
      workflow.status = 'failed';
      workflow.error = error.message;
      workflow.completedAt = new Date();
      workflow.executionTime = Date.now() - startTime;
      await workflow.save();

      //emit workflow failure event
      await this.emitEvent('WORKFLOW_FAILED', {
        workflowId: workflow._id,
        error: error.message,
        failedStep: error.step
      });

      console.error(`workflow ${workflowId} failed:`, error.message);
      throw error;
    } finally {
      this.runningWorkflows.delete(workflowId);
    }
  }

  //individual workflow step with retry logic
  async executeStep(step, workflow) {
    const maxRetries = step.config.maxRetries || 3;
    let attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        step.status = 'in_progress';
        step.startedAt = new Date();
        await workflow.save();

        console.log(`executing step ${step.order}: ${step.type}`);
        
        let output;
        switch (step.type) {
          case 'task':
            output = await this.executeTask(step.config);
            break;
          case 'notification':
            output = await this.sendNotification(step.config, workflow);
            break;
          case 'webhook':
            output = await this.callWebhook(step.config);
            break;
          case 'delay':
            output = await this.delay(step.config);
            break;
          case 'condition':
            output = await this.evaluateCondition(step.config, workflow);
            break;
          case 'parallel':
            output = await this.executeParallelSteps(step.config, workflow);
            break;
          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }

        step.status = 'completed';
        step.completedAt = new Date();
        step.output = output;
        await workflow.save();

        //emit step completion event
        await this.emitEvent('WORKFLOW_STEP_COMPLETED', {
          workflowId: workflow._id,
          stepOrder: step.order,
          stepType: step.type,
          executionTime: step.completedAt - step.startedAt
        });

        return output;

      } catch (error) {
        attempts++;
        step.retryCount = attempts;
        step.error = error.message;
        
        if (attempts >= maxRetries) {
          step.status = 'failed';
          step.completedAt = new Date();
          await workflow.save();
          
          error.step = step.order;
          throw error;
        }
        
        console.log(`  Retrying step ${step.order} (attempt ${attempts}/${maxRetries})`);
        await this.delay({ duration: Math.pow(2, attempts) }); // Exponential backoff
      }
    }
  }

  //execute task step
  async executeTask(config) {
    const duration = config.duration || 500;
    await new Promise(resolve => setTimeout(resolve, duration));
    return { 
      completed: true, 
      task: config.task, 
      timestamp: new Date(),
      duration
    };
  }

  //send notification by notification service
  async sendNotification(config, workflow) {
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003';
    
    try {
      const response = await axios.post(`${notificationUrl}/api/notifications/send`, {
        userId: workflow.createdBy,
        message: config.message,
        type: config.type || 'system',
        metadata: {
          workflowId: workflow._id,
          workflowName: workflow.name
        }
      }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      return { sent: true, message: config.message, response: response.data };
    } catch (error) {
      throw new Error(`Notification failed: ${error.message}`);
    }
  }

  //call external webhook
  async callWebhook(config) {
    try {
      const response = await axios({
        method: config.method || 'POST',
        url: config.url,
        data: config.data || {},
        headers: config.headers || { 'Content-Type': 'application/json' },
        timeout: config.timeout || 10000
      });
      
      return { 
        webhookResponse: response.data, 
        status: response.status,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Webhook failed: ${error.message}`);
    }
  }

  //delay execution

  async delay(config) {
    const delayMs = (config.duration || 1) * 1000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return { delayed: true, duration: config.duration, until: new Date() };
  }
  async evaluateCondition(config, workflow) {
    const condition = config.condition;
    if (condition === 'always_true') {
      return { passed: true };
    }
    if (condition === 'always_false') {
      return { passed: false };
    }
    return { passed: true, evaluated: condition };
  }

  async executeParallelSteps(config, workflow) {
    const steps = config.steps || [];
    const results = await Promise.all(
      steps.map(step => this.executeTask(step))
    );
    return { parallel: true, results };
  }

  //emit Kafka event
  async emitEvent(type, data) {
    if (this.kafkaProducer) {
      await this.kafkaProducer.send({
        topic: 'workflow-events',
        messages: [{
          value: JSON.stringify({
            type,
            ...data,
            timestamp: new Date().toISOString(),
            source: 'workflow-service'
          })
        }]
      });
    }
  }
}

module.exports = WorkflowEngine;