// src/events/interactionCreate.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
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
} from "discord.js";

import { ok, err, warn } from "../utils/embeds.js";
import { grantTeamAccessForLeaders } from "../utils/voiceManager.js";
import { getStaffRoleIds } from "../config.js";

/* ======================================================================================
   🧩 SISTEMA DE SELEÇÃO DE LÍDERES /APALTO
   - Escolha via menu ou ID
   - Verificação de staff (STAFF_ROLE_IDS + permissão nativa)
   - Aplicação de permissões automáticas
====================================================================================== */

type TempStore = { leader1?: string; leader2?: string };
const store = new Map<string, TempStore>();
const keyOf = (t1: string, t2: string) => `${t1}:${t2}`;

/**
 * Envia resposta de forma segura, evitando conflitos de "already replied"
 */
async function safeRespond(
  i: Interaction,
  payload: Parameters<RepliableInteraction["reply"]>[0]
) {
  const ix = i as unknown as RepliableInteraction;
  if (ix.deferred || ix.replied) return ix.followUp(payload).catch(() => {});
  return ix.reply(payload).catch(() => {});
}

/**
 * Verifica se o membro é staff
 */
function isStaff(member: GuildMember | null): boolean {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  const staffIds = getStaffRoleIds();
  return member.roles.cache.some((r) => staffIds.includes(r.id));
}

/* ======================================================================================
   EVENTO PRINCIPAL
====================================================================================== */
export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    try {
      if (
        !interaction.isButton() &&
        !interaction.isAnySelectMenu() &&
        !interaction.isModalSubmit()
      )
        return;

      if (!interaction.customId?.startsWith?.("apalto:")) return;
      if (!interaction.inCachedGuild()) {
        await safeRespond(interaction, {
          embeds: [err("Use em um servidor válido")],
          ephemeral: true,
        });
        return;
      }

      const member = interaction.member as GuildMember | null;
      if (!isStaff(member)) {
        await safeRespond(interaction, {
          embeds: [
            err(
              "Sem permissão",
              "Você precisa ter **Gerenciar Canais** ou um cargo listado em `STAFF_ROLE_IDS`."
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const parts = interaction.customId.split(":");
      const action = parts[1];

      /* =====================================================
         BOTÕES PRINCIPAIS
      ===================================================== */
      if (interaction.isButton()) {
        // Selecionar líder TIME 1 / TIME 2
        if (action === "pickL1" || action === "pickL2") {
          const t1 = parts[2];
          const t2 = parts[3];
          await interaction.deferUpdate().catch(() => {});

          const target = action === "pickL1" ? "leader1" : "leader2";
          const label =
            action === "pickL1"
              ? "Escolha o líder do TIME 1"
              : "Escolha o líder do TIME 2";

          const pick = new UserSelectMenuBuilder()
            .setCustomId(`apalto:${target}:${t1}:${t2}`)
            .setMinValues(1)
            .setMaxValues(1)
            .setPlaceholder(label);

          const informId = new ButtonBuilder()
            .setCustomId(`apalto:enterid:${target}:${t1}:${t2}`)
            .setLabel("Informar ID")
            .setStyle(ButtonStyle.Secondary);

          const row1 = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(pick);
          const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(informId);

          await interaction.followUp({
            content: label,
            components: [row1, row2],
            ephemeral: true,
          });
          return;
        }

        // Aplicar permissões
        if (action === "finalize") {
          const t1 = parts[2];
          const t2 = parts[3];
          const k = keyOf(t1, t2);
          await interaction.deferUpdate().catch(() => {});
          const saved = store.get(k);

          if (!saved || (!saved.leader1 && !saved.leader2)) {
            await safeRespond(interaction, {
              embeds: [warn("Nada selecionado", "Escolha ao menos um líder.")],
              ephemeral: true,
            });
            return;
          }

          try {
            await grantTeamAccessForLeaders({
              client: interaction.client,
              guildId: interaction.guild!.id,
              team1Id: t1,
              team2Id: t2,
              leader1Id: saved.leader1,
              leader2Id: saved.leader2,
            });

           // Desabilita botões antigos
const msg = interaction.message;

if (msg && msg.editable) {
  const newRows = msg.components.map((r) => {
    // Forçamos o tipo genérico para evitar erro de compatibilidade de componentes
    const existing = ActionRowBuilder.from(r as any) as ActionRowBuilder<ButtonBuilder>;
    const rebuilt = new ActionRowBuilder<ButtonBuilder>();

    // Percorre os componentes e desativa botões
    for (const c of (existing.components ?? []) as any[]) {
      if (c.type === ComponentType.Button) {
        rebuilt.addComponents(ButtonBuilder.from(c as any).setDisabled(true));
      } else {
        rebuilt.addComponents(c as any);
      }
    }

    return rebuilt as any;
  });

  await msg.edit({ components: newRows as any }).catch(() => {});
}


            await safeRespond(interaction, {
              embeds: [
                ok(
                  "Permissões aplicadas ✅",
                  "Os líderes e cargos staff agora têm controle total nas calls."
                ),
              ],
              ephemeral: true,
            });
          } catch (e: any) {
            console.error("[apalto] finalize error:", e);
            await safeRespond(interaction, {
              embeds: [err("Erro ao aplicar", e?.message ?? "Falha inesperada.")],
              ephemeral: true,
            });
          }
          return;
        }

        // Modal de ID manual
        if (action === "enterid") {
          const target = parts[2] as "leader1" | "leader2";
          const t1 = parts[3];
          const t2 = parts[4];
          try {
            const modal = new ModalBuilder()
              .setCustomId(`apalto:modal:${target}:${t1}:${t2}`)
              .setTitle("Informar ID do usuário");

            const input = new TextInputBuilder()
              .setCustomId("userId")
              .setLabel("ID do usuário")
              .setPlaceholder("Exemplo: 123456789012345678")
              .setStyle(TextInputStyle.Short)
              .setMinLength(17)
              .setMaxLength(20)
              .setRequired(true);

            const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
            modal.addComponents(row);
            await (interaction as ButtonInteraction).showModal(modal);
          } catch (e: any) {
            console.error("[apalto] showModal error:", e);
            await safeRespond(interaction, {
              embeds: [err("Não foi possível abrir o modal", e?.message ?? "Erro.")],
              ephemeral: true,
            });
          }
          return;
        }
      }

      /* =====================================================
         MENU DE SELEÇÃO
      ===================================================== */
      if (
        interaction.isAnySelectMenu() &&
        interaction.componentType === ComponentType.UserSelect
      ) {
        await interaction.deferUpdate().catch(() => {});
        const target = parts[1] as "leader1" | "leader2";
        const t1 = parts[2];
        const t2 = parts[3];
        const k = keyOf(t1, t2);
        const chosen = interaction.values[0];
        const saved = store.get(k) ?? {};
        if (target === "leader1") saved.leader1 = chosen;
        if (target === "leader2") saved.leader2 = chosen;
        store.set(k, saved);

        await interaction
          .followUp({
            embeds: [ok("Seleção salva", "Clique em **Aplicar Permissões**.")],
            ephemeral: true,
          })
          .catch(() => {});
        return;
      }

      /* =====================================================
         MODAL DE ID MANUAL
      ===================================================== */
      if (interaction.isModalSubmit() && action === "modal") {
        const target = parts[2] as "leader1" | "leader2";
        const t1 = parts[3];
        const t2 = parts[4];
        const k = keyOf(t1, t2);

        const raw = interaction.fields.getTextInputValue("userId").trim();
        try {
          const m = await interaction.guild!.members.fetch(raw);
          const saved = store.get(k) ?? {};
          if (target === "leader1") saved.leader1 = m.id;
          if (target === "leader2") saved.leader2 = m.id;
          store.set(k, saved);

          await safeRespond(interaction, {
            embeds: [ok("ID salvo", `Usuário: <@${m.id}>`)],
            ephemeral: true,
          });
        } catch {
          await safeRespond(interaction, {
            embeds: [
              err("ID inválido", "Não foi possível encontrar esse usuário na guild."),
            ],
            ephemeral: true,
          });
        }
        return;
      }
    } catch (e) {
      console.error("interactionCreate error:", e);
      await safeRespond(interaction, {
        embeds: [err("Erro", "Falha ao processar a interação.")],
        ephemeral: true,
      });
    }
  },
};
