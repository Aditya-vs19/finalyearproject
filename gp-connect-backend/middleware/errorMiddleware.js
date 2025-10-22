const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  if (process.env.NODE_ENV !== 'test') {
    console.error(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`,
      err.stack
    );
  }
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

export { notFound, errorHandler };
