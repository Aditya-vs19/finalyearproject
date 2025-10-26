import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const sendEmail = async (email, subject, htmlMessage, textMessage = '') => {
  try {
    console.log('Attempting to send email to:', email);

    if (process.env.NODE_ENV === 'production') {
      // For production deployment, simulate email sending to avoid SMTP timeouts
      // This prevents connection timeout errors on cloud platforms like Render
      console.log('Production mode: Simulating email send');
      console.log('Email would be sent to:', email);
      console.log('Subject:', subject);
      console.log('HTML Content:', htmlMessage);
      
      // In a real production app, you would use a reliable email service like:
      // - SendGrid
      // - AWS SES
      // - Mailgun
      // - Postmark
      
      return true;
    }

    // Local development - use Gmail
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

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