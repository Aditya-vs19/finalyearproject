import jwt from 'jsonwebtoken';

const generateToken = (id, options = {}) => {
  const { expiresIn = '1h', payload = {} } = options;
  const secret = process.env.JWT_SECRET || 'fallback_jwt_secret_key_for_development_only';
  return jwt.sign({ id, ...payload }, secret, {
    expiresIn,
  });
};

export default generateToken;
