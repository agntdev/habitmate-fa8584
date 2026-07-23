import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getAllHabits, computeStreak, getOccurrence, todayStr, streakEmoji } from "../store.js";

registerMainMenuItem({ label: "📋 My Habits", data: "habits:view", order: 20 });

const composer = new Composer<Ctx>();

composer.callbackQuery("habits:view", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const habits = await getAllHabits(userId);

  if (habits.length === 0) {
    await ctx.editMessageText(
      "No habits yet — tap ➕ Create Habit to start tracking.",
      { reply_markup: inlineKeyboard([[inlineButton("➕ Create Habit", "habit:create")]]) },
    );
    return;
  }

  const today = todayStr();
  const lines: string[] = ["Your habits:\n"];
  const buttons: ReturnType<typeof inlineButton>[][] = [];

  for (const h of habits) {
    const streak = await computeStreak(userId, h);
    const emoji = streakEmoji(streak.current);
    const occ = await getOccurrence(userId, h.id, today);
    const status = occ?.status === "done" ? " ✅" : "";
    lines.push(`${emoji ? emoji + " " : ""}${h.title}${status} — ${streak.current} day streak`);
    buttons.push([
      inlineButton(`✅ Check in`, `checkin:${h.id}`),
      inlineButton(`✏️ Edit`, `edit:${h.id}`),
      inlineButton(`🗑 Delete`, `delete:${h.id}`),
    ]);
  }

  buttons.push([inlineButton("➕ Add another", "habit:create")]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(buttons),
  });
});

export default composer;
