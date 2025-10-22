import CryptoJS from 'crypto-js';

const DEFAULT_SALT = 'gp-connect-chat-salt';

const toStringId = (value) => (typeof value === 'string' ? value : value?.toString?.() || '');

const getSalt = () => {
  const raw = import.meta.env.VITE_CHAT_SECRET_SALT || DEFAULT_SALT;
  return CryptoJS.enc.Utf8.parse(raw);
};

const buildConversationFingerprint = (conversationId, userId, otherUserId) => {
  const sortedParticipants = [toStringId(userId), toStringId(otherUserId)]
    .filter(Boolean)
    .sort()
    .join('::');
  return `${sortedParticipants}::${toStringId(conversationId)}`;
};

const deriveMaterial = (conversationId, userId, otherUserId) => {
  const fingerprint = buildConversationFingerprint(conversationId, userId, otherUserId);
  return CryptoJS.PBKDF2(fingerprint, getSalt(), {
    keySize: 256 / 32,
    iterations: 4096,
    hasher: CryptoJS.algo.SHA512,
  });
};

const deriveKeys = (material) => {
  const hex = material.toString(CryptoJS.enc.Hex);
  const encryptionKey = CryptoJS.SHA256(`enc::${hex}`);
  const authKey = CryptoJS.SHA256(`auth::${hex}`);
  return { encryptionKey, authKey };
};

const computeAuthTag = (message, authKey) => {
  if (!authKey) {
    return null;
  }
  const payload = CryptoJS.enc.Utf8.parse(message);
  const tag = CryptoJS.HmacSHA256(payload, authKey);
  return CryptoJS.enc.Base64.stringify(tag);
};

export const encryptConversationPayload = ({
  conversationId,
  userId,
  otherUserId,
  payload,
}) => {
  const material = deriveMaterial(conversationId, userId, otherUserId);
  const { encryptionKey, authKey } = deriveKeys(material);

  const iv = CryptoJS.lib.WordArray.random(16);
  const plaintext = CryptoJS.enc.Utf8.parse(JSON.stringify(payload));
  const encrypted = CryptoJS.AES.encrypt(plaintext, encryptionKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const ciphertextB64 = CryptoJS.enc.Base64.stringify(encrypted.ciphertext);
  const ivB64 = CryptoJS.enc.Base64.stringify(iv);
  const tag = computeAuthTag(`${ciphertextB64}.${ivB64}`, authKey);

  return {
    ciphertext: ciphertextB64,
    nonce: ivB64,
    authTag: tag,
  };
};

export const decryptConversationPayload = ({
  conversationId,
  userId,
  otherUserId,
  ciphertext,
  nonce,
  authTag,
}) => {
  if (!ciphertext || !nonce) {
    return null;
  }

  const material = deriveMaterial(conversationId, userId, otherUserId);
  const { encryptionKey, authKey } = deriveKeys(material);
  const iv = CryptoJS.enc.Base64.parse(nonce);
  const ciphertextWords = CryptoJS.enc.Base64.parse(ciphertext);

  if (authTag) {
    const expected = computeAuthTag(
      `${ciphertext}.${nonce}`,
      authKey
    );
    if (expected !== authTag) {
      throw new Error('Failed to verify message authenticity');
    }
  }

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: ciphertextWords },
    encryptionKey,
    {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  );

  const text = CryptoJS.enc.Utf8.stringify(decrypted);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { text };
  }
};

export const buildPreview = (value) => {
  if (!value) {
    return '';
  }
  const text = value.toString().replace(/\s+/g, ' ').trim();
  if (text.length <= 120) {
    return text;
  }
  return `${text.slice(0, 117)}...`;
};
