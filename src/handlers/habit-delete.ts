import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getHabit, deleteHabit } from "../store.js";

const composer = new Composer<Ctx>();

composer.callbackQuery(/^delete:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const habitId = ctx.match[1];
  const userId = ctx.from?.id ?? 0;
  const habit = await getHabit(userId, habitId);
  if (!habit) {
    await ctx.reply("Couldn't find that habit.");
    return;
  }
  await ctx.reply(
    `Delete "${habit.title}"?\n\nThis can't be undone.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🗑 Delete", `delete:${habitId}:confirm`), inlineButton("Cancel", "habits:view")],
      ]),
    },
  );
});

composer.callbackQuery(/^delete:(.+):confirm$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const habitId = ctx.match[1];
  const userId = ctx.from?.id ?? 0;
  const deleted = await deleteHabit(userId, habitId);
  if (!deleted) {
    await ctx.reply("Couldn't find that habit.");
    return;
  }
  await ctx.editMessageText("🗑 Habit deleted.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
