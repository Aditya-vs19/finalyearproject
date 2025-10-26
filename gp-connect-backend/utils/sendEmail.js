import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const sendEmail = async (email, subject, htmlMessage, textMessage = '') => {
  try {
    console.log('Attempting to send email to:', email);

    // For production, we'll create a test account that works with cloud hosting
    let transporter;
    
    if (process.env.NODE_ENV === 'production') {
      // Use Ethereal for testing in production (creates a test account)
      const testAccount = await nodemailer.createTestAccount();
      
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      
      console.log('Using Ethereal test account for email sending');
    } else {
      // Local development - use Gmail
      transporter = nodemailer.createTransport({
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
    
    if (process.env.NODE_ENV === 'production') {
      console.log('Preview URL: ' + nodemailer.getTestMessageUrl(info));
      console.log('Email sent to test account - check logs for preview URL');
    }
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

export default sendEmail;
