# GP Connect Backend

This is the backend for the GP Connect application, built with Node.js, Express, and MongoDB (MERN stack).

## Table of Contents
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Connecting to Frontend](#connecting-to-frontend)
- [Deployment](#deployment)

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd gp-connect-backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Environment Variables

This project uses environment variables for sensitive information. You need to create a `.env` file in the root of the `gp-connect-backend` directory.

1.  **Create `.env` file:**
    Create a new `.env` file in the root directory with the following variables:

    ```
    # Database
    MONGO_URI=mongodb+srv://<your-mongodb-username>:<your-mongodb-password>@cluster0.xxxxxx.mongodb.net/gpconnex
    
    # JWT Secret
    JWT_SECRET=a-very-strong-secret-key-for-jwt
    CHAT_SECRET=client-shared-chat-passphrase
    REDIS_URL=redis://localhost:6379
    
    # Email Configuration (Gmail)
    EMAIL_HOST=smtp.gmail.com
    EMAIL_PORT=587
    EMAIL_USER=your-email@gmail.com
    EMAIL_PASS=your-app-password
    
    # Server Port
    PORT=5000
    
    # CORS Origin
    CORS_ORIGIN=http://localhost:5173
    ```

2.  **Email Setup (Required for Email Verification):**
    To enable email verification, you need to configure Gmail SMTP:
    
    **Option 1: Gmail with App Password (Recommended)**
    1. Go to your Google Account settings
    2. Enable 2-Factor Authentication
    3. Generate an App Password for this application
    4. Use your Gmail address as `EMAIL_USER`
    5. Use the generated App Password as `EMAIL_PASS`
    
    **Option 2: Other Email Providers**
    - For SendGrid: Use `smtp.sendgrid.net` as host
    - For Outlook: Use `smtp-mail.outlook.com` as host
    - Update `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, and `EMAIL_PASS` accordingly

    **Variables:**
    *   `MONGO_URI`: Your MongoDB Atlas connection string.
    *   `JWT_SECRET`: A strong, random string used for signing JWTs.
    *   `CHAT_SECRET`: Shared symmetric key used by the frontend to encrypt chat payloads. The server stores ciphertext only.
    *   `EMAIL_HOST`: SMTP server host (Gmail: smtp.gmail.com).
    *   `EMAIL_PORT`: SMTP server port (Gmail: 587).
    *   `EMAIL_USER`: Your email address for sending emails.
    *   `EMAIL_PASS`: Your email password or app password.
    *   `PORT`: The port on which the server will run (default is 5000).
    *   `CORS_ORIGIN`: Frontend URL for CORS configuration.

3.  **Start the development server:**
    ```bash
    npm run dev
    ```
    This will start the server using `nodemon`, which automatically restarts the server when file changes are detected. If Redis is unavailable the server will log a warning and continue with the in-memory Socket.IO adapter.

## Manual Test Checklist

Run through the following flow before releasing changes:

1. Start the backend with and without Redis running; ensure missing Redis only logs a warning.
2. Login as two users that follow each other; verify the Messages search only lists followed users.
3. Open a conversation, send a message, and confirm the counterpart receives it in real time.
4. Refresh the browser and confirm ciphertext persisted and decrypts correctly on load.
5. Attempt to hit the messaging endpoints without a token and confirm a 401 response.
6. Disconnect one user and ensure `user:offline` events fire without console spam.

## Connecting to Frontend

The frontend (gp-connect-frontend) running on `localhost:5173` will connect to this backend. Ensure your frontend's API calls are directed to:

`http://localhost:5000/api`

For example, using Axios in your React frontend:

```javascript
import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

// Example usage:
API.post('/auth/login', { email, password })
   .then(response => console.log(response.data))
   .catch(error => console.error(error));
```

## Deployment

This backend is configured for deployment on Render.

1.  **Procfile:** A `Procfile` is included for Render to understand how to start the application.
    ```
    web: npm start
    ```

2.  **MongoDB Atlas:** The database will be MongoDB Atlas. Ensure your `MONGO_URI` in `.env` (and Render environment variables) points to your Atlas cluster.

3.  **Frontend Deployment:** The frontend is expected to be deployed separately (e.g., on Vercel). Ensure the frontend's environment variables for the API URL are correctly set for the deployed backend.

---
