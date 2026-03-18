# Staff SOP: Human Verification Process

**Effective date:** [Insert before launch]
**Applies to:** All staff conducting verification interviews
**Review cycle:** Every 3 months or after any incident

---

## Purpose

This document defines the rules and procedures for conducting Verified Human interviews. All staff must read and acknowledge this SOP before conducting any verification calls.

---

## Core Rules

### NEVER do the following:

1. **NEVER take a screenshot of a user's ID** -- not even "just to check later"
2. **NEVER photograph or scan the ID** using your phone or any other device
3. **NEVER record the video call** -- verify that recording is OFF before starting
4. **NEVER write down the user's ID number** -- not on paper, not in a spreadsheet, not in chat
5. **NEVER store the user's date of birth** from the ID (year of birth only if needed for age verification)
6. **NEVER share verification details** in team chat, Slack, or any channel -- log them ONLY in the designated verification log
7. **NEVER pressure a user** to show their ID if they are uncomfortable -- verification is optional

### Violation of these rules is a serious matter.
Storing user ID data without authorization exposes the company to fines up to THB 5,000,000 under Thailand's PDPA and up to EUR 20,000,000 under GDPR. Any violation must be reported to management immediately.

---

## Before the Call

### Setup checklist:
- [ ] Video platform recording is **OFF** (check settings, not just the button)
- [ ] User's profile is open on your screen
- [ ] Verification log is open and ready
- [ ] You have reviewed the user's profile for missing fields
- [ ] Consent notice has been shown to the user (in-app or via message)

### Verify your video platform:
| Platform | How to confirm recording is off |
|----------|-------------------------------|
| Google Meet | No red recording indicator. Admin setting: disable recording for the org. |
| Whereby | Recording is off by default. Check room settings. |
| Zoom | Settings > Recording > disable "Automatic recording". Verify no cloud recording at account level. |
| Daily.co | Recording off by default. Check room config. |

---

## During the Call

### Step 1: Introduce yourself by first name
> "Hi [Name], I'm [Your Name] from Human Pages."

### Step 2: Explain what will happen
> "I'll ask you to show a government ID on camera for a moment. I won't take a screenshot or store it -- I just need to confirm your name and face match."

### Step 3: Get verbal consent
> "Is that okay with you?"

**If they say no:** Respect it. Continue the call without ID verification. They can still benefit from profile completion and activation nudges. Note in the log: "User declined ID verification."

### Step 4: View the ID
Ask them to hold the ID up to the camera. Check:

| Check | What to look for |
|-------|-----------------|
| Name match | Name on ID reasonably matches profile name (nicknames, transliterations, and minor differences are OK) |
| Photo match | Person on camera is the same person in the ID photo |
| Document appears genuine | Not obviously edited, printed from a screen, or a photocopy of a photocopy |

**Time on this step: under 30 seconds.** Do not ask them to hold it up longer than needed.

### Step 5: Confirm
> "Perfect, thank you. That's all I need."

### Step 6: Continue with the rest of the interview script
(Profile completion, activation nudges, product intel -- see interview script)

---

## Verification Log

After every call, log the following in the designated verification spreadsheet/system:

### Fields to record:

| Field | Example | Required? |
|-------|---------|-----------|
| Date | 18/03/2026 | Yes |
| User platform ID | user_abc123 | Yes |
| User display name | Somchai K. | Yes |
| Document type | National ID / Passport / Driver's license | Yes |
| Issuing country | Thailand | Yes |
| Name match confirmed | Yes / No | Yes |
| Photo match confirmed | Yes / No | Yes |
| Staff member name | Ploy | Yes |
| Outcome | Verified / Failed / Declined / Rescheduled | Yes |
| Notes | (Only if needed: "name spelling differs slightly", "will reconnect for ID later") | Optional |

### Fields you must NEVER record:

| DO NOT LOG |
|-----------|
| ID number |
| Full date of birth |
| Address from the ID |
| Any digits or codes from the document |
| Screenshot or photo of the ID |

---

## Intel Logging

During the interview, you will collect product intel. Log it with structured tags:

| Tag | Use when... | Example |
|-----|------------|---------|
| `pain-point` | User describes a problem or frustration | "I signed up 2 weeks ago and haven't heard anything" |
| `feature-request` | User asks for something that doesn't exist | "I wish I could set my hourly rate" |
| `confusion` | User misunderstands how the platform works | "I thought AI agents would message me directly" |
| `job-type` | User describes what work they want | "I'm looking for data entry or translation work" |
| `positive` | User says something good about the platform | "I like that it's different from Fiverr" |
| `churn-risk` | User sounds like they might leave | "If I don't get a job soon I'll probably forget about it" |

**Format:** `[tag] Brief quote or summary`

Example log entry:
```
[pain-point] "Signed up 3 weeks ago, no contact since. Wasn't sure if the platform was real."
[job-type] Wants translation work (Thai-English) and data entry
[confusion] Thought agents would contact her directly, didn't know she needs to apply
[feature-request] Wants to set availability as "weekends only"
```

---

## Edge Cases

### User shows an ID in a language you can't read
- Confirm the photo matches the person on camera
- Ask: "Can you tell me the name as it appears on the document?"
- Log: "ID in [language], name verbally confirmed by user"
- This is still valid for verification

### User shows a digital ID (on their phone screen)
- Acceptable if it's an official government digital ID
- Not acceptable if it's a photo of a physical ID saved on their phone (too easy to edit)
- If unsure, ask: "Do you have the physical card? A photo saved on a phone is harder for us to verify."

### User's name on ID doesn't match their profile name
- Minor differences (spelling, transliteration, nickname vs legal name) are fine
- If the names are completely different, ask about it:
  > "I notice the name is a bit different -- can you help me understand?"
- Common reasons: married name, preferred name, transliteration from non-Latin script
- If satisfied the person is who they claim to be, verify them. Log the discrepancy in notes.

### User appears to be under 18
- Thailand PDPA requires parental consent for minors under 20 for sensitive data processing
- Do not proceed with ID verification for users who appear under 20
- Politely explain: "We need to check our policy on verification for younger users. I'll follow up with you."
- Escalate to management

### User asks "why do you need to see my ID?"
> "AI agents on our platform are spending real money to hire humans. The Verified badge tells them you're a real person whose identity has been confirmed. It's like a blue checkmark -- it means agents will trust you more and you'll appear higher in search results."

### User asks "will you store my ID?"
> "No. I'm just looking at it on camera right now to confirm your name and face match. I won't screenshot it, record it, or save any of the details from it. The only thing we log is that the verification happened and the type of document you showed."

### Technical issues (camera not working, bad connection)
- If you can't clearly see the ID: "The connection is a bit rough -- could you hold it steady for a moment?"
- If it's truly not working: reschedule. Do not verify based on a blurry image.
- Alternative: user can visit the office in person (if local) or try again with better connectivity.

---

## Incident Reporting

### If you accidentally see sensitive information you shouldn't have:
- Do not write it down
- Do not mention it to the user
- It happens -- move on. The key rule is: nothing gets recorded.

### If you accidentally screenshot or record:
- Delete it immediately
- Notify management the same day
- Log the incident: what happened, when, what was deleted
- This is not a disciplinary matter if reported promptly -- it becomes one if hidden

### If a user reports their data was mishandled:
- Escalate to management immediately
- Do not attempt to resolve it yourself
- Do not delete any verification logs (they may be needed for investigation)

---

## Staff Acknowledgment

Before conducting any verification interviews, each staff member must confirm:

> I have read and understood this SOP. I understand that:
> - I must never photograph, screenshot, record, or store user ID documents
> - I must log only the approved fields in the verification log
> - Violation of these rules can result in significant legal penalties for the company
> - I will report any incidents to management immediately
>
> Name: _______________
> Date: _______________
> Signature: _______________
