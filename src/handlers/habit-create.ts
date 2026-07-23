import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { createHabit, type ScheduleType } from "../store.js";

registerMainMenuItem({ label: "➕ Create Habit", data: "habit:create", order: 10 });

const composer = new Composer<Ctx>();

composer.callbackQuery("habit:create", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_habit_title";
  await ctx.reply("What habit do you want to track?", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. Drink water, Read 10 pages" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_habit_title") return next();
  const title = ctx.message.text.trim();
  if (title.length < 1 || title.length > 64) {
    await ctx.reply("Keep it short — 1 to 64 characters.");
    return;
  }
  ctx.session.createTitle = title;
  ctx.session.step = "awaiting_habit_schedule";
  await ctx.reply(`Got it — "${title}". How often?`, {
    reply_markup: inlineKeyboard([
      [inlineButton("📅 Every day", "habit:sched:daily")],
      [inlineButton("💼 Weekdays", "habit:sched:weekdays")],
      [inlineButton("📆 Custom days", "habit:sched:custom")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("habit:sched:daily", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.createSchedule = "daily";
  ctx.session.step = "awaiting_habit_reminder";
  await ctx.reply("What time should I remind you?", {
    reply_markup: inlineKeyboard([
      [inlineButton("🌅 Morning (8:00)", "habit:time:08:00")],
      [inlineButton("☀️ Noon (12:00)", "habit:time:12:00")],
      [inlineButton("🌙 Evening (20:00)", "habit:time:20:00")],
      [inlineButton("✏️ Custom time", "habit:time:custom")],
    ]),
  });
});

composer.callbackQuery("habit:sched:weekdays", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.createSchedule = "weekdays";
  ctx.session.step = "awaiting_habit_reminder";
  await ctx.reply("What time should I remind you?", {
    reply_markup: inlineKeyboard([
      [inlineButton("🌅 Morning (8:00)", "habit:time:08:00")],
      [inlineButton("☀️ Noon (12:00)", "habit:time:12:00")],
      [inlineButton("🌙 Evening (20:00)", "habit:time:20:00")],
      [inlineButton("✏️ Custom time", "habit:time:custom")],
    ]),
  });
});

composer.callbackQuery("habit:sched:custom", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.createSchedule = "custom";
  ctx.session.step = "awaiting_habit_days";
  await ctx.reply("Which days? Tap to toggle, then confirm.", {
    reply_markup: inlineKeyboard([
      [
        inlineButton("Mon", "habit:day:1"),
        inlineButton("Tue", "habit:day:2"),
        inlineButton("Wed", "habit:day:3"),
        inlineButton("Thu", "habit:day:4"),
      ],
      [
        inlineButton("Fri", "habit:day:5"),
        inlineButton("Sat", "habit:day:6"),
        inlineButton("Sun", "habit:day:0"),
      ],
      [inlineButton("✅ Confirm days", "habit:days:confirm")],
      [inlineButton("⬅️ Back", "habit:create")],
    ]),
  });
});

composer.callbackQuery(/^habit:day:(\d)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const day = parseInt(ctx.match[1]);
  if (!ctx.session.createDays) ctx.session.createDays = [];
  const at = ctx.session.createDays.indexOf(day);
  if (at >= 0) ctx.session.createDays.splice(at, 1);
  else ctx.session.createDays.push(day);
});

composer.callbackQuery("habit:days:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const days = ctx.session.createDays ?? [];
  if (days.length === 0) {
    await ctx.reply("Pick at least one day.");
    return;
  }
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const labels = days.sort().map((d) => dayNames[d]).join(", ");
  ctx.session.step = "awaiting_habit_reminder";
  await ctx.reply(`Days: ${labels}. What time should I remind you?`, {
    reply_markup: inlineKeyboard([
      [inlineButton("🌅 Morning (8:00)", "habit:time:08:00")],
      [inlineButton("☀️ Noon (12:00)", "habit:time:12:00")],
      [inlineButton("🌙 Evening (20:00)", "habit:time:20:00")],
      [inlineButton("✏️ Custom time", "habit:time:custom")],
    ]),
  });
});

composer.callbackQuery(/^habit:time:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const time = ctx.match[1];
  if (time === "custom") {
    ctx.session.step = "awaiting_habit_custom_time";
    await ctx.reply("What time? Type it as HH:MM (e.g. 07:30).", {
      reply_markup: { force_reply: true, input_field_placeholder: "HH:MM" },
    });
    return;
  }
  ctx.session.createReminder = time;
  await showConfirm(ctx);
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_habit_custom_time") return next();
  const time = ctx.message.text.trim();
  if (!/^\d{1,2}:\d{2}$/.test(time)) {
    await ctx.reply("Please enter a valid time like 07:30 or 14:00.");
    return;
  }
  ctx.session.createReminder = time;
  await showConfirm(ctx);
});

async function showConfirm(ctx: Ctx) {
  ctx.session.step = "awaiting_habit_confirm";
  const title = ctx.session.createTitle ?? "Untitled";
  const schedule = ctx.session.createSchedule ?? "daily";
  const reminder = ctx.session.createReminder ?? "08:00";
  const schedLabel = schedule === "daily" ? "Every day" : schedule === "weekdays" ? "Weekdays" : "Custom";
  await ctx.reply(
    `Confirm your new habit:\n\n` +
    `📝 ${title}\n` +
    `🔁 ${schedLabel}\n` +
    `⏰ ${reminder}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✅ Create habit", "habit:create:confirm")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
}

composer.callbackQuery("habit:create:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session.step !== "awaiting_habit_confirm") return;
  const userId = ctx.from?.id ?? 0;
  const title = ctx.session.createTitle ?? "Untitled";
  const scheduleType = (ctx.session.createSchedule ?? "daily") as ScheduleType;
  const days = ctx.session.createDays;
  const reminderTime = ctx.session.createReminder;

  await createHabit(userId, {
    title,
    scheduleType,
    days: scheduleType === "custom" ? days : undefined,
    reminderTime,
  });

  ctx.session.step = undefined;
  ctx.session.createTitle = undefined;
  ctx.session.createSchedule = undefined;
  ctx.session.createDays = undefined;
  ctx.session.createReminder = undefined;

  await ctx.editMessageText(
    `✅ Habit created!\n\n` +
    `You're tracking "${title}" ${reminderTime ? `with a reminder at ${reminderTime}` : ""}. Keep it up!`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

composer.callbackQuery("menu:main", async (ctx) => {
  ctx.session.step = undefined;
  ctx.session.createTitle = undefined;
  ctx.session.createSchedule = undefined;
  ctx.session.createDays = undefined;
  ctx.session.createReminder = undefined;
});

export default composer;
