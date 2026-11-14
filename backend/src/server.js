require('dotenv').config();
const app = require('./app');
const { connectDatabase } = require('./config/database');

async function startServer() {
  await connectDatabase();
  const port = Number(process.env.PORT || 5000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Medication application is running on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
