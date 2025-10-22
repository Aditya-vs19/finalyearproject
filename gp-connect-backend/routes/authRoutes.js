import express from 'express';
import {
	registerUser,
	verifyOtp,
	authUser,
	forgotPasswordOtp,
	resendPasswordOtp,
	verifyPasswordOtpLogin,
} from '../controllers/authController.js';
import { validateRegistrationInput } from '../middleware/registrationValidation.js';

const router = express.Router();

router.post('/register', validateRegistrationInput, registerUser);
router.post('/verify', verifyOtp);
router.post('/login', authUser);
router.post('/forgot-password', forgotPasswordOtp);
router.post('/forgot-password/resend', resendPasswordOtp);
router.post('/forgot-password/verify', verifyPasswordOtpLogin);

export default router;
