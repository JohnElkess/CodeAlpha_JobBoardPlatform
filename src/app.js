const express = require('express');

const app = express();

app.use(express.json()); // parses JSON request bodies into req.body

app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;