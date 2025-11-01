import 'dotenv/config';

const redact = (s?: string) => (s ? s.slice(0, 7) + '…' : '');

console.log('ENV lido pelo Node:');
console.log({
  DISCORD_TOKEN: redact(process.env.DISCORD_TOKEN),
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_IDS: process.env.GUILD_IDS,
  DEFAULT_CATEGORY_IDS: process.env.DEFAULT_CATEGORY_IDS,
  STAFF_ROLE_IDS: process.env.STAFF_ROLE_IDS,
  EMPTY_MINUTES: process.env.EMPTY_MINUTES,
});