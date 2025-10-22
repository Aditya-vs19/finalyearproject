// Copy this file to config.js and update the values

export const config = {
  NODE_ENV: 'development',
  PORT: 5000,
  MONGO_URI: 'mongodb://localhost:27017/gp-connect',
  JWT_SECRET: 'your_jwt_secret_key_here_make_it_long_and_secure',
  CHAT_SECRET: 'shared_chat_secret_used_for_client_encryption',
  EMAIL_HOST: 'smtp.gmail.com',
  EMAIL_PORT: 587,
  EMAIL_USER: 'your_email@gmail.com',
  EMAIL_PASS: 'your_app_password',
  REDIS_URL: 'redis://localhost:6379'
};

