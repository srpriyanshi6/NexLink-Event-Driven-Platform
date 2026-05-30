const nodemailer = require('nodemailer');

//email Service for sending notifications
 //supports SMTP, SendGrid, and AWS SES
class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    //configure based on environment
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else if (process.env.SENDGRID_API_KEY) {
      this.transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else {
      //development fallback
       //log emails instead of sending
      console.log('No email configuration found, emails will be logged');
      this.transporter = {
        sendMail: (mailOptions) => {
          console.log('EMAIL (dev mode):', {
            to: mailOptions.to,
            subject: mailOptions.subject,
            html: mailOptions.html?.substring(0, 200)
          });
          return Promise.resolve({ messageId: 'dev-mode' });
        }
      };
    }
  }

  //send email notification
  async sendEmail(to, subject, html, options = {}) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@nexlink-platform.com',
        to,
        subject,
        html,
        ...options
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('email send failed:', error);
      throw new Error(`email delivery failed: ${error.message}`);
    }
  }

  //send welcome email template
  async sendWelcomeEmail(to, name) {
    const subject = 'Welcome to NexLink Platform!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">Welcome to NexLink, ${name}! </h1>
        <p>We're excited to have you on board. NexLink is a powerful event-driven platform that helps you automate workflows and manage your business processes.</p>
        <h2>Getting Started</h2>
        <ul>
          <li>Complete your profile</li>
          <li>Create your first workflow</li>
          <li>Explore the GraphQL API</li>
        </ul>
        <p>Need help? Check out our documentation or contact support.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">© 2024 NexLink Platform. All rights reserved.</p>
      </div>
    `;
    
    return this.sendEmail(to, subject, html);
  }

  //send workflow completion email
  async sendWorkflowCompleteEmail(to, workflowName, workflowId) {
    const subject = `Workflow "${workflowName}" Completed`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10B981;">Workflow Completed. </h1>
        <p>Your workflow <strong>${workflowName}</strong> has been completed successfully.</p>
        <p>Workflow ID: ${workflowId}</p>
        <div style="background-color: #F3F4F6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;">View results in your dashboard or GraphQL playground.</p>
        </div>
        <a href="${process.env.APP_URL}/workflows/${workflowId}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Workflow</a>
        <hr>
        <p style="color: #666; font-size: 12px;">© 2024 NexLink Platform</p>
      </div>
    `;
    
    return this.sendEmail(to, subject, html);
  }

  //send workflow failure alert
  async sendWorkflowFailureEmail(to, workflowName, workflowId, error) {
    const subject = `Workflow "${workflowName}" Failed`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #EF4444;">Workflow Failed. </h1>
        <p>Your workflow <strong>${workflowName}</strong> has failed.</p>
        <div style="background-color: #FEE2E2; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #991B1B;"><strong>Error:</strong> ${error}</p>
        </div>
        <p>Please check the logs and retry the workflow.</p>
        <a href="${process.env.APP_URL}/workflows/${workflowId}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Details</a>
        <hr>
        <p style="color: #666; font-size: 12px;">© 2024 NexLink Platform</p>
      </div>
    `;
    
    return this.sendEmail(to, subject, html);
  }
}

module.exports = EmailService;