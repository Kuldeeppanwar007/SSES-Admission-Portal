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

module.exports = { sendPriorityAlert };
