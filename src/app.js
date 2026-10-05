const express = require('express');
const authRoutes = require('./routes/auth_routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);

app.use(errorHandler); // must be registered last

module.exports = app;