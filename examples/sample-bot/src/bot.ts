import { config } from './config.js';
import {
  registerAgent,
  getHuman,
  createJob,
  markJobPaid,
  reviewJob,
} from './api.js';
import { waitForEvent } from './webhook.js';

/**
 * Main bot lifecycle — demonstrates how an AI agent hires a real human
 * for a physical-world task it cannot do on its own:
 *
 *   Register → Fetch human → Offer → Wait → Pay → Wait → Review
 */
export async function runBot(humanId: string): Promise<void> {
  console.log('\n=== Local Errand Bot ===');
  console.log('Bridging AI to the physical world via Human Pages\n');

  // ── Step 1: Register (if needed) ──
  let agentId: string;

  if (config.agentApiKey) {
    console.log('Step 1: Using existing API key (skipping registration)');
    agentId = 'self';
  } else {
    console.log('Step 1: Registering as a new agent...');
    const reg = await registerAgent();
    config.agentApiKey = reg.apiKey;
    agentId = reg.agent.id;
    console.log(`  Registered as "${reg.agent.name}" (id: ${agentId})`);
    console.log(`  API key: ${reg.apiKey.substring(0, 8)}... (save this to .env!)`);
  }

  // ── Step 2: Fetch the target human ──
  console.log(`\nStep 2: Fetching human ${humanId}...`);
  const candidate = await getHuman(humanId);
  console.log(`  ${candidate.name} (@${candidate.username}) in ${candidate.location ?? 'unknown'}`);
  console.log(`  ${candidate.reputation.jobsCompleted} jobs, rating: ${candidate.reputation.avgRating ?? 'n/a'}`);

  // ── Step 3: Create job offer ──
  console.log('\nStep 3: Sending errand job offer...');

  const callbackUrl = config.webhookUrl ? `${config.webhookUrl}/webhook` : undefined;

  const job = await createJob({
    humanId: candidate.id,
    agentId,
    title: 'Local errand — pickup & delivery',
    description: config.errandDescription,
    priceUsdc: config.jobPriceUsdc,
    ...(callbackUrl && {
      callbackUrl,
      callbackSecret: config.webhookSecret,
    }),
  });

  console.log(`  Job created: ${job.id} (status: ${job.status})`);
  console.log(`  Price: $${config.jobPriceUsdc} USDC`);

  // ── Step 4: Wait for acceptance ──
  console.log('\nStep 4: Waiting for human to accept the errand...');
  console.log('  (The human will receive an email/Telegram notification)');

  const accepted = await waitForEvent(job.id, 'job.accepted', 600_000);
  console.log(`  Errand accepted by ${accepted.data.humanName ?? accepted.data.humanId}!`);

  if (accepted.data.contact) {
    const c = accepted.data.contact;
    console.log('  Contact info (for coordination):');
    if (c.email) console.log(`    Email: ${c.email}`);
    if (c.telegram) console.log(`    Telegram: ${c.telegram}`);
    if (c.whatsapp) console.log(`    WhatsApp: ${c.whatsapp}`);
    if (c.signal) console.log(`    Signal: ${c.signal}`);
  }

  // ── Step 5: Record payment ──
  console.log('\nStep 5: Recording payment...');

  // In a real bot, you would:
  //   1. Look up the human's wallet address from the search results or acceptance payload
  //   2. Use ethers.js or viem to send USDC on-chain (Ethereum, Polygon, Arbitrum, etc.)
  //   3. Wait for confirmation
  //   4. Pass the real tx hash to this endpoint
  //
  // For this demo, we use a placeholder. The platform will attempt on-chain
  // verification, which will fail — in production, use a real tx hash.
  const demoTxHash = '0x' + '0'.repeat(64);

  try {
    const paid = await markJobPaid(job.id, {
      paymentTxHash: demoTxHash,
      paymentNetwork: 'ethereum',
      paymentToken: 'USDC',
      paymentAmount: config.jobPriceUsdc,
    });
    console.log(`  Payment recorded: ${paid.status}`);
  } catch (err) {
    console.log(`  Payment recording failed (expected with demo tx): ${(err as Error).message}`);
    console.log('  In production, send real USDC and pass the confirmed tx hash.');
    console.log('  Continuing to demonstrate remaining steps...');
  }

  // ── Step 6: Wait for completion ──
  console.log('\nStep 6: Waiting for human to complete the errand...');

  try {
    const completed = await waitForEvent(job.id, 'job.completed', 600_000);
    console.log(`  Errand completed! (status: ${completed.status})`);

    // ── Step 7: Leave a review ──
    console.log('\nStep 7: Leaving a review...');
    const review = await reviewJob(job.id, {
      rating: 5,
      comment: 'Package delivered on time, great communication. Would hire again!',
    });
    console.log(`  Review submitted (rating: ${review.rating}/5)`);
  } catch (err) {
    console.log(`  ${(err as Error).message}`);
    console.log('  (Expected if payment was not recorded on-chain)');
  }

  console.log('\n=== Errand complete ===\n');
}
