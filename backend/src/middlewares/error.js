const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.locals.errorMessage = message;
  res.status(status).json({
    message,
    error: process.env.NODE_ENV === 'production' ? null : err.toString()
  });
};

module.exports = errorHandler;
