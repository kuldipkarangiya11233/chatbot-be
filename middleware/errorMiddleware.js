// Middleware for handling "Not Found" errors (e.g., for undefined routes)
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error); // Pass the error to the next error-handling middleware
};

// General error handling middleware
// This will catch any errors passed by `next(error)` or thrown in async handlers
const errorHandler = (err, req, res, next) => {
  // Determine the status code: if res.statusCode is already set (and not 200), use it, otherwise use 500 (Internal Server Error)
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  // Send a JSON response with the error message
  // In production, you might not want to send the stack trace
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { notFound, errorHandler };