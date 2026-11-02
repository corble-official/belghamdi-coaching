# Belghamdi Coaching — n8n Client Operations Automation

## PROJECT CONTEXT

You are extending an existing n8n automation system for Belghamdi Coaching.

The project already has two implemented workflows:

1. **AI Sales Assistant**

   * Telegram customer conversations.
   * Egyptian Arabic AI replies.
   * Lead qualification and information collection.
   * Sales team notifications.
   * Conversation history stored in Supabase.
   * Human handoff for existing clients, complaints, and payment inquiries.

2. **Order Registration**

   * Existing order registration automation.
   * Orders are already being registered in the existing system.

These workflows are already implemented.

**DO NOT recreate, replace, duplicate, or break either workflow.**

Your task is to implement the remaining client operations and coaching follow-up workflows.

The final system should manage the customer journey after purchase:

Paid Order → Client Onboarding → Active Coaching → Weekly Check-ins → Coach Review → Progress Tracking → Renewal.

---

# PART 1 — INSPECT THE EXISTING ENVIRONMENT

Before implementation:

1. Create a separate inspection-only workflow or read-only discovery process before implementing any new automation.
2. Do not modify, activate, deactivate, delete, rename, reconnect, or overwrite any existing workflow.
3. Do not edit the existing AI Sales Assistant workflow.
4. Do not edit the existing Order Registration workflow.
5. Do not edit existing Supabase tables, columns, RPC functions, credentials, or integrations during the inspection phase.
6. Use read-only access wherever possible.
7. Export or back up the existing workflows before making any changes.
8. Inspect all existing workflows and record their names, IDs, active status, triggers, connected services, and dependencies.
9. Identify the existing AI Sales Assistant without changing its nodes, settings, credentials, or activation status.
10. Identify the existing Order Registration workflow without changing its nodes, settings, credentials, or activation status.
11. Inspect the existing Supabase integration patterns without exposing or copying credential values.
12. Inspect the existing Supabase schema and RPC functions using read-only operations only.
13. Identify the actual output fields produced by the existing Order Registration workflow without changing its execution logic.
14. Identify available communication channels and configured credentials without revealing secret values.
15. Inspect existing error-handling and event-logging mechanisms without modifying them.
16. Document which integrations are configured, missing, unavailable, or require manual approval.
17. Save the inspection results in a separate report, for example `DISCOVERY_REPORT.md`.
18. Save any workflow exports or backups in a separate backup directory.
19. Do not create new database tables, migrations, webhooks, credentials, or production workflows during this phase.
20. Do not run tests that send real customer messages, create real orders, modify customer records, or trigger payment actions.
21. If a required permission, credential, schema detail, or integration is unavailable, stop and report the exact blocker instead of guessing.
22. Do not proceed to implementation until the inspection report is complete and explicitly approved.
23. After approval, create all new workflows separately with unique names and IDs.
24. New workflows must not share mutable nodes or overwrite existing workflow definitions.
25. Before activating any new workflow, validate its connections, credentials, database operations, idempotency protection, and error handling in a safe test environment.

Use the existing system as the source of truth.

Do not invent:

* Table names.
* Column names.
* RPC functions.
* Webhook URLs.
* Credentials.
* Customer identifiers.
* Order status fields.

If a required database structure does not exist, propose and implement the necessary migration before using it.

Never expose credential values in workflow notes, screenshots, presentations, or exported documentation.

---

# PART 2 — REQUIRED WORKFLOWS

## BC-03 — Client Onboarding

### Trigger

Receive a verified successful payment/order event from the existing Order Registration workflow.

Do not create a second order-registration process.

If the existing workflow cannot safely dispatch an event, add a separate event handoff without changing its existing business logic.

### Workflow

1. Receive the verified order event.
2. Validate the event payload.
3. Verify that the order is actually paid.
4. Check whether the event was already processed.
5. Find the customer using the existing customer identifier.
6. Create a new client profile if one does not exist.
7. If the client already exists, preserve their existing profile.
8. Create a coaching subscription/package record associated with the order.
9. Generate a unique Client ID using the existing ID convention.
10. Create an onboarding request.
11. Generate a secure onboarding link.
12. Send the onboarding invitation through an available, configured communication channel.
13. Notify the assigned coach.
14. Log the onboarding event.

### Onboarding Form Fields

Collect only necessary information:

* Full name.
* Email.
* Phone, if provided.
* Fitness goal.
* Current training experience.
* Training days per week.
* Training location.
* Available equipment.
* Current weight, optional.
* Target weight, optional.
* Client preferences.
* Relevant health limitations, only where necessary and with appropriate consent.
* Optional starting progress photos.

Do not collect payment-card information.

Do not send private health information to Telegram notifications.

### Follow-up

* After 24 hours without onboarding completion: reminder.
* After 48 hours: second reminder.
* After 72 hours: create a coach follow-up task.

Stop reminders immediately when onboarding is completed.

### Success Criteria

A successful order must result in exactly one appropriate client onboarding process.

Repeated order events must not create duplicate clients or duplicate onboarding requests.

---

## BC-04 — Weekly Client Check-in

### Trigger

Scheduled Trigger.

Run daily to identify clients whose weekly check-in is due.

Use the client's actual coaching schedule and timezone.

Default timezone: Africa/Cairo.

### Workflow

1. Fetch active coaching subscriptions.
2. Identify clients due for a check-in.
3. Check whether a request already exists for the current period.
4. Generate a unique check-in request.
5. Generate a secure, expiring submission token.
6. Send the check-in link through the configured communication channel.
7. Record the delivery attempt.
8. Update the next check-in date.

### Check-in Form

The client should submit:

* Current weight.
* Optional body measurements.
* Workout adherence percentage.
* Nutrition adherence percentage.
* Energy level (1–5).
* Sleep quality (1–5).
* Training difficulties.
* General feedback.
* Optional progress photos.

The check-in form belongs to the existing website/client portal.

Do not build an unrelated external form if an existing client form is available.

### Submission Event

When the client submits:

1. Validate the token.
2. Validate that the request belongs to the client.
3. Prevent duplicate submissions.
4. Store the submitted data.
5. Store optional images in private storage.
6. Mark the request as submitted.
7. Create a coach review task.
8. Notify the assigned coach.
9. Stop pending reminders.

Never fabricate missing measurements or progress data.

---

## BC-05 — Missed Check-in Follow-up

### Trigger

Scheduled Trigger, running daily.

### Workflow

Find check-in requests that remain unanswered.

Follow this sequence:

| Time Since Due | Action                         |
| -------------- | ------------------------------ |
| 24 hours       | First reminder                 |
| 48 hours       | Second reminder                |
| 72 hours       | Create coach follow-up task    |
| After 72 hours | Mark client as Needs Attention |

### Important Rules

* Stop reminders once a check-in is submitted.
* Never send the same reminder twice.
* Respect communication preferences and opt-outs.
* Do not mark clients as inactive simply because they missed one check-in.
* Preserve the reminder history.
* Escalate repeated missed check-ins to the coach.

Create a clear audit trail.

---

## BC-06 — Coach Review & Follow-up Tasks

### Trigger

New check-in submitted or a client requires manual attention.

### Workflow

1. Receive the check-in submission event.
2. Identify the client and assigned coach.
3. Create a review task.
4. Set the task priority based on the reason for review.
5. Notify the coach.
6. Wait for the coach to review the client through the admin dashboard.
7. Receive the review-completed event.
8. Update the task status.
9. Record the coach's feedback and review timestamp.

### Task Types

* Check-in Review.
* Missed Check-in.
* Client Follow-up.
* Plan Update.
* Renewal Follow-up.
* Onboarding Review.
* General Client Support.

### Priority Rules

High priority:

* Multiple missed check-ins.
* Client requests urgent assistance.
* Coach manually flags the client.

Medium priority:

* Check-in review pending.
* Low adherence.
* Plan update required.

Low priority:

* Routine follow-up.
* Upcoming package review.

### Important

The coach makes all training and nutrition decisions.

n8n must never automatically change a client's workout or nutrition plan based on an AI-generated interpretation.

---

## BC-07 — Subscription & Renewal Management

### Trigger

Daily scheduled check.

Also listen to verified subscription/payment events where available.

### Workflow

1. Fetch active coaching subscriptions.
2. Identify packages approaching expiration.
3. Check whether the client has already renewed.
4. Send renewal reminders.
5. Create a follow-up task for the coach.
6. Update subscription state only from verified payment or subscription events.

### Reminder Schedule

| Time                 | Action                                                 |
| -------------------- | ------------------------------------------------------ |
| 7 days before expiry | First renewal reminder                                 |
| 3 days before expiry | Second reminder                                        |
| Expiry date          | Notify coach and evaluate verified subscription status |

### Renewal Handling

When payment is confirmed:

* Record the renewal.
* Associate the new order with the existing client.
* Preserve historical subscriptions.
* Create the next coaching period.
* Reset the check-in schedule according to the new package.

When payment is not confirmed:

* Never mark the subscription as renewed.
* Never assume that a reminder means payment.
* Follow the existing cancellation/expiry policy.

Do not treat ordinary Shopify orders as proof of recurring subscription renewal.

---

## BC-08 — Daily Coaching Operations Report

### Trigger

Schedule Trigger every day at 09:00 Africa/Cairo.

### Report Metrics

Generate a daily report containing:

**Business Overview**

* Total active clients.
* New clients.
* Completed onboardings.
* Pending onboardings.
* Active coaching subscriptions.
* Subscriptions expiring soon.

**Coaching Operations**

* Check-ins due today.
* Check-ins submitted.
* Check-ins awaiting review.
* Missed check-ins.
* Clients needing attention.
* Open follow-up tasks.
* Overdue tasks.

**Renewals**

* Packages expiring within 7 days.
* Packages expiring within 3 days.
* Confirmed renewals.
* Expired subscriptions.

**Automation Health**

* Successful workflow executions.
* Failed executions.
* Failed message deliveries.
* Pending retry events.

### Output

Send a concise report to the internal management channel using the existing Telegram integration if configured.

Include the report generation timestamp.

All metrics must be calculated from actual database records.

Never use fabricated numbers or sample data in production reports.

If a metric cannot be retrieved, display "Unavailable" instead of guessing.

---

## BC-99 — Global Error Handler

Create a centralized error-handling workflow.

Use n8n Error Trigger.

### Responsibilities

1. Capture workflow execution failures.
2. Identify workflow name and execution ID.
3. Identify the failed node.
4. Capture a sanitized error message.
5. Record the failure in the existing error log or integration event table.
6. Notify the internal operations channel.
7. Retry transient failures where safe.
8. Prevent duplicate business operations.
9. Escalate persistent failures.

### Retry Policy

Use bounded retries with exponential backoff for transient failures.

Examples:

* Temporary network failures.
* Rate limits.
* Temporary database connection issues.
* External API timeouts.

Do not blindly retry:

* Invalid customer data.
* Authentication failures.
* Permanent validation errors.
* Non-idempotent payment operations.

Use idempotency keys for all business-critical operations.

Never expose API keys, tokens, credentials, or sensitive customer information in error notifications.

---

# PART 3 — DATA ARCHITECTURE

Use the existing Supabase database.

Inspect existing tables before proposing new ones.

Potential entities required by the coaching workflows:

* clients
* client_subscriptions
* onboarding_records
* checkin_requests
* checkin_submissions
* client_progress
* follow_up_tasks
* coach_notes
* communication_logs
* integration_events
* automation_errors

Reuse existing tables wherever possible.

If tables are missing:

1. Create SQL migrations.
2. Add foreign keys and indexes.
3. Add appropriate uniqueness constraints.
4. Implement Row Level Security.
5. Protect client progress photos in private storage.
6. Ensure only authorized coaches and administrators can access client records.

Do not duplicate the existing sales lead or order registration architecture.

---

# PART 4 — EVENT ARCHITECTURE

Use standardized event names.

Required events:

* client.onboarding.created
* client.onboarding.completed
* client.checkin.due
* client.checkin.submitted
* client.checkin.missed
* client.checkin.review.requested
* client.checkin.review.completed
* client.progress.flagged
* client.task.created
* client.task.completed
* client.renewal.upcoming
* client.subscription.renewed
* client.subscription.expired

Every event should contain:

* Event ID.
* Event type.
* Related client ID.
* Related subscription/order ID where applicable.
* Timestamp.
* Payload.
* Idempotency key.
* Processing status.

Use the existing integration event dispatcher if available.

---

# PART 5 — IMPLEMENTATION AND TESTING

Implement workflows individually.

Recommended order:

1. BC-03 Client Onboarding.
2. BC-04 Weekly Check-in.
3. BC-05 Missed Check-in.
4. BC-06 Coach Review & Tasks.
5. BC-07 Subscription & Renewal.
6. BC-08 Daily Coaching Report.
7. BC-99 Global Error Handler.

For each workflow:

* Build the complete workflow.
* Configure nodes.
* Connect the nodes correctly.
* Add error handling.
* Validate expressions.
* Test with realistic test payloads.
* Verify database changes.
* Verify notification behavior.
* Verify duplicate-event protection.
* Record the test results.

Use demo/test data for testing.

Do not send real customer messages during development tests.

Do not activate production workflows until their credentials, permissions, and test results have been verified.

Export each completed workflow as a separate JSON file.

Create a README containing:

* Workflow purpose.
* Trigger.
* Node-by-node explanation.
* Required credentials.
* Environment variables.
* Database dependencies.
* Test instructions.
* Activation instructions.
* Known limitations.

---

# PART 6 — TECHNICAL PRESENTATION USING ACTUAL N8N SCREENSHOTS

After implementing and testing the workflows, create a professional technical PowerPoint presentation.

This presentation must document the actual implementation.

## Mandatory Browser Access

Use Playwright to access the actual running n8n instance.

Do not use screenshots from documentation, mockups, or generated diagrams as substitutes for actual n8n workflow screenshots.

Navigate through the actual workflows.

## Screenshot Requirements

Capture high-quality screenshots of:

### A. Workflow Architecture

* Complete BC-03 Client Onboarding workflow.
* Complete BC-04 Weekly Check-in workflow.
* Complete BC-05 Missed Check-in workflow.
* Complete BC-06 Coach Review workflow.
* Complete BC-07 Renewal workflow.
* Complete BC-08 Daily Report workflow.
* Complete BC-99 Error Handler workflow.

### B. Individual Workflow Sections

Capture important sections at readable zoom levels.

Show:

* Triggers.
* Data retrieval.
* Conditional logic.
* Database operations.
* Notifications.
* Task creation.
* Retry and error-handling branches.

### C. Important Node Configurations

Capture actual node configuration screens for:

* Schedule Trigger.
* Webhook Trigger.
* Supabase/HTTP Request.
* IF and Switch.
* Code nodes.
* Telegram or email notification nodes.
* Error handling nodes.

Hide all secrets and credential values before taking screenshots.

### D. Execution Results

Capture actual successful execution results.

Show:

* Input data.
* Important intermediate outputs.
* Successful database operations.
* Successful notification results.
* Execution status.

Capture error handling and retry behavior using controlled test failures.

Never fabricate execution results.

If a workflow has not been successfully executed, label it "Not yet verified".

## Screenshot Storage

Save all screenshots in:

`assets/screenshots/`

Organize them:

* `assets/screenshots/architecture/`
* `assets/screenshots/nodes/`
* `assets/screenshots/executions/`
* `assets/screenshots/errors/`

Use descriptive filenames.

Examples:

* `bc03-onboarding-full.png`
* `bc04-weekly-checkin-architecture.png`
* `bc05-missed-checkin-reminder.png`
* `bc06-coach-review-task.png`
* `bc07-renewal-logic.png`
* `bc08-daily-report-success.png`
* `bc99-error-handler.png`

Use actual screenshots captured from the n8n interface.

---

# PART 7 — POWERPOINT PRESENTATION

Create a professional presentation:

`Belghamdi_Coaching_Automation_Architecture.pptx`

Also export:

`Belghamdi_Coaching_Automation_Architecture.pdf`

### Presentation Format

* 16:9 widescreen.
* Professional business/technical design.
* Warm graphite background.
* Bone-white typography.
* Muted copper accents.
* Consistent typography.
* Clear diagrams.
* Readable screenshots.
* Concise explanations.

### Suggested Slide Structure

1. Cover — Belghamdi Coaching Automation System.
2. Business Overview — What the automation system solves.
3. Existing Workflows — AI Sales Assistant and Order Registration.
4. Complete Automation Architecture.
5. Client Onboarding — BC-03.
6. Weekly Check-in — BC-04.
7. Missed Check-in Follow-up — BC-05.
8. Coach Review & Task Management — BC-06.
9. Subscription & Renewal — BC-07.
10. Daily Coaching Operations Report — BC-08.
11. Global Error Handling — BC-99.
12. Supabase Data Architecture.
13. Event-Driven Integration Architecture.
14. Security, Idempotency, and Reliability.
15. Actual Execution Evidence.
16. Business Value and Operational Impact.
17. Deployment Status and Next Steps.

Use real screenshots from the actual n8n instance.

Add:

* Captions.
* Node labels.
* Arrows and annotations.
* Short explanations.
* Business value per workflow.

Do not overcrowd slides.

If a screenshot is too wide, use multiple slides rather than making the text unreadable.

### Presentation Accuracy Rules

* Never claim a workflow succeeded without an actual successful execution.
* Clearly distinguish implemented, tested, and production-active workflows.
* Do not show fabricated execution counts.
* Do not include secrets or customer personal information.
* Do not use AI-generated n8n interface screenshots.
* Diagrams may be created for architecture explanations, but actual workflow screenshots must remain authentic.

---

# PART 8 — FINAL DELIVERABLES

Provide:

1. Individual n8n workflow JSON exports.
2. SQL migrations, if required.
3. README and setup instructions.
4. Organized screenshot assets.
5. PowerPoint presentation.
6. PDF presentation.
7. Testing report.

Final folder structure:

belghamdi-automation/
workflows/
BC-03-client-onboarding.json
BC-04-weekly-checkin.json
BC-05-missed-checkin.json
BC-06-coach-review.json
BC-07-subscription-renewal.json
BC-08-daily-report.json
BC-99-error-handler.json

supabase/
migrations/

assets/
screenshots/
architecture/
nodes/
executions/
errors/

presentation/
Belghamdi_Coaching_Automation_Architecture.pptx
Belghamdi_Coaching_Automation_Architecture.pdf

README.md
TESTING_REPORT.md

## FINAL EXECUTION RULE

Do not stop after writing a plan.

Inspect the existing system, implement the missing workflows, test them, capture actual n8n screenshots using Playwright, and generate both presentation formats.

If access, credentials, or permissions are missing, report the exact blocker rather than inventing a result or claiming completion.
