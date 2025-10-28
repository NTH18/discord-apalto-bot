// src/events/interactionCreate.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  Events,
  GuildBasedChannel,
  GuildMember,
  Interaction,
  ModalBuilder,
  PermissionFlagsBits,
  RepliableInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  VoiceChannel,
  MessageActionRowComponentBuilder,
} from 'discord.js';
import { grantTeamAccessForLeaders } from '../utils/voiceManager.ts';
import { ok, err, warn } from '../utils/embeds.ts';

type TempStore = { leader1?: string; leader2?: string };
const store = new Map<string, TempStore>();
const keyOf = (t1: string, t2: string) => `${t1}:${t2}`;

async function safeRespond(
  i: Interaction,
  payload: Parameters<RepliableInteraction['reply']>[0],
) {
  const ix = i as unknown as RepliableInteraction;
  if (ix.deferred || ix.replied) return ix.followUp(payload).catch(() => {});
  return ix.reply(payload).catch(() => {});
}

function isStaff(member: GuildMember | null): boolean {
  return !!member?.permissions?.has?.(PermissionFlagsBits.ManageChannels);
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    try {
      if (!interaction.isButton() && !interaction.isAnySelectMenu() && !interaction.isModalSubmit()) return;
      if (!interaction.customId?.startsWith?.('apalto:')) return;

      if (!interaction.inCachedGuild()) {
        await safeRespond(interaction, { embeds: [err('Use em um servidor')], ephemeral: true });
        return;
      }

      const member = interaction.member as GuildMember | null;
      if (!isStaff(member)) {
        await safeRespond(interaction, {
          embeds: [err('Sem permissão', 'Você precisa de **Gerenciar Canais**.')],
          ephemeral: true,
        });
        return;
      }

      const parts = interaction.customId.split(':');
      const action = parts[1];

      // ===== Botões =====
      if (interaction.isButton()) {
        if (action === 'pickL1' || action === 'pickL2') {
          const t1 = parts[2];
          const t2 = parts[3];

          await interaction.deferUpdate().catch(() => {});

          const target = action === 'pickL1' ? 'leader1' : 'leader2';
          const label = action === 'pickL1' ? 'Escolha o líder do TIME 1' : 'Escolha o líder do TIME 2';

          const pick = new UserSelectMenuBuilder()
            .setCustomId(`apalto:${target}:${t1}:${t2}`)
            .setMinValues(1)
            .setMaxValues(1)
            .setPlaceholder(label);

          const informId = new ButtonBuilder()
            .setCustomId(`apalto:enterid:${target}:${t1}:${t2}`)
            .setLabel('Informar ID')
            .setStyle(ButtonStyle.Secondary);

          const row1 = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(pick);
          const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(informId);

          await interaction.followUp({ content: label, components: [row1, row2], ephemeral: true }).catch(() => {});
          return;
        }

        if (action === 'finalize') {
          const t1 = parts[2];
          const t2 = parts[3];
          const k = keyOf(t1, t2);

          await interaction.deferUpdate().catch(() => {});

          const saved = store.get(k);
          if (!saved || (!saved.leader1 && !saved.leader2)) {
            await safeRespond(interaction, {
              embeds: [warn('Nada selecionado', 'Defina pelo menos um líder antes de aplicar.')],
              ephemeral: true,
            });
            return;
          }

          const guild = interaction.guild!;
          const me = guild.members.me;
          if (!me) {
            await safeRespond(interaction, { embeds: [err('Falha', 'Bot não resolvido na guild.')], ephemeral: true });
            return;
          }

          const ch1 = await guild.channels.fetch(t1).catch(() => null);
          const ch2 = await guild.channels.fetch(t2).catch(() => null);
          const asVoice = (c: GuildBasedChannel | null) => (c && c.isVoiceBased() ? (c as VoiceChannel) : null);
          const v1 = asVoice(ch1);
          const v2 = asVoice(ch2);

          if (!v1 || !v2) {
            await safeRespond(interaction, {
              embeds: [err('Canais inexistentes', 'As calls não existem mais. Use **/apalto** novamente.')],
              ephemeral: true,
            });
            return;
          }

          const needed = [
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
          ];
          const missing: string[] = [];
          for (const p of needed) {
            if (!v1.permissionsFor(me).has(p) || !v2.permissionsFor(me).has(p)) {
              switch (p) {
                case PermissionFlagsBits.ManageChannels: missing.push('Gerenciar Canais'); break;
                case PermissionFlagsBits.MoveMembers:    missing.push('Mover Membros'); break;
                case PermissionFlagsBits.MuteMembers:    missing.push('Mutar Membros'); break;
                case PermissionFlagsBits.DeafenMembers:  missing.push('Ensurdecer Membros'); break;
              }
            }
          }
          if (missing.length) {
            await safeRespond(interaction, {
              embeds: [err('Permissões insuficientes', `Conceda ao bot na **categoria** (ou nos canais) as permissões: ${missing.join(', ')}.`)],
              ephemeral: true,
            });
            return;
          }

          try {
            await grantTeamAccessForLeaders({
              client: interaction.client,
              guildId: guild.id,
              team1Id: v1.id,
              team2Id: v2.id,
              leader1Id: saved.leader1,
              leader2Id: saved.leader2,
            });

            const msg = interaction.message;
            if (msg && msg.editable) {
              const newRows = (msg.components as any[]).map((r) => {
                const existing = ActionRowBuilder.from(r) as ActionRowBuilder<MessageActionRowComponentBuilder>;
                const rebuilt = new ActionRowBuilder<MessageActionRowComponentBuilder>();
                const comps = (existing.components ?? []) as MessageActionRowComponentBuilder[];

                for (const c of comps) {
                  if ((c as any).data?.type === ComponentType.Button) {
                    rebuilt.addComponents(ButtonBuilder.from(c as any).setDisabled(true));
                  } else {
                    rebuilt.addComponents(c as any);
                  }
                }
                return rebuilt;
              });

              await msg.edit({ components: newRows }).catch(() => {});
            }

            await safeRespond(interaction, { embeds: [ok('Permissões aplicadas', 'Os líderes já têm acesso.')], ephemeral: true });
          } catch (e: any) {
            console.error('[apalto] finalize error:', e);
            await safeRespond(interaction, { embeds: [err('Erro ao aplicar', e?.message ?? 'Falha inesperada.')], ephemeral: true });
          }
          return;
        }

        if (action === 'enterid') {
          const target = parts[2] as 'leader1' | 'leader2';
          const t1 = parts[3];
          const t2 = parts[4];

          try {
            const modal = new ModalBuilder()
              .setCustomId(`apalto:modal:${target}:${t1}:${t2}`)
              .setTitle('Informar ID do usuário');

            // ⚠️ Rótulo curto (<= 45 chars) + exemplo no placeholder – evita "Invalid string length"
            const input = new TextInputBuilder()
              .setCustomId('userId')
              .setLabel('ID do usuário')
              .setPlaceholder('Ex.: 123456789012345678')
              .setStyle(TextInputStyle.Short)
              .setMinLength(17) // opcional, ajuda a filtrar valores óbvios
              .setMaxLength(20)
              .setRequired(true);

            const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
            modal.addComponents(row);

            await (interaction as ButtonInteraction).showModal(modal);
          } catch (e: any) {
            console.error('[apalto] showModal error:', e);
            await safeRespond(interaction, {
              embeds: [err('Não foi possível abrir o modal', e?.message ?? 'Tente novamente.')],
              ephemeral: true,
            });
          }
          return;
        }

        await interaction.deferUpdate().catch(() => {});
        return;
      }

      // ===== Menu de usuário =====
      if (interaction.isAnySelectMenu() && interaction.componentType === ComponentType.UserSelect) {
        await interaction.deferUpdate().catch(() => {});
        const target = parts[1] as 'leader1' | 'leader2';
        const t1 = parts[2];
        const t2 = parts[3];
        const k = keyOf(t1, t2);

        const chosen = interaction.values[0];
        const saved = store.get(k) ?? {};
        if (target === 'leader1') saved.leader1 = chosen;
        if (target === 'leader2') saved.leader2 = chosen;
        store.set(k, saved);

        await interaction.followUp({
          embeds: [ok('Seleção salva', 'Clique em **Aplicar Permissões** no painel do /apalto.')],
          ephemeral: true,
        }).catch(() => {});
        return;
      }

      // ===== Submit do modal =====
      if (interaction.isModalSubmit() && action === 'modal') {
        const target = parts[2] as 'leader1' | 'leader2';
        const t1 = parts[3];
        const t2 = parts[4];
        const k = keyOf(t1, t2);

        const raw = interaction.fields.getTextInputValue('userId').trim();
        try {
          const m = await interaction.guild!.members.fetch(raw);
          const saved = store.get(k) ?? {};
          if (target === 'leader1') saved.leader1 = m.id;
          if (target === 'leader2') saved.leader2 = m.id;
          store.set(k, saved);

          await safeRespond(interaction, { embeds: [ok('ID salvo', `Usuário: <@${m.id}>`)], ephemeral: true });
        } catch {
          await safeRespond(interaction, {
            embeds: [err('ID inválido', 'Não foi possível encontrar este usuário no servidor.')],
            ephemeral: true,
          });
        }
        return;
      }

      // fallback
      await safeRespond(interaction, { embeds: [warn('Ação inválida', 'Use os botões do painel do /apalto.')], ephemeral: true });
    } catch (e) {
      console.error('interactionCreate error:', e);
      await safeRespond(interaction, { embeds: [err('Erro', 'Falha ao tratar a interação.')], ephemeral: true });
    }
  },
};
