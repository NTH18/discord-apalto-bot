import 'dotenv/config';
import { REST, Routes } from 'discord.js';

function usage() {
  console.log(
    'Uso:\n' +
    '  tsx scripts/list-commands              # lista globais\n' +
    '  tsx scripts/list-commands <GUILD_ID>   # lista de uma guild\n'
  );
}

const token = process.env.DISCORD_TOKEN || '';
const clientId = process.env.CLIENT_ID || '';
const guildId = process.argv[2]?.trim();

if (!token || !clientId) {
  console.error('❌ Faltam variáveis no .env (DISCORD_TOKEN e CLIENT_ID).');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function listCommands() {
  try {
    if (guildId) {
      const res = (await rest.get(
        Routes.applicationGuildCommands(clientId, guildId)
      )) as any[];
      console.log(`📋 Comandos registrados na guild ${guildId}:`);
      for (const cmd of res) console.log(`• ${cmd.name}`);
    } else {
      const res = (await rest.get(
        Routes.applicationCommands(clientId)
      )) as any[];
      console.log('🌍 Comandos globais:');
      for (const cmd of res) console.log(`• ${cmd.name}`);
    }
  } catch (err) {
    console.error('❌ Falha ao listar comandos:', err);
    usage();
    process.exit(1);
  }
}

listCommands();