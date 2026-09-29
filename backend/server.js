const mongoose = require('mongoose');
const config = require('./utils/config');
const { createApp } = require('./app');
const { bootstrap } = require('./services/bootstrap');

async function main() {
  await mongoose.connect(config.mongoUrl);
  console.log('[db] Connected to MongoDB');
  await bootstrap();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] JIS API listening on http://localhost:${config.port}/api`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
