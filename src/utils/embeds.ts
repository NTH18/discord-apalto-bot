import { EmbedBuilder } from "discord.js";

export const ok = (title: string, desc?: string) =>
  new EmbedBuilder().setColor(0x2ecc71).setTitle(`✅ ${title}`).setDescription(desc ?? '');

export const err = (title: string, desc?: string) =>
  new EmbedBuilder().setColor(0xe74c3c).setTitle(`❌ ${title}`).setDescription(desc ?? '');

export const warn = (title: string, desc?: string) =>
  new EmbedBuilder().setColor(0xf1c40f).setTitle(`⚠️ ${title}`).setDescription(desc ?? '');
