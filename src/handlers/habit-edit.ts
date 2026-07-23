import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getHabit, updateHabit, type ScheduleType } from "../store.js";

const composer = new Composer<Ctx>();

composer.callbackQuery(/^edit:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const habitId = ctx.match[1];
  const userId = ctx.from?.id ?? 0;
  const habit = await getHabit(userId, habitId);
  if (!habit) {
    await ctx.reply("Couldn't find that habit.");
    return;
  }
  ctx.session.editingHabitId = habitId;
  const schedLabel = habit.scheduleType === "daily" ? "Every day" : habit.scheduleType === "weekdays" ? "Weekdays" : "Custom";
  await ctx.reply(
    `Editing "${habit.title}"\n\n` +
    `Current: ${schedLabel}${habit.reminderTime ? ` at ${habit.reminderTime}` : ""}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✏️ Change title", `editfield:${habitId}:title`)],
        [inlineButton("🔁 Change schedule", `editfield:${habitId}:schedule`)],
        [inlineButton("⏰ Change reminder", `editfield:${habitId}:reminder`)],
        [inlineButton("⬅️ Back", "habits:view")],
      ]),
    },
  );
});

composer.callbackQuery(/^editfield:(.+):title$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_edit_title";
  await ctx.reply("What should the new title be?", {
    reply_markup: { force_reply: true, input_field_placeholder: "New habit title" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_edit_title") return next();
  const title = ctx.message.text.trim();
  if (title.length < 1 || title.length > 64) {
    await ctx.reply("Keep it short — 1 to 64 characters.");
    return;
  }
  const habitId = ctx.session.editingHabitId;
  if (!habitId) return next();
  const userId = ctx.from?.id ?? 0;
  await updateHabit(userId, habitId, { title });
  ctx.session.step = undefined;
  await ctx.reply(`✅ Updated to "${title}".`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

composer.callbackQuery(/^editfield:(.+):schedule$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const habitId = ctx.match[1];
  ctx.session.step = "awaiting_edit_schedule";
  ctx.session.editingHabitId = habitId;
  await ctx.reply("Choose a new schedule:", {
    reply_markup: inlineKeyboard([
      [inlineButton("📅 Every day", `editsched:${habitId}:daily`)],
      [inlineButton("💼 Weekdays", `editsched:${habitId}:weekdays`)],
      [inlineButton("📆 Custom days", `editsched:${habitId}:custom`)],
      [inlineButton("⬅️ Back", `edit:${habitId}`)],
    ]),
  });
});

composer.callbackQuery(/^editsched:(.+):(daily|weekdays|custom)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const habitId = ctx.match[1];
  const scheduleType = ctx.match[2] as ScheduleType;
  const userId = ctx.from?.id ?? 0;
  await updateHabit(userId, habitId, { scheduleType });
  ctx.session.step = undefined;
  await ctx.reply(`✅ Schedule updated to ${scheduleType}.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

composer.callbackQuery(/^editfield:(.+):reminder$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const habitId = ctx.match[1];
  ctx.session.step = "awaiting_edit_reminder";
  ctx.session.editingHabitId = habitId;
  await ctx.reply("What time should I remind you?", {
    reply_markup: inlineKeyboard([
      [inlineButton("🌅 Morning (8:00)", `edittime:${habitId}:08:00`)],
      [inlineButton("☀️ Noon (12:00)", `edittime:${habitId}:12:00`)],
      [inlineButton("🌙 Evening (20:00)", `edittime:${habitId}:20:00`)],
      [inlineButton("✏️ Custom time", `edittime:${habitId}:custom`)],
    ]),
  });
});

composer.callbackQuery(/^edittime:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const habitId = ctx.match[1];
  const time = ctx.match[2];
  if (time === "custom") {
    ctx.session.step = "awaiting_edit_custom_time";
    ctx.session.editingHabitId = habitId;
    await ctx.reply("Type the time as HH:MM (e.g. 07:30).", {
      reply_markup: { force_reply: true, input_field_placeholder: "HH:MM" },
    });
    return;
  }
  const userId = ctx.from?.id ?? 0;
  await updateHabit(userId, habitId, { reminderTime: time });
  ctx.session.step = undefined;
  await ctx.reply(`✅ Reminder set to ${time}.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_edit_custom_time") return next();
  const time = ctx.message.text.trim();
  if (!/^\d{1,2}:\d{2}$/.test(time)) {
    await ctx.reply("Please enter a valid time like 07:30 or 14:00.");
    return;
  }
  const habitId = ctx.session.editingHabitId;
  if (!habitId) return next();
  const userId = ctx.from?.id ?? 0;
  await updateHabit(userId, habitId, { reminderTime: time });
  ctx.session.step = undefined;
  ctx.session.editingHabitId = undefined;
  await ctx.reply(`✅ Reminder set to ${time}.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

composer.callbackQuery("menu:main", async (ctx) => {
  ctx.session.step = undefined;
  ctx.session.editingHabitId = undefined;
});

export default composer;
