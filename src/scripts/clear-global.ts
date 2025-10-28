import 'dotenv/config';
import { REST, Routes } from 'discord.js';

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.CLIENT_ID!;

if (!token || !clientId) {
  console.error('❌ Faltam DISCORD_TOKEN/CLIENT_ID no .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function main() {
  const res = await rest.put(Routes.applicationCommands(clientId), { body: [] });
  console.log('🧹 Globais limpos:', res as any);
}
main().catch(console.error);
