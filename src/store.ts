import type { StorageAdapter } from "grammy";

// Persistent data store for the Habit Tracker bot.
// Uses an in-memory adapter (toolkit default) — production deploys use Redis.
// Durable data (habits, occurrences, stats) lives here, NOT in session.

// --- Types ---

export interface UserProfile {
  tz: string;
  reminderWindow?: string;
}

export type ScheduleType = "daily" | "weekdays" | "custom";

export interface Habit {
  id: string;
  title: string;
  scheduleType: ScheduleType;
  days?: number[];
  reminderTime?: string;
  createdAt: string;
}

export type OccurrenceStatus = "done" | "skipped" | "missed";

export interface Occurrence {
  status: OccurrenceStatus;
  timestamp: string;
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
}

// --- Internal key scheme (no keyspace scans) ---

function userProfileKey(userId: number): string {
  return `user:${userId}:profile`;
}

function habitIndexKey(userId: number): string {
  return `user:${userId}:habits`;
}

function habitKey(userId: number, habitId: string): string {
  return `user:${userId}:habit:${habitId}`;
}

function occurrenceKey(userId: number, habitId: string, date: string): string {
  return `user:${userId}:occ:${habitId}:${date}`;
}

// --- Storage reference ---

let storage: StorageAdapter<any>;

export function initStore(adapter: StorageAdapter<any>): void {
  storage = adapter;
}

// --- User profile ---

export async function getOrCreateProfile(userId: number): Promise<UserProfile> {
  const existing = await storage.read(userProfileKey(userId));
  if (existing) return existing as UserProfile;
  const profile: UserProfile = { tz: "UTC" };
  await storage.write(userProfileKey(userId), profile);
  return profile;
}

export async function updateProfile(userId: number, patch: Partial<UserProfile>): Promise<UserProfile> {
  const profile = await getOrCreateProfile(userId);
  const updated = { ...profile, ...patch };
  await storage.write(userProfileKey(userId), updated);
  return updated;
}

// --- Habits ---

export async function createHabit(userId: number, habit: Omit<Habit, "id" | "createdAt">): Promise<Habit> {
  const index = await getHabitIndex(userId);
  const id = `h_${Date.now()}_${index.length}`;
  const full: Habit = { ...habit, id, createdAt: new Date().toISOString() };
  await storage.write(habitKey(userId, id), full);
  index.push(id);
  await storage.write(habitIndexKey(userId), index);
  return full;
}

export async function getHabitIndex(userId: number): Promise<string[]> {
  const index = await storage.read(habitIndexKey(userId));
  return (index as string[]) ?? [];
}

export async function getHabit(userId: number, habitId: string): Promise<Habit | null> {
  const h = await storage.read(habitKey(userId, habitId));
  return (h as Habit) ?? null;
}

export async function getAllHabits(userId: number): Promise<Habit[]> {
  const ids = await getHabitIndex(userId);
  const habits: Habit[] = [];
  for (const id of ids) {
    const h = await getHabit(userId, id);
    if (h) habits.push(h);
  }
  return habits;
}

export async function updateHabit(userId: number, habitId: string, patch: Partial<Habit>): Promise<Habit | null> {
  const h = await getHabit(userId, habitId);
  if (!h) return null;
  const updated = { ...h, ...patch, id: h.id, createdAt: h.createdAt };
  await storage.write(habitKey(userId, habitId), updated);
  return updated;
}

export async function deleteHabit(userId: number, habitId: string): Promise<boolean> {
  const index = await getHabitIndex(userId);
  const at = index.indexOf(habitId);
  if (at < 0) return false;
  index.splice(at, 1);
  await storage.write(habitIndexKey(userId), index);
  await storage.delete(habitKey(userId, habitId));
  return true;
}

// --- Occurrences ---

export async function setOccurrence(
  userId: number,
  habitId: string,
  date: string,
  status: OccurrenceStatus,
): Promise<void> {
  const occ: Occurrence = { status, timestamp: new Date().toISOString() };
  await storage.write(occurrenceKey(userId, habitId, date), occ);
}

export async function getOccurrence(
  userId: number,
  habitId: string,
  date: string,
): Promise<Occurrence | null> {
  const occ = await storage.read(occurrenceKey(userId, habitId, date));
  return (occ as Occurrence) ?? null;
}

// --- Date helpers (injectable clock) ---

export function todayStr(nowFn: () => Date = () => new Date()): string {
  return nowFn().toISOString().slice(0, 10);
}

export function dateStrOffset(days: number, nowFn: () => Date = () => new Date()): string {
  const d = nowFn();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// --- Streaks & stats ---

export function isHabitDueToday(habit: Habit, nowFn: () => Date = () => new Date()): boolean {
  const d = nowFn();
  const day = d.getDay();
  if (habit.scheduleType === "daily") return true;
  if (habit.scheduleType === "weekdays") return day >= 1 && day <= 5;
  if (habit.scheduleType === "custom" && habit.days) return habit.days.includes(day);
  return true;
}

export async function computeStreak(
  userId: number,
  habit: Habit,
  nowFn: () => Date = () => new Date(),
): Promise<{ current: number; best: number }> {
  let current = 0;
  let best = 0;
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const d = new Date(nowFn());
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const occ = await getOccurrence(userId, habit.id, dateStr);
    if (occ?.status === "done") {
      streak++;
      if (i === current) current = streak;
    } else {
      if (streak > best) best = streak;
      streak = 0;
    }
  }
  if (streak > best) best = streak;

  return { current, best };
}

export async function computeCompletionRate(
  userId: number,
  habit: Habit,
  days: number,
  nowFn: () => Date = () => new Date(),
): Promise<number> {
  let done = 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(nowFn());
    d.setDate(d.getDate() - i);
    if (!isHabitDueToday(habit, () => d)) continue;
    total++;
    const occ = await getOccurrence(userId, habit.id, d.toISOString().slice(0, 10));
    if (occ?.status === "done") done++;
  }
  return total > 0 ? done / total : 0;
}

export function streakEmoji(streak: number): string {
  if (streak >= 90) return "🏆";
  if (streak >= 30) return "🔥";
  if (streak >= 14) return "💪";
  if (streak >= 7) return "⭐";
  if (streak >= 3) return "✨";
  return "";
}

export function milestoneMessage(streak: number): string | null {
  if (streak === 7) return "🎉 7 days in a row! You're building a real habit.";
  if (streak === 14) return "💪 2 weeks strong! You're on fire.";
  if (streak === 30) return "🔥 30 days! That's a lifestyle now.";
  if (streak === 90) return "🏆 90 days! You're unstoppable.";
  return null;
}
