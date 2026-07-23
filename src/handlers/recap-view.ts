import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  getAllHabits,
  getOccurrence,
  computeStreak,
  computeCompletionRate,
  todayStr,
  dateStrOffset,
  formatDate,
  streakEmoji,
  milestoneMessage,
} from "../store.js";

registerMainMenuItem({ label: "📊 Weekly Recap", data: "recap:view", order: 30 });

const composer = new Composer<Ctx>();

composer.callbackQuery("recap:view", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const habits = await getAllHabits(userId);

  if (habits.length === 0) {
    await ctx.editMessageText(
      "No habits to recap yet — tap ➕ Create Habit to start tracking.",
      { reply_markup: inlineKeyboard([[inlineButton("➕ Create Habit", "habit:create")]]) },
    );
    return;
  }

  const today = todayStr();
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const lines: string[] = ["📊 Weekly recap\n"];

  let totalDone = 0;
  let totalDue = 0;

  for (const h of habits) {
    const streak = await computeStreak(userId, h);
    const rate = await computeCompletionRate(userId, h, 7);
    const emoji = streakEmoji(streak.current);

    lines.push(`${emoji ? emoji + " " : ""}${h.title} — ${Math.round(rate * 100)}% this week`);

    const grid: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = dateStrOffset(-i);
      const occ = await getOccurrence(userId, h.id, d);
      if (occ?.status === "done") {
        grid.push("✅");
        totalDone++;
        totalDue++;
      } else if (occ?.status === "skipped") {
        grid.push("⏭");
        totalDue++;
      } else if (occ?.status === "missed") {
        grid.push("❌");
        totalDue++;
      } else {
        grid.push("·");
      }
    }
    lines.push(grid.join(" "));
  }

  const overallRate = totalDue > 0 ? Math.round((totalDone / totalDue) * 100) : 0;
  lines.push(`\nOverall: ${overallRate}% completion this week`);

  const milestones: string[] = [];
  for (const h of habits) {
    const streak = await computeStreak(userId, h);
    const msg = milestoneMessage(streak.current);
    if (msg) milestones.push(`${h.title}: ${msg}`);
  }
  if (milestones.length > 0) {
    lines.push("\n🎉 Milestones:");
    milestones.forEach((m) => lines.push(m));
  }

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
