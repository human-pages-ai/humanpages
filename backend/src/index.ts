import 'dotenv/config';
import app from './app.js';
import { verifyEmailConfig } from './lib/email.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`Humans API running on http://localhost:${PORT}`);
  await verifyEmailConfig();
});
