import 'dotenv/config';
import { sendJobOfferEmail, sendPasswordResetEmail } from './src/lib/email.js';

console.log('🧪 Testing MailerSend Integration...\n');

// Check if API key is configured
if (!process.env.MAILERSEND_API_KEY || process.env.MAILERSEND_API_KEY === 'your_mailersend_api_key_here') {
  console.error('❌ Error: MAILERSEND_API_KEY not configured in .env file');
  console.log('\nPlease update backend/.env with your MailerSend API key:');
  console.log('MAILERSEND_API_KEY=mlsn.your_actual_key_here\n');
  process.exit(1);
}

// Get test email from command line or use default
const testEmail = process.argv[2] || 'test@example.com';

console.log(`📧 Sending test emails to: ${testEmail}\n`);

// Test 1: Job Offer Email
console.log('Test 1: Job Offer Email');
const jobOfferData = {
  humanName: 'Test User',
  humanEmail: testEmail,
  jobTitle: 'Build a Landing Page',
  jobDescription: 'Need a professional landing page for a SaaS product. Should be responsive and modern.',
  priceUsdc: 500,
  agentName: 'AI Assistant',
  category: 'Web Development',
  language: 'en',
};

sendJobOfferEmail(jobOfferData)
  .then((success) => {
    if (success) {
      console.log('✅ Job offer email sent successfully!\n');
    } else {
      console.log('❌ Job offer email failed to send\n');
    }

    // Test 2: Password Reset Email
    console.log('Test 2: Password Reset Email');
    const resetUrl = `http://localhost:3000/reset-password?token=test-token-${Date.now()}`;

    return sendPasswordResetEmail(testEmail, resetUrl);
  })
  .then((success) => {
    if (success) {
      console.log('✅ Password reset email sent successfully!\n');
    } else {
      console.log('❌ Password reset email failed to send\n');
    }

    console.log('✨ All tests completed!');
    console.log('\nCheck your email inbox at:', testEmail);
    console.log('Also check your MailerSend dashboard: https://app.mailersend.com/\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed with error:', error);
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure your MAILERSEND_API_KEY is correct in .env');
    console.log('2. Verify your domain in MailerSend dashboard');
    console.log('3. Check that FROM_EMAIL matches your verified domain\n');
    process.exit(1);
  });
