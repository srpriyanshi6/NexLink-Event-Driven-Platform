const { AnalyticsEvent, DailyMetrics } = require('../models/Analytics');
const moment = require('moment');

//metrics Aggregator Service
 //handles real-time and batch metrics aggregation
class MetricsAggregator {
  constructor() {
    this.eventHandlers = {
      USER_CREATED: this.handleUserCreated.bind(this),
      WORKFLOW_CREATED: this.handleWorkflowCreated.bind(this),
      WORKFLOW_COMPLETED: this.handleWorkflowCompleted.bind(this),
      WORKFLOW_FAILED: this.handleWorkflowFailed.bind(this),
      NOTIFICATION_SENT: this.handleNotificationSent.bind(this)
    };
  }

  //process incoming analytics event
  async processEvent(event) {
    try {
      // Store raw event
      const analyticsEvent = new AnalyticsEvent({
        eventType: event.type,
        userId: event.userId,
        workflowId: event.workflowId,
        data: event,
        metadata: {
          source: event.source,
          version: event.version,
          processingTime: new Date()
        },
        timestamp: event.timestamp || new Date()
      });
      
      await analyticsEvent.save();
      
      //update real time metrics
      const handler = this.eventHandlers[event.type];
      if (handler) {
        await handler(event);
      }
      
      console.log(`Analytics recorded: ${event.type}`);
    } catch (error) {
      console.error('Failed to process analytics event:', error);
    }
  }

  //Handle USER_CREATED event
  async handleUserCreated(event) {
    const today = moment().format('YYYY-MM-DD');
    
    await DailyMetrics.findOneAndUpdate(
      { date: today },
      {
        $inc: {
          'metrics.users.total': 1,
          'metrics.users.new': 1
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, new: true }
    );
  }

  //handle WORKFLOW_CREATED event
  async handleWorkflowCreated(event) {
    const today = moment().format('YYYY-MM-DD');
    
    await DailyMetrics.findOneAndUpdate(
      { date: today },
      {
        $inc: {
          'metrics.workflows.total': 1,
          'metrics.workflows.created': 1
        }
      },
      { upsert: true }
    );
  }

  //handle WORKFLOW_COMPLETED event
  async handleWorkflowCompleted(event) {
    const today = moment().format('YYYY-MM-DD');
    
    //get current metrics to calculate average
    const metrics = await DailyMetrics.findOne({ date: today });
    const currentTotal = metrics?.metrics.workflows.completed || 0;
    const currentAvg = metrics?.metrics.workflows.averageExecutionTime || 0;
    
    //calculate new average
    const newAvg = (currentAvg * currentTotal + (event.executionTime || 0)) / (currentTotal + 1);
    
    await DailyMetrics.findOneAndUpdate(
      { date: today },
      {
        $inc: { 'metrics.workflows.completed': 1 },
        $set: { 'metrics.workflows.averageExecutionTime': newAvg }
      },
      { upsert: true }
    );
  }

  //handle WORKFLOW_FAILED event
  async handleWorkflowFailed(event) {
    const today = moment().format('YYYY-MM-DD');
    
    await DailyMetrics.findOneAndUpdate(
      { date: today },
      { $inc: { 'metrics.workflows.failed': 1 } },
      { upsert: true }
    );
  }

  //handle NOTIFICATION_SENT event
  async handleNotificationSent(event) {
    const today = moment().format('YYYY-MM-DD');
    const delivered = event.delivered === true ? 1 : 0;
    const failed = event.delivered === false ? 1 : 0;
    
    await DailyMetrics.findOneAndUpdate(
      { date: today },
      {
        $inc: {
          'metrics.notifications.total': 1,
          'metrics.notifications.delivered': delivered,
          'metrics.notifications.failed': failed
        }
      },
      { upsert: true }
    );
  }

  //get analytics for a user
  async getUserAnalytics(userId, days = 30) {
    const startDate = moment().subtract(days, 'days').startOf('day');
    
    const [workflows, events, activity] = await Promise.all([
      AnalyticsEvent.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId), eventType: /WORKFLOW/ } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } }
      ]),
      AnalyticsEvent.countDocuments({ 
        userId: mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate.toDate() }
      }),
      AnalyticsEvent.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $limit: 30 }
      ])
    ]);
    
    const workflowStats = {};
    workflows.forEach(w => { workflowStats[w._id] = w.count; });
    
    return {
      user: { id: userId },
      period: { days, startDate: startDate.toISOString() },
      workflows: {
        total: workflowStats.WORKFLOW_CREATED || 0,
        completed: workflowStats.WORKFLOW_COMPLETED || 0,
        failed: workflowStats.WORKFLOW_FAILED || 0,
        completionRate: ((workflowStats.WORKFLOW_COMPLETED || 0) / (workflowStats.WORKFLOW_CREATED || 1)) * 100
      },
      activity: {
        totalEvents: events,
        dailyBreakdown: activity.map(a => ({ date: a._id, events: a.count }))
      }
    };
  }

  //get system-wide metrics
  async getSystemMetrics(days = 7) {
    const startDate = moment().subtract(days, 'days').startOf('day');
    
    const [dailyMetrics, totals, workflowTrend] = await Promise.all([
      DailyMetrics.find({ 
        date: { $gte: startDate.format('YYYY-MM-DD') }
      }).sort({ date: -1 }),
      AnalyticsEvent.aggregate([
        { $match: { timestamp: { $gte: startDate.toDate() } } },
        { $group: { 
          _id: '$eventType',
          count: { $sum: 1 }
        } }
      ]),
      AnalyticsEvent.aggregate([
        { $match: { eventType: 'WORKFLOW_CREATED', timestamp: { $gte: startDate.toDate() } } },
        { $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        } },
        { $sort: { _id: 1 } }
      ])
    ]);
    
    const totalEvents = {};
    totals.forEach(t => { totalEvents[t._id] = t.count; });
    
    return {
      period: { days, startDate: startDate.toISOString() },
      summary: {
        totalUsers: dailyMetrics[0]?.metrics.users.total || 0,
        totalWorkflows: dailyMetrics[0]?.metrics.workflows.total || 0,
        workflowsCompleted: totalEvents.WORKFLOW_COMPLETED || 0,
        workflowsFailed: totalEvents.WORKFLOW_FAILED || 0,
        notificationsSent: totalEvents.NOTIFICATION_SENT || 0
      },
      trends: {
        workflowsCreated: workflowTrend,
        daily: dailyMetrics
      },
      performance: {
        averageWorkflowExecutionTime: dailyMetrics[0]?.metrics.workflows.averageExecutionTime || 0,
        completionRate: ((totalEvents.WORKFLOW_COMPLETED || 0) / (totalEvents.WORKFLOW_CREATED || 1)) * 100
      }
    };
  }

  //get real-time dashboard metrics
  async getRealtimeMetrics() {
    const lastHour = moment().subtract(1, 'hour');
    
    const [recentEvents, workflowStats] = await Promise.all([
      AnalyticsEvent.countDocuments({ timestamp: { $gte: lastHour.toDate() } }),
      AnalyticsEvent.aggregate([
        { $match: { eventType: /WORKFLOW/, timestamp: { $gte: lastHour.toDate() } } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } }
      ])
    ]);
    
    const stats = {};
    workflowStats.forEach(s => { stats[s._id] = s.count; });
    
    return {
      timestamp: new Date().toISOString(),
      lastHour: {
        events: recentEvents,
        workflows: {
          created: stats.WORKFLOW_CREATED || 0,
          completed: stats.WORKFLOW_COMPLETED || 0,
          failed: stats.WORKFLOW_FAILED || 0
        }
      },
      activeUsers: await this.getActiveUsersCount()
    };
  }

  //get active users count (users with events in last 24 hours)
  async getActiveUsersCount() {
    const last24h = moment().subtract(24, 'hours');
    
    const activeUsers = await AnalyticsEvent.distinct('userId', {
      timestamp: { $gte: last24h.toDate() }
    });
    
    return activeUsers.length;
  }
}

module.exports = MetricsAggregator;