const express = require('express');
const authRoutes = require('./routes/auth_routes');
const errorHandler = require('./middlewares/errorHandler');
const jobsRoutes = require('./routes/jobs_routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);

app.use(errorHandler); // must be registered last

module.exports = app;