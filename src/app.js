const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const authRoutes = require('./routes/auth_routes');
const jobsRoutes = require('./routes/jobs_routes');
const applicationsRoutes = require('./routes/applications_routes');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter, authLimiter } = require('./middlewares/rate_limiters');

const app = express();

app.use(helmet());

// Allowed browser origins come from env, comma separated. Unset means no cross-origin access.
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));

app.use(express.json());
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' })); // not rate limited, probes hit this later

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);

app.use(errorHandler); // always last

module.exports = app;