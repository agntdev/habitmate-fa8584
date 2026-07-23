import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  getHabit,
  setOccurrence,
  computeStreak,
  todayStr,
  milestoneMessage,
  streakEmoji,
} from "../store.js";

const composer = new Composer<Ctx>();

composer.callbackQuery(/^checkin:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const habitId = ctx.match[1];
  const userId = ctx.from?.id ?? 0;
  const habit = await getHabit(userId, habitId);
  if (!habit) {
    await ctx.reply("Couldn't find that habit. It may have been deleted.");
    return;
  }
  ctx.session.checkinHabitId = habitId;
  const today = todayStr();
  ctx.session.checkinDate = today;
  await ctx.reply(`Check in for "${habit.title}" today?`, {
    reply_markup: inlineKeyboard([
      [inlineButton("✅ Done", `checkin:${habitId}:done`), inlineButton("⏭ Skip", `checkin:${habitId}:skip`)],
      [inlineButton("❌ Missed", `checkin:${habitId}:missed`)],
      [inlineButton("⬅️ Back", "habits:view")],
    ]),
  });
});

composer.callbackQuery(/^checkin:(.+):(done|skipped|missed)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const habitId = ctx.match[1];
  const status = ctx.match[2] as "done" | "skipped" | "missed";
  const userId = ctx.from?.id ?? 0;
  const habit = await getHabit(userId, habitId);
  if (!habit) {
    await ctx.reply("Couldn't find that habit.");
    return;
  }
  const date = ctx.session.checkinDate ?? todayStr();
  await setOccurrence(userId, habitId, date, status);

  const streak = await computeStreak(userId, habit);
  const emoji = streakEmoji(streak.current);
  const milestone = milestoneMessage(streak.current);

  let msg: string;
  if (status === "done") {
    msg = `✅ Marked "${habit.title}" done! ${emoji}${streak.current > 0 ? ` ${streak.current} day streak` : ""}`;
  } else if (status === "skipped") {
    msg = `⏭ Skipped "${habit.title}" today. No worries — show up tomorrow!`;
  } else {
    msg = `❌ Marked "${habit.title}" as missed. Every day is a fresh start.`;
  }
  if (milestone) msg += `\n\n${milestone}`;

  ctx.session.checkinHabitId = undefined;
  ctx.session.checkinDate = undefined;

  await ctx.editMessageText(msg, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
