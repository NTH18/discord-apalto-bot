import 'dotenv/config';
import { REST, Routes } from 'discord.js';

function usage() {
  console.log(
    'Uso:\n' +
    '  tsx scripts/list-commands.ts              # lista globais\n' +
    '  tsx scripts/list-commands.ts <GUILD_ID>   # lista de uma guild\n'
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

async function listGlobals() {
  const res = await rest.get(Routes.applicationCommands(clientId)) as any[];
  console.log(`� Comandos globais (${res.length}):`);
  for (const c of res) console.log(`- ${c.name} (id=${c.id})`);
}

async function listGuild(gid: string) {
  const res = await rest.get(Routes.applicationGuildCommands(clientId, gid)) as any[];
  console.log(`� Comandos da guild ${gid} (${res.length}):`);
  for (const c of res) console.log(`- ${c.name} (id=${c.id})`);
}

(async () => {
  try {
    if (guildId) await listGuild(guildId);
    else await listGlobals();
  } catch (err) {
    console.error('❌ Falha ao listar comandos:', err);
    usage();
    process.exit(1);
  }
})();
