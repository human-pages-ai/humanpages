import { config } from './config.js';
import {
  registerAgent,
  getHuman,
  createJob,
  sendMessage,
  getMessages,
  markJobPaid,
  reviewJob,
} from './api.js';
import { waitForEvent, waitForEventWithMessages } from './webhook.js';
import { generateReply, getResponderName } from './responder.js';
import { notify, isOwnerNotifyConfigured } from './notify.js';
import { isPaymentConfigured, loadWalletAccount, getUsdcBalance, sendUsdc } from './pay.js';

/**
 * Main bot lifecycle — demonstrates how an AI agent hires a real human
 * for a physical-world task it cannot do on its own:
 *
 *   Register → Fetch human → Offer → Message → Wait → Pay → Wait → Review
 */
export async function runBot(humanId: string): Promise<void> {
  console.log('\n=== Local Errand Bot ===');
  console.log('Bridging AI to the physical world via Human Pages');
  console.log(`Responder: ${getResponderName()}`);
  console.log(`Owner notifications: ${isOwnerNotifyConfigured() ? 'Telegram' : 'off'}\n`);

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
  notify.jobCreated(job.id, candidate.name, config.jobPriceUsdc);

  // ── Step 4: Send an intro message ──
  console.log('\nStep 4: Sending intro message...');
  const knownIds = new Set<string>();
  try {
    const intro = await sendMessage(
      job.id,
      `Hi ${candidate.name}! I'm an AI agent looking for help with a local errand. `
      + `The task: ${config.errandDescription} `
      + `Let me know if you have any questions before accepting!`,
    );
    knownIds.add(intro.id);
    console.log(`  Message sent (id: ${intro.id})`);
  } catch (err) {
    console.log(`  Could not send message: ${(err as Error).message}`);
  }

  // ── Step 5: Wait for acceptance (while responding to messages) ──
  console.log('\nStep 5: Waiting for human to accept the errand...');
  console.log('  (The human will receive an email/Telegram notification)');
  console.log('  (Bot will reply to messages while waiting)');

  const accepted = await waitForEventWithMessages(
    job.id,
    'job.accepted',
    knownIds,
    async (msg) => {
      console.log(`  [${msg.senderName}]: ${msg.content}`);
      notify.humanMessage(job.id, msg.senderName, msg.content);
      const reply = await generateReply(msg, config.errandDescription);
      try {
        const sent = await sendMessage(job.id, reply);
        knownIds.add(sent.id);
        console.log(`  [Bot]: ${reply}`);
      } catch (err) {
        console.log(`  [Bot] Failed to reply: ${(err as Error).message}`);
      }
    },
    600_000,
  );

  console.log(`  Errand accepted by ${accepted.data.humanName ?? accepted.data.humanId}!`);
  notify.jobAccepted(job.id, accepted.data.humanName ?? accepted.data.humanId);

  if (accepted.data.contact) {
    const c = accepted.data.contact;
    console.log('  Contact info (for coordination):');
    if (c.email) console.log(`    Email: ${c.email}`);
    if (c.telegram) console.log(`    Telegram: ${c.telegram}`);
    if (c.whatsapp) console.log(`    WhatsApp: ${c.whatsapp}`);
    if (c.signal) console.log(`    Signal: ${c.signal}`);
  }

  // ── Step 6: Send coordination message ──
  console.log('\nStep 6: Sending coordination details...');
  try {
    const coordMsg = await sendMessage(
      job.id,
      'Great, you accepted! Here are the details:\n'
      + `Task: ${config.errandDescription}\n`
      + 'I\'ll record the payment now so you can get started.',
    );
    knownIds.add(coordMsg.id);
    console.log('  [Bot]: Sent coordination details.');
  } catch (err) {
    console.log(`  Could not send message: ${(err as Error).message}`);
  }

  // ── Step 7: Record payment ──
  console.log('\nStep 7: Recording payment...');

  if (isPaymentConfigured()) {
    // Real on-chain USDC payment
    try {
      const account = await loadWalletAccount();
      console.log(`  Wallet loaded: ${account.address}`);

      const network = config.paymentNetwork;
      const balance = await getUsdcBalance(account, network);
      console.log(`  USDC balance on ${network}: ${balance}`);

      if (parseFloat(balance) < config.jobPriceUsdc) {
        throw new Error(
          `Insufficient USDC balance: ${balance} < ${config.jobPriceUsdc}. `
          + `Fund your wallet on ${network}.`,
        );
      }

      // Re-fetch human profile for wallet addresses
      const human = await getHuman(candidate.id);
      const wallet = human.wallets?.find((w) => w.network === network);
      if (!wallet) {
        throw new Error(
          `Human has no wallet on ${network}. `
          + `Ask them to add a ${network} wallet on their profile.`,
        );
      }

      console.log(`  Sending $${config.jobPriceUsdc} USDC to ${wallet.address} on ${network}...`);
      const txHash = await sendUsdc(account, wallet.address, config.jobPriceUsdc, network);
      console.log(`  Confirmed: ${txHash}`);

      const paid = await markJobPaid(job.id, {
        paymentTxHash: txHash,
        paymentNetwork: network,
        paymentToken: 'USDC',
        paymentAmount: config.jobPriceUsdc,
      });
      console.log(`  Payment recorded: ${paid.status}`);
    } catch (err) {
      console.log(`  Payment failed: ${(err as Error).message}`);
      console.log('  Continuing to demonstrate remaining steps...');
    }
  } else {
    // Demo mode — no wallet configured
    console.log('  [DEMO MODE] No wallet configured — using placeholder tx hash.');
    console.log('  To enable real payments, set WALLET_PRIVATE_KEY or run: npm run generate-keystore');
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
      console.log('  Continuing to demonstrate remaining steps...');
    }
  }

  // ── Step 8: Wait for completion (while responding to messages) ──
  console.log('\nStep 8: Waiting for human to complete the errand...');
  console.log('  (The human can message you while working)');

  try {
    const completed = await waitForEventWithMessages(
      job.id,
      'job.completed',
      knownIds,
      async (msg) => {
        console.log(`  [${msg.senderName}]: ${msg.content}`);
        notify.humanMessage(job.id, msg.senderName, msg.content);
        const reply = await generateReply(msg, config.errandDescription);
        try {
          const sent = await sendMessage(job.id, reply);
          knownIds.add(sent.id);
          console.log(`  [Bot]: ${reply}`);
        } catch (err) {
          console.log(`  [Bot] Failed to reply: ${(err as Error).message}`);
        }
      },
      600_000,
    );

    console.log(`  Errand completed! (status: ${completed.status})`);
    notify.jobCompleted(job.id, accepted.data.humanName ?? accepted.data.humanId);

    // ── Step 9: Leave a review ──
    console.log('\nStep 9: Leaving a review...');
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
