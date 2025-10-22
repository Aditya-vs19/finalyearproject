import { validateRegistrationPayload } from '../utils/enrollmentValidation.js';

export const validateRegistrationInput = (req, res, next) => {
  const { data, errors } = validateRegistrationPayload(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ message: errors[0], errors });
  }

  req.registrationInput = data;
  return next();
};
