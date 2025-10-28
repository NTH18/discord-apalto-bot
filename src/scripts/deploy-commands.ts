import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, ChannelType } from 'discord.js';

const split = (v?: string) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);

const token = process.env.DISCORD_TOKEN ?? '';
const clientId = process.env.CLIENT_ID ?? '';
const guildIds = split(process.env.GUILD_IDS);

if (!token || !clientId || !guildIds.length) {
  console.error('❌ Preencha DISCORD_TOKEN, CLIENT_ID e GUILD_IDS no .env');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('apalto')
    .setDescription('Cria duas calls privadas para ap-alto (TIME 1 e TIME 2).')
    .addChannelOption(opt =>
      opt.setName('categoria')
        .setDescription('Categoria onde as calls serão criadas')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .setDMPermission(false)
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  console.log('▶️  Deploy por guild…', { clientId, guildIds });
  try { await rest.put(Routes.applicationCommands(clientId), { body: [] }); console.log('🧹 Globais limpos.'); } catch {}
  for (const gid of guildIds) {
    try {
      const res = await rest.put(Routes.applicationGuildCommands(clientId, gid), { body: commands });
      console.log(`✅ Comandos publicados na guild ${gid}.`, res as any);
    } catch (err) {
      console.error(`❌ Falha ao publicar na guild ${gid}:`, err);
    }
  }
})();
