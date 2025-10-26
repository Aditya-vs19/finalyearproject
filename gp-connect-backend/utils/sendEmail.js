import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const sendEmail = async (email, subject, htmlMessage, textMessage = '') => {
  try {
    console.log('Attempting to send email to:', email);

    let transporter;
    
    if (process.env.NODE_ENV === 'production') {
      // Use Gmail with App Password for production (more reliable than Ethereal)
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('Email credentials not configured for production');
        throw new Error('Email service not configured');
      }
      
      transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        // Add timeout and connection settings for better reliability
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000, // 30 seconds
        socketTimeout: 60000, // 60 seconds
      });
      
      console.log('Using Gmail SMTP for production email sending');
    } else {
      // Local development - use Gmail
      transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    }

    // Email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: htmlMessage,
      text: textMessage || undefined,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

export default sendEmail;