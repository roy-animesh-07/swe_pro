const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const { errorHandler, notFoundRoute } = require('./middleware/errorHandler');
const config = require('./utils/config');

function createApp({ logRequests = process.env.NODE_ENV !== 'test' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '100kb' }));
  if (logRequests) app.use(morgan('tiny'));

  app.use('/api', routes);
  app.use('/api', notFoundRoute);

  // Optional: serve the built React app from the same process (single-container deploy).
  const staticDir = config.serveFrontend && path.resolve(config.serveFrontend);
  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
