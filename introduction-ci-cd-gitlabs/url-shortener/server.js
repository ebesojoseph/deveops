require('dotenv').config();

const connectDB = require('./config/db');
const createApp = require('./app');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/url_shortener';

async function start() {
  await connectDB(MONGO_URI);
  const app = createApp(MONGO_URI);
  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

start();
