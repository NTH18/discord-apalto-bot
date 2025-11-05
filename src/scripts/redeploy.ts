// src/scripts/redeploy
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

// ============================================================================
// 🔧 Função auxiliar para quebrar listas separadas por vírgula
// ============================================================================
const split = (v = '') => v.split(',').map(s => s.trim()).filter(Boolean);

// ============================================================================
// 🔐 Carregar variáveis de ambiente
// ============================================================================
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildIds = split(process.env.GUILD_IDS);

if (!token || !clientId || !guildIds.length) {
  console.error('❌ Defina DISCORD_TOKEN, CLIENT_ID e GUILD_IDS no .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

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
    if (cmd?.data) {
      commands.push(cmd.data.toJSON?.() ?? cmd.data);
      console.log(`🟢 Comando carregado: /${cmd.data.name}`);
    }
  } catch (e) {
    console.warn(`⚠️ Falha ao importar comando ${file}:`, e);
  }
}

// ============================================================================
// 🚀 Processo automatizado de redeploy
// ============================================================================
(async () => {
  console.log('\n⚙️ Iniciando redeploy completo...\n');

  // 1️⃣ Limpa comandos globais
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('🧹 Comandos globais limpos.');
  } catch (err) {
    console.error('❌ Erro ao limpar comandos globais:', err);
  }

  // 2️⃣ Limpa comandos das guilds
  for (const gid of guildIds) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, gid), { body: [] });
      console.log(`🧹 Comandos removidos da guild ${gid}`);
    } catch (err) {
      console.error(`❌ Erro ao limpar comandos da guild ${gid}:`, err);
    }
  }

  // 3️⃣ Publica comandos atualizados
  for (const gid of guildIds) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, gid), { body: commands });
      console.log(`✅ Comandos atualizados na guild ${gid}`);
    } catch (err) {
      console.error(`❌ Erro ao publicar comandos na guild ${gid}:`, err);
    }
  }

  console.log('\n🎉 Redeploy finalizado com sucesso!');
})();
