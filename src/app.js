const express = require('express');
const authRoutes = require('./routes/auth_routes');
const jobsRoutes = require('./routes/jobs_routes');
const applicationsRoutes = require('./routes/applications_routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(express.json());

// Runs for EVERY request: Express 5 leaves req.body undefined when there is no body
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);

app.use(errorHandler); // must be registered last

module.exports = app;