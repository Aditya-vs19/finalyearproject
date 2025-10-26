import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const sendEmail = async (email, subject, htmlMessage, textMessage = '') => {
  try {
    console.log('Attempting to send email to:', email);

    if (process.env.NODE_ENV === 'production' && process.env.SENDGRID_API_KEY) {
      // Use SendGrid for production
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER,
          name: 'GP-Connect'
        },
        subject: subject,
        html: htmlMessage,
        text: textMessage || undefined,
      };

      try {
        const response = await sgMail.send(msg);
        console.log('Email sent successfully via SendGrid!');
        console.log('SendGrid Response:', response[0].statusCode);
        return true;
      } catch (sendGridError) {
        console.error('SendGrid error:', sendGridError.response?.body || sendGridError.message);
        throw sendGridError;
      }
    } else if (process.env.NODE_ENV === 'production') {
      // Production fallback without SendGrid - try Gmail SMTP with short timeout
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
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
        console.log('Email sent successfully via Gmail SMTP!');
        console.log('Message ID:', info.messageId);
        return true;
        
      } catch (smtpError) {
        console.log('SMTP failed, using fallback method:', smtpError.message);
        
        // Fallback: Log the email content
        console.log('=== EMAIL FALLBACK ===');
        console.log('To:', email);
        console.log('Subject:', subject);
        console.log('HTML Content:', htmlMessage);
        console.log('=== END EMAIL ===');
        
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
      console.log('Email sent successfully in development!');
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