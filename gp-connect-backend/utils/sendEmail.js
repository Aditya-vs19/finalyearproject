import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const sendEmail = async (email, subject, htmlMessage, textMessage = '') => {
  try {
    console.log('Attempting to send email to:', email);

    if (process.env.NODE_ENV === 'production') {
      // For production on cloud platforms, use a more reliable approach
      // Try SMTP first, but fallback gracefully if it fails
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
          // Shorter timeouts for faster failure detection
          connectionTimeout: 10000, // 10 seconds
          greetingTimeout: 5000, // 5 seconds  
          socketTimeout: 10000, // 10 seconds
        });

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: subject,
          html: htmlMessage,
          text: textMessage || undefined,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully via SMTP!');
        console.log('Message ID:', info.messageId);
        return true;

      } catch (smtpError) {
        console.log('SMTP failed, using fallback method:', smtpError.message);

        // Fallback: Log the email content for manual delivery or webhook processing
        console.log('=== EMAIL FALLBACK ===');
        console.log('To:', email);
        console.log('Subject:', subject);
        console.log('HTML Content:', htmlMessage);
        console.log('=== END EMAIL ===');

        // In a real production app, you could:
        // 1. Queue the email for later retry
        // 2. Use a webhook to external email service
        // 3. Store in database for manual processing

        return true; // Return success to not block user registration
      }
    } else {
      // Local development - use Gmail
      const transporter = nodemailer.createTransport({
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
      console.log('Email sent successfully!');
      console.log('Message ID:', info.messageId);
      return true;
    }
  } catch (error) {
    console.error('Error in email service:', error);

    if (process.env.NODE_ENV === 'production') {
      // In production, don't fail registration due to email issues
      console.log('Email service failed, but allowing registration to continue');
      return true;
    } else {
      // In development, throw error to help with debugging
      throw new Error('Failed to send email');
    }
  }
};

export default sendEmail;