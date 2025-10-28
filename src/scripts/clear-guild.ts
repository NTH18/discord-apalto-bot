// scripts/clear-guild.ts
import 'dotenv/config';
import { REST, Routes } from 'discord.js';

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.CLIENT_ID!;
const guildId = process.argv[2];

if (!token || !clientId || !guildId) {
  console.error('Uso: tsx scripts/clear-guild.ts <GUILD_ID>');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  const res = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
  console.log(`🧹 Limpei os comandos da guild ${guildId}.`, res as any);
})();
