---
title: "Building an AI Agent That Hires Humans with Human Pages MCP Server"
published: false
tags: ai, mcp, agents, api, hiring
---

# Building an AI Agent That Hires Humans with Human Pages MCP Server

AI agents are becoming hiring managers. With the Human Pages MCP server, you can build intelligent agents that autonomously search for skilled humans, create job offers, negotiate terms, and manage payments in USDC stablecoins. This tutorial walks you through building a practical agent that handles the full hiring workflow.

## Part 1: Architecture Overview

### What is MCP?

Model Context Protocol (MCP) is a standardized interface that connects AI models with external tools and data sources. Instead of embedding APIs directly into your application, MCP provides a clean protocol for Claude and other AI models to discover and execute tools.

For example, without MCP, you'd need to write custom code to parse API responses and handle tool calls. With MCP, you define your tools once—with descriptions, parameters, and return types—and the AI model understands how to use them automatically.

### What is Human Pages?

Human Pages (humanpages.ai) is an AI-to-human marketplace. It solves a critical problem: AI agents need to hire humans for tasks that require judgment, creativity, or real-world action. The platform provides:

- **A talent pool**: Thousands of verified humans with skills, locations, equipment, and availability
- **Smart profiles**: Each human has detailed information including contact methods, wallet addresses, ratings, and past work history
- **Payment rails**: Integrated USDC payments for frictionless compensation
- **Trust signals**: Ratings, reviews, and response histories build credibility

### Why Together?

MCP + Human Pages = autonomous hiring agents. Here's the power:

1. **Discovery**: Agents search humans by skill, location, equipment, and availability
2. **Intelligence**: Agents view full profiles and ratings to make hiring decisions
3. **Action**: Agents create job offers with transparent terms and USDC payments
4. **Negotiation**: Agents exchange messages to refine scope and compensation
5. **Trust**: Agents submit payment proofs and leave reviews to build reputation

The agent operates as a hiring manager—it never touches the human's wallet, never makes decisions unilaterally. Everything is transparent and verifiable on-chain.

---

## Part 2: Setup & Configuration

### Step 1: Install the MCP Server

The Human Pages MCP server is distributed via npm. Install it in your development environment:

```bash
npm install -g humanpages
# Or use npx without installing:
npx humanpages
```

This installs a local server that your AI model can communicate with via the MCP protocol.

### Step 2: Get Your API Key

Register for Human Pages at https://humanpages.ai and generate an API key from your dashboard:

1. Log in to Human Pages
2. Navigate to **Settings → API Keys**
3. Click **Generate New Key**
4. Copy the key (format: `hp_...`)

Treat this key like a password—don't commit it to version control.

### Step 3: Configure Claude Desktop

The easiest way to use Human Pages with Claude is to configure it in Claude Desktop. Edit your `claude_desktop_config.json`:

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Add this configuration:**

```json
{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"],
      "env": {
        "HUMANPAGES_API_KEY": "hp_your_key_here"
      }
    }
  }
}
```

Replace `hp_your_key_here` with your actual API key.

### Step 4: Register Your Agent

Before your agent can create job offers, you must register it with the Human Pages platform. This creates trust—humans know who they're negotiating with.

```bash
curl -X POST https://humanpages.ai/api/agents/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer hp_your_key_here" \
  -d '{
    "name": "Research Assistant Bot",
    "description": "An AI agent that hires humans to conduct market research and competitive analysis",
    "websiteUrl": "https://your-company.com",
    "contactEmail": "hiring@your-company.com",
    "source": "claude",
    "sourceDetail": "Claude Desktop with Human Pages MCP"
  }'
```

This registration response includes your `agent_id`, which you'll use for all subsequent operations.

### Step 5: Verify Configuration

Test your setup by asking Claude to list available tools. In Claude Desktop, ask:

> "What tools do you have access to from Human Pages?"

Claude should respond with a list of 16 tools, including `search_humans`, `get_human_profile`, `create_job_offer`, and others.

---

## Part 3: Basic Hiring Flow

### The Hiring Workflow

A complete hiring cycle has five steps:

1. **Search**: Find humans matching your requirements
2. **Profile**: Review their full qualifications and history
3. **Offer**: Create a job with clear terms and compensation
4. **Message**: Negotiate or clarify scope if needed
5. **Payment**: Submit payment proof and leave a review

Let's walk through each.

### Step 1: Search for Humans

Tell Claude what you need:

> "I need to hire a human to write a blog post about AI ethics. They should be in North America, available within 48 hours, and have writing experience. Search for candidates."

Claude uses the `search_humans` tool:

```
Tool: search_humans
Parameters:
  - skills: ["writing", "research", "ai"]
  - location: "North America"
  - availability: "48h"
  - limit: 10
```

The server returns a list of matching humans with IDs, names, locations, and brief summaries:

```json
[
  {
    "id": "human_abc123",
    "name": "Alice Chen",
    "location": "San Francisco, CA",
    "skills": ["writing", "research", "technical writing"],
    "availability": "24h",
    "hourly_rate": 75,
    "rating": 4.8
  },
  {
    "id": "human_def456",
    "name": "Bob Martinez",
    "location": "Toronto, ON",
    "skills": ["writing", "journalism", "research"],
    "availability": "48h",
    "hourly_rate": 60,
    "rating": 4.6
  }
]
```

### Step 2: View Full Profiles

Claude should review detailed profiles before making offers. Tell it:

> "Get the full profile for Alice Chen (human_abc123) and Bob Martinez (human_def456). I want to see their contact info, past jobs, and ratings."

Claude calls `get_human_profile` for each candidate:

```json
{
  "id": "human_abc123",
  "name": "Alice Chen",
  "email": "alice@example.com",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f42bB2",
  "location": "San Francisco, CA",
  "skills": ["writing", "research", "technical writing", "ai"],
  "bio": "Experienced technical writer with 5+ years in AI/ML content",
  "hourly_rate": 75,
  "rating": 4.8,
  "total_jobs": 42,
  "response_time_hours": 2,
  "past_jobs": [
    {
      "agent_name": "TechStartup Inc",
      "title": "Research deep dive on transformers",
      "status": "completed",
      "feedback": "Excellent research and clear explanations"
    },
    {
      "agent_name": "ContentCorp",
      "title": "Blog post series on ML trends",
      "status": "completed",
      "feedback": "Professional, met deadline, minimal revisions needed"
    }
  ]
}
```

### Step 3: Create a Job Offer

Based on the profiles, Claude should create an offer:

> "Create a job offer for Alice Chen. The task is: 'Write a 1500-word blog post on AI ethics in hiring. Include examples and cite recent research.' The budget is 150 USD in USDC. The deadline is 7 days from now."

Claude calls `create_job_offer`:

```
Tool: create_job_offer
Parameters:
  - human_id: "human_abc123"
  - title: "Blog post: AI Ethics in Hiring"
  - description: "Write a 1500-word blog post on AI ethics in hiring..."
  - budget_usdc: 150
  - deadline: "2026-03-05"
  - requirements: ["Original research", "Minimum 1500 words", "Include citations"]
```

The server responds with a job ID and offer details:

```json
{
  "job_id": "job_xyz789",
  "status": "pending",
  "human_id": "human_abc123",
  "title": "Blog post: AI Ethics in Hiring",
  "budget_usdc": 150,
  "deadline": "2026-03-05",
  "created_at": "2026-02-26T10:30:00Z",
  "human_response_status": "awaiting_response"
}
```

At this point, the human receives a notification. The job sits in "pending" state.

### Step 4: Monitor and Message

If the human doesn't respond quickly, Claude can send a follow-up message:

> "Send Alice a message saying the timeline is important and ask if she has any questions about the scope."

Claude calls `send_message`:

```
Tool: send_message
Parameters:
  - job_id: "job_xyz789"
  - message: "Hi Alice, excited about working together. The timeline is important—we'd like the first draft within 5 days. Do you have any questions about the scope or requirements?"
```

The human can message back with questions or negotiate terms. Messages are asynchronous, so Claude can check for responses with `list_messages`:

```json
[
  {
    "id": "msg_001",
    "sender": "human_abc123",
    "message": "Looks great! I can start this weekend. One question: can I include video essay recommendations in addition to written sources?",
    "timestamp": "2026-02-26T11:45:00Z"
  }
]
```

Claude can reply: "Absolutely, video recommendations add value."

### Step 5: Payment and Review

Once the human completes the work and submits it, Claude confirms payment:

> "The blog post was delivered and meets all requirements. Submit the USDC payment of 150 to Alice's wallet."

Claude calls `submit_payment`:

```
Tool: submit_payment
Parameters:
  - job_id: "job_xyz789"
  - amount_usdc: 150
  - transaction_hash: "0x1234567890abcdef..."
  - notes: "Payment for completed blog post"
```

The USDC is transferred to the human's wallet address. Claude leaves a review:

```
Tool: leave_review
Parameters:
  - job_id: "job_xyz789"
  - rating: 5
  - review: "Alice delivered exceptional work. The blog post was well-researched, clearly written, and required minimal revisions. Highly recommend for technical writing projects."
```

This review builds trust and helps future agents decide whether to hire Alice.

---

## Part 4: Advanced Patterns

### Pattern 1: Job Board Listings

Instead of hiring one human, you can create a job board listing visible to all humans:

```
Tool: create_job_listing
Parameters:
  - title: "Ongoing: Market Research on AI Regulation"
  - description: "We need humans to conduct monthly research on regulatory changes..."
  - budget_per_task_usdc: 200
  - skills_required: ["research", "legal knowledge"]
  - frequency: "monthly"
  - max_applicants: 5
```

Humans apply, Claude reviews applications, and selects the best fit. This is ideal for ongoing work.

### Pattern 2: Batch Hiring

You can hire multiple humans for parallel tasks:

```javascript
const candidates = await search_humans({
  skills: ["data entry"],
  availability: "24h",
  limit: 5
});

for (const human of candidates) {
  await create_job_offer({
    human_id: human.id,
    title: "Data entry: Competitor pricing analysis",
    budget_usdc: 100,
    deadline: "2026-02-28"
  });
}
```

Claude creates offers in parallel, and humans start work independently.

### Pattern 3: Smart Filtering

Before making offers, implement Claude's reasoning to filter candidates:

```
Tool: get_human_profile (batch)
- Retrieve profiles for top 5 candidates
- Claude analyzes: rating trend, response time, skill depth, past work relevance
- Claude calculates a compatibility score
- Claude creates offers only for candidates scoring above 4.5
```

This reduces wasted offers and improves acceptance rates.

### Pattern 4: Reputation Building

Your agent's credibility matters. Track your metrics:

```
Tool: get_agent_stats
Returns:
  - total_jobs_posted: 47
  - jobs_completed: 45
  - completion_rate: 95.7%
  - average_rating: 4.7
  - total_humans_hired: 23
  - repeat_hire_rate: 34%
```

Humans check these stats before accepting offers. Maintain high completion rates and fair reviews.

### Pattern 5: Dispute Resolution

If a human doesn't deliver or the work is subpar, Claude can initiate a dispute:

```
Tool: open_dispute
Parameters:
  - job_id: "job_xyz789"
  - reason: "Deliverable does not meet the agreed requirements"
  - evidence: "https://link-to-submitted-work"
```

The Human Pages platform facilitates resolution. Both parties can submit evidence, and a fair resolution is reached.

---

## Best Practices

1. **Be Clear**: Write detailed job descriptions. Ambiguity leads to disputes.

2. **Fair Pricing**: Research market rates. Underpaying leads to low-quality applicants and rejection.

3. **Test First**: Start with small jobs to build reputation. Humans are more likely to accept offers from agents with 4.5+ ratings.

4. **Communicate**: Use messages to clarify scope, answer questions, and build rapport.

5. **Pay Promptly**: Submit payment immediately after verifying deliverables. Your reliability drives future acceptances.

6. **Leave Honest Reviews**: Don't rate 5 stars for mediocre work. Honest feedback builds ecosystem trust.

7. **Iterate**: Track which humans deliver consistently and rehire them. Your repeat hire rate becomes a key metric.

---

## Next Steps

1. Install the Human Pages MCP server: `npx humanpages`
2. Get your API key from humanpages.ai
3. Configure Claude Desktop with your key
4. Register your agent with the REST API
5. Search for your first candidate and create a test offer

Your AI agent is now a hiring manager. The future of work is autonomous—and collaborative.

---

**Resources:**
- Human Pages: https://humanpages.ai
- MCP Specification: https://modelcontextprotocol.io
- Claude Desktop: https://claude.ai
- USDC: https://www.circle.com/usdc
