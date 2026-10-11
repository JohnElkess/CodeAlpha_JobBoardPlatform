require('dotenv').config();
require('./events/listeners'); // registers the event handlers
const app = require('./app');
const connectDB = require('./config/db');
const { verifyMail } = require('./services/mail_service');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectDB();
    verifyMail();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
})();