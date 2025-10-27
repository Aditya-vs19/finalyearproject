import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const sendEmail = async (email, subject, htmlMessage, textMessage = '') => {
  try {
    console.log('Attempting to send email to:', email);

    // Option 1: SendGrid (Free tier: 100 emails/day)
    if (process.env.SENDGRID_API_KEY) {
      console.log('Using SendGrid API...');
      
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: email }],
            subject: subject
          }],
          from: { 
            email: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourdomain.com',
            name: 'GP-Connect'
          },
          content: [
            {
              type: 'text/html',
              value: htmlMessage
            },
            ...(textMessage ? [{
              type: 'text/plain',
              value: textMessage
            }] : [])
          ]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
      }

      console.log('Email sent successfully via SendGrid!');
      return true;
    }

    // Option 2: Brevo (formerly Sendinblue) - Free tier: 300 emails/day
    if (process.env.BREVO_API_KEY) {
      console.log('Using Brevo API...');
      
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: 'GP-Connect',
            email: process.env.BREVO_FROM_EMAIL || 'noreply@yourdomain.com'
          },
          to: [{ email: email }],
          subject: subject,
          htmlContent: htmlMessage,
          textContent: textMessage || undefined
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brevo API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Email sent successfully via Brevo!');
      console.log('Message ID:', result.messageId);
      return true;
    }

    // Option 3: Mailgun (Free tier: 5000 emails/month for 3 months)
    if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      console.log('Using Mailgun API...');
      
      const formData = new FormData();
      formData.append('from', `GP-Connect <noreply@${process.env.MAILGUN_DOMAIN}>`);
      formData.append('to', email);
      formData.append('subject', subject);
      formData.append('html', htmlMessage);
      if (textMessage) formData.append('text', textMessage);

      const response = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mailgun API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Email sent successfully via Mailgun!');
      console.log('Message ID:', result.id);
      return true;
    }

    // Fallback to Gmail SMTP (will likely fail on cloud platforms)
    console.log('Using Gmail SMTP fallback...');
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: htmlMessage,
      text: textMessage || undefined,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully via Gmail SMTP!');
    console.log('Message ID:', info.messageId);
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

export default sendEmail;