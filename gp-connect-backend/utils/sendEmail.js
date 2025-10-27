import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Brevo
const apiInstance = new TransactionalEmailsApi();
apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

const sendEmail = async (email, subject, htmlMessage, textMessage = '') => {
  try {
    console.log('Attempting to send email via Brevo...');
    console.log('Sending to:', email);
    
    const sendSmtpEmail = {
      to: [{ email: email }],
      sender: { 
        email: process.env.EMAIL_USER || 'gpconnexx@gmail.com',
        name: 'GP-Connect'
      },
      subject: subject,
      htmlContent: htmlMessage,
      textContent: textMessage || undefined,
    };

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully via Brevo!');
    console.log('Message ID:', response.messageId);
    
    return true;
  } catch (error) {
    console.error('Brevo error:', error);
    if (error.response) {
      console.error('Brevo response:', error.response.text);
    }
    throw new Error('Failed to send email via Brevo');
  }
};

export default sendEmail;