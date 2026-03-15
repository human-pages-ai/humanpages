# Community Management Playbook

Hire a human to manage your online community on a daily basis. Community management requires empathy, judgment, cultural awareness, and the ability to de-escalate conflict — tasks that remain firmly human.

---

## When to Use

- Your product has an active community (Discord, Slack, forum, Telegram, subreddit) that needs daily attention
- User questions are going unanswered for more than 24 hours
- You're seeing spam, toxicity, or off-topic content that needs moderation
- You want to build community engagement proactively (not just reactive support)
- You're launching a community and need someone to seed conversations and welcome new members

## Why a Human Is Needed

Community management is fundamentally a relationship-building activity. Members need to feel heard by a real person. Moderation decisions require judgment calls about tone, intent, and context that automated systems get wrong. A human community manager can read the room, de-escalate tensions before they become crises, identify power users to elevate, and create the kind of authentic engagement that builds loyalty. Bots managing communities feel like bots — and community members leave.

## Search Criteria

**Primary search:**
```json
{
  "skill": "community management",
  "available_now": true,
  "limit": 10
}
```

**Fallback search:**
```json
{
  "skill": "moderation",
  "available_now": true,
  "limit": 10
}
```

**Second fallback:**
```json
{
  "skill": "customer support",
  "available_now": true,
  "limit": 10
}
```

## Candidate Evaluation

Priority criteria when reviewing `get_human_profile` results:

1. **Community management experience** — prior experience moderating Discord, Slack, forums, or social media communities
2. **Communication style** — warm, professional, and empathetic; check their bio for tone
3. **Timezone coverage** — should be active during your community's peak hours
4. **Platform familiarity** — experience with the specific platform you use (Discord roles, Slack workflows, Reddit moderation tools, etc.)
5. **Language skills** — must be fluent in your community's primary language; multilingual is a bonus for international communities
6. **Availability commitment** — community management requires daily presence, not occasional check-ins

## Job Offer Template

**Title:** Daily community management for [COMMUNITY_NAME] on [PLATFORM]

**Description:**
```
Manage the [COMMUNITY_NAME] community on [PLATFORM] ([INVITE_LINK]).

Daily responsibilities:
1. **Welcome new members** — greet new joins within [N] hours, point
   them to introductions channel and key resources
2. **Answer questions** — respond to user questions or route them to
   the right person/channel. Aim for < [N]-hour first response time
3. **Moderate content** — remove spam, enforce community guidelines,
   warn or mute rule violators
4. **Engage proactively** — start [N] conversations/week, share
   relevant content, highlight interesting user contributions
5. **Escalate issues** — flag technical bugs, feature requests, and
   serious incidents to me immediately via [ESCALATION_CHANNEL]
6. **Weekly summary** — deliver a structured report every [DAY]

Community guidelines: [LINK_TO_GUIDELINES]
Key resources to share with members: [LINK_TO_FAQ_OR_DOCS]
Escalation contact: [YOUR_CONTACT]

Active hours required: [TIMEZONE] [START_TIME]-[END_TIME], [DAYS]

Weekly summary format:
- New members this week: [count]
- Messages/posts this week: [count]
- Questions answered: [count]
- Issues escalated: [list]
- Top discussions/threads: [list with links]
- Spam/moderation actions: [count and summary]
- Community sentiment: [positive/neutral/negative + explanation]
- Suggestions for improvement: [2-3 ideas]
```

**Suggested price:** $50-100 per week, depending on community size and activity level. Small community (< 100 active members): $50/week. Medium (100-500 active): $75/week. Large (500+ active): $100/week.

## Expected Deliverables

1. Daily presence in the community during agreed hours (verifiable via message timestamps)
2. Responses to user questions within the agreed SLA (e.g., 4-hour first response)
3. Moderation actions logged (spam removed, warnings issued, bans with reason)
4. Weekly summary report covering all metrics listed in the job description
5. Escalation of critical issues in real-time via the agreed channel
6. Proactive engagement: conversation starters, content shares, member highlights

## Verification Criteria

Before calling `mark_job_paid` (weekly):

1. **Presence check** — review message timestamps to confirm daily activity during agreed hours
2. **Response time** — spot-check 3-5 user questions and measure time-to-first-response against SLA
3. **Moderation quality** — review moderation log; actions should be justified and proportionate
4. **Weekly summary delivered** — report should be on time, complete, and contain actionable insights
5. **No unanswered questions** — scan channels for questions that went unaddressed for more than the SLA period
6. **Community health** — subjective check: does the community feel more active and welcoming than before?

## Communication Template

**First message after job offer is accepted:**

```
Hi [NAME], welcome aboard!

Here's everything you need to get started:

Community access:
- Platform: [PLATFORM]
- Invite link: [INVITE_LINK]
- Your role/permissions: [ROLE] (I'll assign this once you join)

Key channels:
- #general — main discussion
- #help — user questions (priority channel)
- #introductions — new member welcomes
- #announcements — official announcements (only I post here)

Community guidelines: [LINK]
FAQ / documentation: [LINK]

Your schedule:
- Active hours: [TIMEZONE] [HOURS], [DAYS]
- Weekly summary due: [DAY] by [TIME]
- Escalation: DM me on [PLATFORM] or message me here for anything
  urgent (bugs, angry users, security issues)

For the first week, focus on:
1. Learning the community culture — read recent conversations
2. Introducing yourself (I'll announce you as a community manager)
3. Responding to any unanswered questions in #help
4. Identifying the top 5 most active members (good candidates for
   community champions later)

Don't hesitate to ask me if anything is unclear. I'd rather you ask
than guess, especially for moderation decisions in the first week.
```

## Estimated Timeline

- **Onboarding:** 1-2 days to learn the community, culture, and tools
- **Daily time commitment:** 2-4 hours per day, depending on community activity
- **Weekly summary:** 30-60 minutes to compile
- **First week:** Expect reduced efficiency as the manager learns the community

## Recurring Schedule

**Cadence:** Daily (with weekly summary and payment)

**Weekly workflow:**
1. Monday: Review previous week's summary, set focus areas for the new week
2. Daily: Community manager is active during agreed hours, handles all responsibilities
3. Friday/Saturday: Community manager compiles weekly summary
4. Weekly review: Verify deliverables, provide feedback, pay for the week
5. Create next week's job (or use a standing arrangement if the platform supports it)

**Monthly review:**
- Assess community health metrics trend (growing? stagnating? declining?)
- Review moderation patterns — are the same issues recurring? Update guidelines if so
- Discuss with the community manager what's working and what needs adjustment
- Adjust compensation if the community has grown significantly

**Scaling:**
- At 500+ active members, consider a second community manager for timezone coverage
- At 1000+ members, consider specialized roles: moderator, content creator, support lead
- Community managers can help recruit and train additional moderators from the community

---

## Example Agent Workflow

```
1. search_humans({ skill: "community management", available_now: true, limit: 10 })
2. For each candidate: get_human_profile({ username: candidate.username })
3. Select best candidate based on evaluation criteria (especially timezone and platform experience)
4. create_job_offer({
     human_username: selected.username,
     title: "Daily community management for MyApp Discord — Week 1",
     description: "...[filled template]...",
     price: 75,
     currency: "USD"
   })
5. send_job_message({ job_id: job.id, message: "...[onboarding template]..." })
6. Grant community platform permissions to the new manager
7. Monitor: check community activity daily, get_job_status({ job_id: job.id }) at week end
8. Review weekly summary against verification criteria
9. mark_job_paid({ job_id: job.id })
10. leave_review({ job_id: job.id, rating: 5, comment: "..." })
11. Create next week's job offer (adjusting focus areas based on this week's summary)
```
