const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendPriorityAlert = async ({ studentName, fatherName, track, mobileNo, subject, status, recipients }) => {
  if (!recipients || recipients.length === 0) return;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; border-radius: 10px; overflow: hidden; border: 1px solid #e0e0e0;">
      
      <div style="background: linear-gradient(135deg, #7c3aed, #5b21b6); padding: 28px 32px;">
        <h1 style="color: #fff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">
          ⚡ Priority Student Alert
        </h1>
        <p style="color: #ddd6fe; margin: 6px 0 0; font-size: 13px;">SSES Admission Portal — Track Notification</p>
      </div>

      <div style="padding: 28px 32px; background: #fff;">
        <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">
          A student in your track has been marked as <strong style="color: #7c3aed;">Priority</strong>. Please follow up at the earliest.
        </p>

        <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; border-radius: 6px; padding: 18px 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; width: 140px;">Student Name</td>
              <td style="padding: 6px 0; font-weight: 600;">${studentName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Father's Name</td>
              <td style="padding: 6px 0;">${fatherName || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Track</td>
              <td style="padding: 6px 0;">${track || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Mobile No.</td>
              <td style="padding: 6px 0;">${mobileNo || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Subject</td>
              <td style="padding: 6px 0;">${subject || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Current Status</td>
              <td style="padding: 6px 0;">
                <span style="background: #ede9fe; color: #6d28d9; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;">${status || '—'}</span>
              </td>
            </tr>
          </table>
        </div>

        <p style="color: #6b7280; font-size: 13px; margin: 0;">
          Please log in to the <strong>SSES Admission Portal</strong> to view full details and take necessary action.
        </p>
      </div>

      <div style="background: #f3f4f6; padding: 16px 32px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          This is an automated notification from SSES Admission Portal. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"SSES Admission Portal" <${process.env.MAIL_USER}>`,
    to: recipients.join(', '),
    subject: `⚡ Priority Alert: ${studentName} — ${track} Track`,
    html,
  });
};

const sendOtpEmail = async ({ email, otp, name }) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Secure Verification Code</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #f8fafc;
          font-family: 'Outfit', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 580px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
        }
        .header {
          background: linear-gradient(135deg, #f97316, #ea580c);
          padding: 32px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .header p {
          color: #ffedd5;
          margin: 8px 0 0;
          font-size: 14px;
          font-weight: 500;
        }
        .body-content {
          padding: 40px 32px;
          color: #334155;
          line-height: 1.6;
        }
        .greeting {
          font-size: 18px;
          font-weight: 700;
          margin-top: 0;
          margin-bottom: 12px;
          color: #1e293b;
        }
        .text {
          font-size: 15px;
          margin-bottom: 24px;
        }
        .otp-card {
          background-color: #fff7ed;
          border: 2px dashed #f97316;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          margin: 32px 0;
        }
        .otp-code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 38px;
          font-weight: 800;
          letter-spacing: 8px;
          color: #ea580c;
          margin: 0;
        }
        .otp-expiry {
          font-size: 12px;
          color: #c2410c;
          margin-top: 8px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .divider {
          border: 0;
          border-top: 1px solid #e2e8f0;
          margin: 24px 0;
        }
        .security-note {
          font-size: 13px;
          color: #64748b;
          background-color: #f1f5f9;
          border-left: 4px solid #94a3b8;
          padding: 12px 16px;
          border-radius: 4px;
          margin-top: 24px;
        }
        .footer {
          background-color: #f8fafc;
          padding: 24px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          color: #94a3b8;
          font-size: 12px;
          margin: 0 0 6px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔑 Secure Verification Code</h1>
          <p>SSES Admission Portal — Auth Service</p>
        </div>
        <div class="body-content">
          <p class="greeting">Hello ${name},</p>
          <p class="text">
            A request was made to log in to your account on the <strong>SSES Admission Portal</strong>. Use the secure verification code below to authorize this session.
          </p>
          
          <div class="otp-card">
            <div class="otp-code">${otp}</div>
            <div class="otp-expiry">Valid for 10 minutes only</div>
          </div>
          
          <div class="security-note">
            <strong>🔒 Security Reminder:</strong> For your security, never share this OTP with anyone, including SSES administrators. If you did not request this verification, please ignore this email.
          </div>
          
          <hr class="divider">
          
          <p style="font-size: 13px; color: #64748b; margin: 0;">
            Need help? Please contact your system administrator or IT helpdesk.
          </p>
        </div>
        <div class="footer">
          <p>© 2026 SSES Admission Portal. All rights reserved.</p>
          <p>This is an automated security transmission. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"SSES Admission Portal" <${process.env.MAIL_USER}>`,
    to: email,
    subject: `🔑 ${otp} is your SSES Admission Portal Login Code`,
    html,
  });
};

module.exports = { sendPriorityAlert, sendOtpEmail };
