/**
 * Remove todos os comandos globais (registrados em todos os servidores)
 * Use com cuidado — geralmente só para limpar duplicatas antigas.
 */

import 'dotenv/config';
import { REST, Routes } from 'discord.js';

const token = process.env.DISCORD_TOKEN ?? '';
const clientId = process.env.CLIENT_ID ?? '';

if (!token || !clientId) {
  console.error('❌ Preencha DISCORD_TOKEN e CLIENT_ID no .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  console.log('🧹 Limpando comandos globais...');
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('✅ Todos os comandos globais foram removidos.');
  } catch (err) {
    console.error('❌ Falha ao limpar comandos globais:', err);
  }
})();
