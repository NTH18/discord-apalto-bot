// src/commands/apalto.ts
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { ok, err } from "../utils/embeds.js";
import { createApAltoPair } from "../utils/voiceManager.js";
import { CONFIG, pickDefaultCategoryIdForGuild, getStaffRoleIds } from "../config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("apalto")
    .setDescription("Cria duas calls privadas para ap-alto (TIME 1 e TIME 2).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guild = interaction.guild!;
      const member = interaction.member as any;
      const staffIds = getStaffRoleIds();

      // 🔒 Verifica se o usuário é staff
      const isStaff =
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
        (member &&
          "roles" in member &&
          Array.from(member.roles?.cache?.values?.() ?? []).some((r: any) =>
            staffIds.includes(r.id)
          ));

      if (!isStaff) {
        await interaction.reply({
          embeds: [err("Sem permissão", "Apenas **staff** pode usar este comando.")],
          ephemeral: true,
        });
        return;
      }

      // 📂 Obtém categoria da guild
      const categoryId = pickDefaultCategoryIdForGuild(guild.id);
      if (!categoryId) {
        await interaction.reply({
          embeds: [
            err(
              "Nenhuma categoria configurada",
              "Adicione no `.env`: `DEFAULT_CATEGORY_IDS=GUILD_ID:CATEGORY_ID,OUTRA_GUILD:OUTRA_CATEGORY_ID`"
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: false });

      // 🚀 Cria as calls
      const { team1, team2 } = await createApAltoPair({
        client: interaction.client,
        guildId: guild.id,
        categoryId,
        creatorId: interaction.user.id,
      });

      // ✅ Mensagem de sucesso
      const embed = new EmbedBuilder()
        .setColor(0x00ff73)
        .setTitle("✅ Calls criadas")
        .setDescription(
          `Defina os **líderes** (um pra cada time).\n\n` +
            `🔥 <#${team1.id}> TIME 1\n⚡ <#${team2.id}> TIME 2\n\n` +
            `As calls serão **visíveis** para todos, mas só líderes/guests conectam.\n` +
            `Líderes poderão **arrastar / mutar / ensurdecer** na própria call (após aplicar).\n` +
            `As calls são apagadas se ficarem vazias por **${CONFIG.emptyMinutesToDelete} min**.`
        )
        .setFooter({ text: "Painel de permissões do /apalto" });

      // 🔘 Botões
      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`apalto:pickL1:${team1.id}:${team2.id}`)
          .setLabel("🔥 Escolher líder TIME 1")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`apalto:pickL2:${team1.id}:${team2.id}`)
          .setLabel("⚡ Escolher líder TIME 2")
          .setStyle(ButtonStyle.Primary)
      );

      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`apalto:finalize:${team1.id}:${team2.id}`)
          .setLabel("Aplicar Permissões")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.editReply({ embeds: [embed], components: [row1, row2] });
    } catch (e: any) {
      console.error("[/apalto] erro:", e);
      await interaction.editReply({
        embeds: [
          err(
            "Erro",
            e?.message ??
              "Não foi possível criar as calls. Verifique permissões e IDs no .env."
          ),
        ],
      });
    }
  },
};
