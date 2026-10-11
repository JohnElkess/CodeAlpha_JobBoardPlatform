module.exports = (err, req, res, next) => {
  if (err.name === 'MulterError') {
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'Resume must be 5MB or smaller' : err.message;
  return res.status(400).json({ message });
}

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(', ') });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid id format' });
  }

  const status = err.statusCode || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Internal server error' : err.message });
  
};