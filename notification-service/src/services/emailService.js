const { Resend } = require('resend');
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.provider = 'none';
    this.initTransporter();
  }

  initTransporter() {
    // Priority 1: Resend 
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
      this.provider = 'resend';
      console.log('YAY RESEND : Resend configured for email service');
    } 
    // priority 2: SMTP (if resend fails then smtp)
    else if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      this.provider = 'smtp';
      console.log('SMTP configured for email service');
    } 
    // Fallback: Development mode (if both fail resend and smtp)
    else {
      console.log('No email configuration found, emails will be logged');
      this.provider = 'dev';
    }
  }

  async sendEmail(to, subject, html, options = {}) {
    try {
      //send via Resend
      if (this.provider === 'resend') {
        const { data, error } = await this.resend.emails.send({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev', 
          to: "sabpriyanshi0604@gmail.com", //to: my mail here acc to resend free tier rules i can only send to my mail id, for production we can switch to paid version of resend or use other providers like sendgrid maybe.
          subject: subject,
          html: html,
          ...options
        });

        if (error) throw error;
        
        console.log(`YAYY Email sent via Resend to ${to}: ${data.id}`);
        return { success: true, messageId: data.id, provider: 'resend', timestamp: new Date().toISOString() };
      } 
      
      // Send via SMTP
      else if (this.provider === 'smtp') {
        const mailOptions = {
          from: process.env.EMAIL_FROM || 'noreply@nexlink-platform.com',
          to,
          subject,
          html,
          ...options
        };
        
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`Email sent via SMTP to ${to}`);
        return { success: true, messageId: info.messageId, provider: 'smtp', timestamp: new Date().toISOString()};
      } 
      
      // Development mode
      else {
        console.log('\n[DEV MODE] Email would be sent:');
        console.log(`   To: ${to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Preview: ${html.substring(0, 200)}...\n`);
        return { success: true, messageId: `dev-${Date.now()}`, provider: 'dev', devMode: true,
          timestamp: new Date().toISOString() };
      }
      
    } catch (error) {
      console.error('SHITT Email send failed:', error.message);
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }

//send welcome email template
  async sendWelcomeEmail(to, name) {
    const subject = 'Welcome to NexLink Platform!';
    const html = `
       <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to NexLink</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            border-radius: 12px 12px 0 0;
          }
          .header h1 {
            color: white;
            margin: 0;
            font-size: 32px;
          }
          .content {
            background: white;
            padding: 40px 30px;
            border-radius: 0 0 12px 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 25px;
            display: inline-block;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #999;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 NexLink</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Event-Driven Automation Platform</p>
          </div>
          
          <div class="content">
            <h2 style="color: #333; margin-top: 0;">Welcome, ${name}! 👋</h2>
            <p style="color: #666; line-height: 1.6;">We're excited to have you on board. NexLink helps you automate workflows, manage notifications, and scale your business processes.</p>
            
            <h3 style="color: #444; margin-top: 30px;">Quick Start Guide</h3>
            <ul style="color: #666; line-height: 1.8;">
              <li>✓ Complete your profile setup</li>
              <li>✓ Create your first automated workflow</li>
              <li>✓ Explore the GraphQL API playground</li>
              <li>✓ Set up notification preferences</li>
            </ul>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${process.env.APP_URL || 'https://nexlink-platform.com'}/dashboard" 
                 class="button">
                Get Started →
              </a>
            </div>
            
            <div class="footer">
              <p>Need help? <a href="mailto:support@nexlink-platform.com" style="color: #667eea;">Contact Support</a></p>
              <p>© 2024 NexLink Platform. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(to, subject, html);
  }


  //send workflow completion email
  async sendWorkflowCompleteEmail(to, workflowName, workflowId) {
    const subject = `Workflow "${workflowName}" Completed`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Workflow Completed - NexLink</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: #10B981;
            padding: 30px;
            text-align: center;
            border-radius: 12px 12px 0 0;
          }
          .header h1 {
            color: white;
            margin: 0;
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 0 0 12px 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .info-box {
            background: #f0fdf4;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .button {
            background: #10B981;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 25px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Workflow Complete</h1>
          </div>
          <div class="content">
            <p style="color: #333; font-size: 18px;">Your workflow <strong>"${workflowName}"</strong> has been completed successfully!</p>
            
            <div class="info-box">
              <p style="margin: 0; color: #166534;"><strong>Workflow ID:</strong> ${workflowId}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/workflows/${workflowId}" class="button">
                View Workflow Details →
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              You're receiving this because you triggered a workflow on NexLink Platform.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(to, subject, html);
  }


  //send workflow failure alert
  async sendWorkflowFailureEmail(to, workflowName, workflowId, error) {
    const subject = `Workflow "${workflowName}" Failed`;
    const html = `
       <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Workflow Failed - NexLink</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: #EF4444;
            padding: 30px;
            text-align: center;
            border-radius: 12px 12px 0 0;
          }
          .header h1 {
            color: white;
            margin: 0;
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 0 0 12px 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .error-box {
            background: #FEF2F2;
            border-left: 4px solid #EF4444;
            padding: 15px;
            margin: 20px 0;
          }
          .warning-box {
            background: #FEF3C7;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .button {
            background: #EF4444;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 25px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Workflow Failed</h1>
          </div>
          <div class="content">
            <p style="color: #333; font-size: 18px;">Your workflow <strong>"${workflowName}"</strong> has failed.</p>
            
            <div class="error-box">
              <p style="margin: 0; color: #991B1B;"><strong>Error Details:</strong></p>
              <p style="margin: 10px 0 0; color: #7F1D1D; font-family: monospace; font-size: 14px;">${error}</p>
            </div>
            
            <div class="warning-box">
              <p style="margin: 0; color: #92400E;"><strong>Recommended Actions:</strong></p>
              <ul style="margin: 10px 0 0; color: #92400E;">
                <li>Check workflow configuration</li>
                <li>Verify external service connections</li>
                <li>Review error logs</li>
                <li>Retry the workflow after fixing issues</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/workflows/${workflowId}" class="button">
                Troubleshoot Workflow →
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(to, subject, html);
  }


}

module.exports = EmailService;