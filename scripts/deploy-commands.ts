import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

function splitIds(v?: string) {
  return (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

const token = process.env.DISCORD_TOKEN || '';
const clientId = process.env.CLIENT_ID || '';
const guildIds = splitIds(process.env.GUILD_IDS);

if (!token || !clientId) {
  console.error('❌ Falta DISCORD_TOKEN ou CLIENT_ID no .env');
  process.exit(1);
}
if (!guildIds.length) {
  console.error('❌ GUILD_IDS vazio! Preencha GUILD_IDS com as guilds onde quer publicar o comando.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('apalto')
    .setDescription('Cria duas calls privadas para ap-alto (TIME 1 e TIME 2).')
    .setDMPermission(false)
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(token);

async function main() {
  console.log('▶️  Deploy por guild…', { clientId, guildIds });

  // limpa comandos globais pra não confundir
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('��� Globais limpos.');
  } catch {}

  for (const gid of guildIds) {
    try {
      const res = await rest.put(Routes.applicationGuildCommands(clientId, gid), { body: commands });
      console.log(`✅ Comandos registrados na guild ${gid}.`, res as any);
    } catch (err) {
      console.error(`❌ Falha ao registrar na guild ${gid}:`, err);
    }
  }
}
main().catch(console.error);
