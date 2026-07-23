# Habit Tracker — Bot specification

**Archetype:** workflow

**Voice:** encouraging and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot that helps users create and track multiple habits with flexible schedules, gentle reminders, and progress tracking. Users can check in with one tap, view streaks, and receive weekly recaps, all with an encouraging tone and complete privacy.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Individual Telegram users seeking a simple, private habit tracker

## Success criteria

- Users can create and track habits with custom schedules
- Users receive timely, grouped reminders with one-tap check-ins
- Users can view streaks, completion rates, and weekly recaps

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **Create Habit** (button, actor: user, callback: habit:create) — Start creating a new habit with guided prompts
  - inputs: Habit title, Schedule type, Reminder time
  - outputs: New habit created in user profile
- **View Habits** (button, actor: user, callback: habits:view) — Show current active habits and quick actions
  - inputs: User profile data
  - outputs: List of habits with status and actions
- **Weekly Recap** (button, actor: user, callback: recap:view) — Show weekly summary of habit progress
  - inputs: User habit data
  - outputs: Weekly recap with stats and milestones

## Flows

### Onboarding
_Trigger:_ /start

1. Detect user timezone
2. Prompt for first habit creation
3. Show quick tutorial

_Data touched:_ User profile, Habit

### Create/Edit Habit
_Trigger:_ habit:create or habit:edit

1. Prompt for habit title
2. Select schedule type (daily/weekdays/N-times-per-week)
3. Set reminder time
4. Confirm creation/edit

_Data touched:_ Habit

### Reminder Handling
_Trigger:_ Scheduled event

1. Group habits with same reminder time
2. Send grouped reminder message
3. Process one-tap check-in (Done/Skip/Mark Missed)

_Data touched:_ Occurrence, Streaks & stats

### Manual Check-in
_Trigger:_ User command or history view

1. Select habit and date
2. Choose status (Done/Skipped/Missed)
3. Update occurrence and stats

_Data touched:_ Occurrence, Streaks & stats

### Weekly Recap
_Trigger:_ Scheduled weekly event

1. Generate 7-day summary grid
2. Calculate completion rates and streaks
3. Add encouraging milestone note
4. Send recap to user

_Data touched:_ Occurrence, Streaks & stats

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User Profile** _(retention: persistent)_ — User-specific settings and preferences
  - fields: timezone, preferred reminder window, language
- **Habit** _(retention: persistent)_ — User-created habit with schedule and status
  - fields: title, schedule type, target N, reminder time, status
- **Occurrence** _(retention: persistent)_ — Daily status of a habit
  - fields: date, status, timestamp
- **Streaks & Stats** _(retention: persistent)_ — Progress metrics for habits
  - fields: current streak, best streak, completion rate

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure premium tier features
- Set data retention policies
- Manage notification templates

## Notifications

- Scheduled reminders with grouped habits
- Weekly recap summaries
- Milestone celebrations (7/14/30/90 days)

## Permissions & privacy

- All user data is private by default
- No external sharing without explicit user request
- Data export available on request

## Edge cases

- Timezone changes mid-tracking period
- Multiple habits with same reminder time
- Editing past occurrences within 7-day window
- Missed reminders after midnight

## Required tests

- End-to-end onboarding flow with habit creation
- Grouped reminder handling with multiple habits
- Weekly recap generation with milestone detection
- Manual check-in for past 7 days with edits

## Assumptions

- Users will want to track 1-10 habits simultaneously
- Most users will check in during scheduled reminders
- Milestone celebrations will be appreciated without being cheesy
