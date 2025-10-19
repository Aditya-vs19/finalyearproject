import crypto from 'crypto';

export const OTP_LENGTH = 6;

export const generateOtp = () => {
  const randomNumber = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return randomNumber.toString().padStart(OTP_LENGTH, '0');
};

export const hashOtp = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

export const constantTimeEquals = (a, b) => {
  if (!a || !b) {
    return false;
  }

  try {
    const bufferA = Buffer.from(a, 'hex');
    const bufferB = Buffer.from(b, 'hex');

    if (bufferA.length !== bufferB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch (error) {
    return false;
  }
};
