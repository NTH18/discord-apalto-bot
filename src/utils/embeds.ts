import { APIEmbed } from 'discord.js';

const color = {
  ok: 0x35c46a,
  warn: 0xf5a623,
  err: 0xef5350,
};

export function ok(title: string, desc?: string): APIEmbed {
  return { title: `✅ ${title}`, description: desc, color: color.ok };
}
export function warn(title: string, desc?: string): APIEmbed {
  return { title: `⚠️ ${title}`, description: desc, color: color.warn };
}
export function err(title: string, desc?: string): APIEmbed {
  return { title: `❌ ${title}`, description: desc, color: color.err };
}
