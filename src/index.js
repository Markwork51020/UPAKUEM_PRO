import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { askLLM } from './llm.js';
import { PRICE_LIST, DISCOUNT_FIRST_ORDER } from './price.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Per-user conversation history: Map<userId, Array<{role, content}>>
const sessions = new Map();

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(num) {
  return Math.round(num).toLocaleString('ru-RU').replace(/,/g, ' ');
}

function calculateKP(services) {
  const lines = [];
  let hasUnknown = false;

  for (const s of services) {
    const priceItem = PRICE_LIST[s.name];
    if (!priceItem) {
      hasUnknown = true;
      continue;
    }
    const total = priceItem.price * s.qty;
    lines.push({ name: s.name, qty: s.qty, unit: s.unit || priceItem.unit, unitPrice: priceItem.price, total });
  }

  const sum = lines.reduce((acc, l) => acc + l.total, 0);
  const discount = Math.round(sum * DISCOUNT_FIRST_ORDER);
  const finalPrice = sum - discount;
  return { lines, sum, discount, finalPrice, hasUnknown };
}

function buildKPMessage({ lines, sum, discount, finalPrice, hasUnknown }) {
  const itemLines = lines
    .map(l => `• ${l.name} × ${fmt(l.qty)} ${l.unit} = ${fmt(l.total)} ₽`)
    .join('\n');

  let text = `🏭 *Коммерческое предложение*
━━━━━━━━━━━━━━━━━━━━━
*Upakuem\\.pro* — фулфилмент под ключ

📦 *Расчёт стоимости:*

${itemLines}

━━━━━━━━━━━━━━━━━━━━━
💵 Сумма: ${fmt(sum)} ₽
🎁 Скидка 20% на первый заказ: \\-${fmt(discount)} ₽
💰 *Итого к оплате: ${fmt(finalPrice)} ₽*

✅ *Что входит в работу:*
— Приёмка и ответственное хранение
— Упаковка и маркировка под требования маркетплейса
— Контроль качества
— Доставка на склады маркетплейсов \\(по запросу\\)

🚀 *Почему выбирают нас:*
— Работаем с WB и OZON ежедневно
— Отгрузка в день обращения
— Личный менеджер на каждый заказ
— Прозрачный расчёт без скрытых платежей

📞 *Готовы к работе — пишите нам:*
Telegram: @Upakuem\\_pro
Телефон: 8 \\(966\\) 161\\-43\\-00`;

  if (hasUnknown) {
    text += '\n\n⚠️ Некоторые услуги не удалось сопоставить с прайсом\\. Менеджер уточнит детали\\.';
  }

  return text;
}

function buildShortPrice() {
  const categories = [
    { label: 'Приёмка товара', keys: ['Приёмка и пересчёт поштучно', 'Приёмка коробами', 'Приёмка паллетами'] },
    { label: 'Маркировка', keys: ['Маркировка штрихкодом / этикеткой', 'Маркировка Честный знак'] },
    { label: 'Упаковка (ПВД-рукав)', keys: ['ПВД-рукав до 15 см', 'ПВД-рукав до 20 см', 'ПВД-рукав до 30 см'] },
    { label: 'Паллетирование', keys: ['Формирование паллеты', 'Подготовка и отгрузка паллеты'] },
    { label: 'Хранение', keys: ['Хранение паллетоместа', 'Хранение объёма до 1 м³'] },
    { label: 'Доставка FBO', keys: ['Доставка коробами (ближние склады МП)', 'Доставка паллетами (ближние склады МП)'] },
  ];

  let lines = ['📋 *Краткий прайс\\-лист Upakuem\\.pro*\n'];
  for (const cat of categories) {
    lines.push(`\n*${escMd(cat.label)}*`);
    for (const key of cat.keys) {
      const item = PRICE_LIST[key];
      if (item) lines.push(`• ${escMd(key)}: ${fmt(item.price)} ₽/${escMd(item.unit)}`);
    }
  }
  lines.push('\n_Полный прайс — по запросу\\. Для расчёта КП просто опишите заказ\\._');
  return lines.join('\n');
}

function escMd(str) {
  return str.replace(/[_*[\]()~`>#+=|{}.!\-]/g, '\\$&');
}

// ─── Commands ────────────────────────────────────────────────────────────────

bot.start(ctx => {
  sessions.delete(ctx.from.id);
  return ctx.reply(
    'Привет\\! Я помогу рассчитать стоимость фулфилмента\\.\n\nОпишите ваш заказ: что за товар, сколько штук, какие услуги нужны\\.',
    { parse_mode: 'MarkdownV2' }
  );
});

bot.command('help', ctx =>
  ctx.reply(
    '*Как пользоваться ботом:*\n\n' +
    '1\\. Напишите, что нужно сделать с вашим товаром \\(принять, упаковать, промаркировать, отгрузить\\)\\.\n' +
    '2\\. Укажите количество штук/коробов/паллет\\.\n' +
    '3\\. Бот рассчитает стоимость и пришлёт коммерческое предложение\\.\n\n' +
    '*Пример:*\n' +
    '_Нужно принять 5000 футболок, промаркировать честный знак, упаковать в ПВД до 20 см и отгрузить на WB коробами \\(100 коробов\\)\\._\n\n' +
    '/price — краткий прайс\\-лист\n' +
    '/start — начать заново',
    { parse_mode: 'MarkdownV2' }
  )
);

bot.command('price', ctx =>
  ctx.reply(buildShortPrice(), { parse_mode: 'MarkdownV2' })
);

// ─── Main handler ─────────────────────────────────────────────────────────────

bot.on(message('text'), async ctx => {
  const userId = ctx.from.id;
  const userText = ctx.message.text;

  if (!sessions.has(userId)) sessions.set(userId, []);
  const history = sessions.get(userId);

  history.push({ role: 'user', content: userText });

  let thinking;
  try {
    thinking = await ctx.reply('⏳ Считаю...');
  } catch (_) {
    // non-critical
  }

  let result;
  try {
    result = await askLLM(history);
  } catch (err) {
    console.error('LLM error:', err);
    if (thinking) await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});
    history.pop(); // revert so user can retry
    return ctx.reply('Не удалось распознать заказ\\. Попробуйте описать подробнее\\.', { parse_mode: 'MarkdownV2' });
  }

  if (thinking) await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});

  if (result.need_clarification) {
    history.push({ role: 'assistant', content: JSON.stringify(result) });
    return ctx.reply(escMd(result.need_clarification), { parse_mode: 'MarkdownV2' });
  }

  if (!Array.isArray(result.services) || result.services.length === 0) {
    history.pop();
    return ctx.reply('Не удалось распознать заказ\\. Попробуйте описать подробнее\\.', { parse_mode: 'MarkdownV2' });
  }

  history.push({ role: 'assistant', content: JSON.stringify(result) });

  const kp = calculateKP(result.services);

  if (kp.lines.length === 0) {
    return ctx.reply(
      'Не удалось сопоставить услуги с прайсом\\. Менеджер свяжется с вами для уточнения деталей\\.\n\nTelegram: @Upakuem\\_pro',
      { parse_mode: 'MarkdownV2' }
    );
  }

  // Reset session after successful KP
  sessions.delete(userId);

  return ctx.reply(buildKPMessage(kp), { parse_mode: 'MarkdownV2' });
});

// ─── Launch ───────────────────────────────────────────────────────────────────

bot.launch(() => console.log('Bot started'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
