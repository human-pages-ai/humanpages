import 'dotenv/config';

const API = process.env.HP_API_URL || 'https://humanpages.ai/api';

async function main() {
  // Step 1: Register as an agent
  console.log('Registering agent on Human Pages...');
  const registerRes = await fetch(`${API}/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'my-arbitrator-bot',
      description: 'Escrow arbitrator bot — resolves disputes for code and design tasks',
      websiteUrl: 'https://example.com',
    }),
  });

  if (!registerRes.ok) {
    console.error('Registration failed:', await registerRes.text());
    process.exit(1);
  }

  const { apiKey, agent } = (await registerRes.json()) as {
    apiKey: string;
    agent: { id: string };
  };

  console.log(`Agent registered: id=${agent.id}`);
  console.log(`API Key: ${apiKey}`);

  // Step 2: Register as arbitrator
  console.log('\nRegistering as arbitrator...');
  const arbRes = await fetch(`${API}/agents/${agent.id}/arbitrator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Key': apiKey,
    },
    body: JSON.stringify({
      feeBps: 500, // 5% preferred fee
      specialties: ['code', 'design'],
      sla: '24h response',
      webhookUrl: process.env.WEBHOOK_URL || undefined,
    }),
  });

  if (!arbRes.ok) {
    console.error('Arbitrator registration failed:', await arbRes.text());
    process.exit(1);
  }

  const result = await arbRes.json();
  console.log('Arbitrator registered:', result);

  console.log('\n--- Save these in your .env ---');
  console.log(`HP_API_KEY=${apiKey}`);
  console.log(`HP_AGENT_ID=${agent.id}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
