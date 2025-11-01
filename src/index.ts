import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, Partials } from 'discord.js';
import apalto from './commands/apalto.ts';
import interactionCreate from './events/interactionCreate.ts';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.GuildMember],
}) as Client & { commands: Collection<string, any> };

client.commands = new Collection();
client.commands.set(apalto.data.name, apalto);

// ⚠️ apenas UM listener de InteractionCreate (o seu events/interactionCreate.ts cuida do painel)
client.once(Events.ClientReady, (c) => console.log(`✅ Logado como ${c.user.tag}`));

client.on(Events.InteractionCreate, async (i) => {
  // Slash commands
  if (i.isChatInputCommand()) {
    const cmd = client.commands.get(i.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(i, client);
    } catch (e) {
      console.error('apalto execute error:', e);
      if (i.deferred || i.replied) {
        await i.followUp({ content: 'Ocorreu um erro ao executar o comando.', flags: 64 }).catch(() => {});
      } else {
        await i.reply({ content: 'Ocorreu um erro ao executar o comando.', flags: 64 }).catch(() => {});
      }
    }
    return;
  }

  // Painel / botões / selects / modal
  try {
    await (interactionCreate as any).execute(i);
  } catch (e) {
    console.error('interactionCreate top-level error:', e);
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ Falta DISCORD_TOKEN no .env');
  process.exit(1);
}
client.login(token);