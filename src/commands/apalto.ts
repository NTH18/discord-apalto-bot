import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  OverwriteResolvable,
} from 'discord.js';

import { ok, err } from '../utils/embeds.ts';
import { createApAltoPair } from '../utils/voiceManager.ts';
import { CONFIG, pickDefaultCategoryIdForGuild, getStaffRoleIds } from '../config.ts';

/**
 * Lê o ID da categoria de transmissão do .env
 */
function envTransmissaoId(): string | null {
  const id = process.env.TRANSMISSAO_CATEGORY_ID?.trim();
  return id && /^\d{5,}$/.test(id) ? id : null;
}

/**
 * Resolve qual categoria usar para criar as calls
 */
async function resolveCategory(interaction: ChatInputCommandInteraction): Promise<CategoryChannel | null> {
  const gid = interaction.guildId!;
  const envId = envTransmissaoId();

  // 1️⃣ Tenta usar TRANSMISSAO_CATEGORY_ID
  if (envId) {
    const c = await interaction.guild!.channels.fetch(envId).catch(() => null);
    if (c?.type === ChannelType.GuildCategory && (c as CategoryChannel).guildId === gid)
      return c as CategoryChannel;
  }

  // 2️⃣ Tenta pegar da configuração DEFAULT_CATEGORY_IDS
  const forcedId = pickDefaultCategoryIdForGuild(CONFIG.defaultCategoryIds, gid);
  if (forcedId) {
    const c = await interaction.guild!.channels.fetch(forcedId).catch(() => null);
    if (c?.type === ChannelType.GuildCategory && (c as CategoryChannel).guildId === gid)
      return c as CategoryChannel;
  }

  // 3️⃣ Tenta pegar da opção do comando
  const opt = interaction.options.getChannel('categoria');
  if (opt?.type === ChannelType.GuildCategory && (opt as CategoryChannel).guildId === gid)
    return opt as CategoryChannel;

  return null;
}

/**
 * Slash Command Builder
 */
const data = new SlashCommandBuilder()
  .setName('apalto')
  .setDescription('Cria duas calls privadas para ap-alto (TIME 1 e TIME 2).')
  .addChannelOption(opt =>
    opt
      .setName('categoria')
      .setDescription('Categoria onde as calls serão criadas (opcional)')
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

/**
 * Execução principal do comando
 */
async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    if (!interaction.inCachedGuild()) {
      await interaction.editReply({ embeds: [err('Use em um servidor')] }).catch(() => {});
      return;
    }

    const category = await resolveCategory(interaction);
    if (!category) {
      await interaction.editReply({
        embeds: [
          err(
            'Categoria inválida',
            'Defina TRANSMISSAO_CATEGORY_ID no .env **ou** mapeie em DEFAULT_CATEGORY_IDS (GUILD_ID=CATEGORY_ID).',
          ),
        ],
      }).catch(() => {});
      return;
    }

    const staffRoleIds = getStaffRoleIds();
    const guestRoleId = process.env.CALL_GUEST_ROLE_ID?.trim() ?? null;

    const overwrites: OverwriteResolvable[] = [
      {
        id: interaction.guild!.roles.everyone.id,
        deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.ManageChannels,
        ],
      },
      ...staffRoleIds.map((id: string) => ({
        id,
        allow: [
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MoveMembers,
          PermissionFlagsBits.MuteMembers,
          PermissionFlagsBits.DeafenMembers,
        ],
      })),
      ...(guestRoleId
        ? [
            {
              id: guestRoleId,
              allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
            },
          ]
        : []),
    ];

    const { team1, team2 } = await createApAltoPair({
      client: interaction.client,
      guildId: interaction.guildId!,
      categoryId: category.id,
      creatorId: interaction.user.id,
      permissionOverwrites: overwrites, // Passando as permissões para a criação dos canais
    });

    const leader1Btn = new ButtonBuilder()
      .setCustomId(`apalto:pickL1:${team1.id}:${team2.id}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Escolher líder TIME 1');

    const leader2Btn = new ButtonBuilder()
      .setCustomId(`apalto:pickL2:${team1.id}:${team2.id}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Escolher líder TIME 2');

    const applyBtn = new ButtonBuilder()
      .setCustomId(`apalto:finalize:${team1.id}:${team2.id}`)
      .setStyle(ButtonStyle.Success)
      .setLabel('Aplicar Permissões');

    await interaction.editReply({
      embeds: [
        ok(
          'Calls criadas ✅',
          `Defina os **líderes** (um pra cada time):\n• ${team1}\n• ${team2}\n\n` +
            `Líderes e cargos staff têm **gerenciamento total** (incluindo mover, mutar e ensurdecer membros).\n` +
            (guestRoleId
              ? `O cargo <@&${guestRoleId}> pode **apenas entrar** nas calls.\n`
              : '') +
            `As calls são apagadas se ficarem vazias por ${CONFIG.emptyMinutesToDelete} min.`,
        ),
      ],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(leader1Btn, leader2Btn, applyBtn)],
    });
  } catch (e) {
    console.error('❌ Erro ao executar /apalto:', e);
    await interaction
      .editReply({
        embeds: [err('Erro interno', 'Verifique o log do servidor para mais detalhes.')],
      })
      .catch(() => {});
  }
}

export const apalto = { data, execute };
export default apalto;
