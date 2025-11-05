// src/scripts/deploy-commands
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

// ============================================================================
// 🔧 Função auxiliar para dividir variáveis múltiplas (separadas por vírgula)
// ============================================================================
const split = (v = '') => v.split(',').map(s => s.trim()).filter(Boolean);

// ============================================================================
// 🔐 Variáveis de ambiente
// ============================================================================
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildIds = split(process.env.GUILD_IDS);

if (!token || !clientId || !guildIds.length) {
  console.error('❌ Preencha DISCORD_TOKEN, CLIENT_ID e GUILD_IDS no .env');
  process.exit(1);
}

// ============================================================================
// 📦 Carregar comandos automaticamente de src/commands/
// ============================================================================
const commandsPath = path.join(process.cwd(), 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('') || f.endsWith('.js'));

const commands: any[] = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const { default: cmd } = await import(`../commands/${file}`);
    if (cmd?.data instanceof SlashCommandBuilder) {
      commands.push(cmd.data.toJSON());
      console.log(`🟢 Carregado comando: /${cmd.data.name}`);
    } else if (cmd?.data) {
      commands.push(cmd.data);
      console.log(`🟢 Carregado comando (obj): /${cmd.data.name}`);
    }
  } catch (e) {
    console.warn(`⚠️ Falha ao carregar ${file}:`, e);
  }
}

if (!commands.length) {
  console.error('❌ Nenhum comando encontrado em src/commands/');
  process.exit(1);
}

// ============================================================================
// 🚀 Publicar comandos nas guilds
// ============================================================================
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  console.log('▶️ Iniciando deploy de comandos...');
  for (const gid of guildIds) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, gid), { body: commands });
      console.log(`✅ Comandos atualizados na guild ${gid}`);
    } catch (err) {
      console.error(`❌ Falha ao publicar comandos em ${gid}:`, err);
    }
  }
})();
