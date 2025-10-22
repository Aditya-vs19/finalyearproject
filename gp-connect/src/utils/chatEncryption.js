import CryptoJS from 'crypto-js';

const resolveSecret = () => {
  const secret = import.meta.env.VITE_CHAT_SECRET || import.meta.env.REACT_APP_CHAT_SECRET;
  if (!secret) {
    throw new Error('Missing chat secret. Set VITE_CHAT_SECRET in your environment.');
  }
  return secret;
};

export const encryptMessage = (plainText) => {
  const trimmed = (plainText ?? '').toString();
  if (!trimmed.trim()) {
    throw new Error('Message cannot be empty');
  }
  const secret = resolveSecret();
  return CryptoJS.AES.encrypt(trimmed, secret).toString();
};

export const decryptMessage = (cipherText) => {
  try {
    const secret = resolveSecret();
    const bytes = CryptoJS.AES.decrypt(cipherText || '', secret);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    return result || '';
  } catch (error) {
    return '';
  }
};
