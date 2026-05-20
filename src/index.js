import 'dotenv/config';
import { bot } from './bot.js';

bot.launch(() => console.log('Bot started'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
