// src/commands/apalto.ts
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
  ThreadChannel,
  TextChannel,
  ForumChannel,
  NewsChannel,
} from 'discord.js';
import { ok, err } from '../utils/embeds.ts';
import { createApAltoPair } from '../utils/voiceManager.ts';
import { CONFIG, pickDefaultCategoryIdForGuild } from '../config.ts';

function envTransmissaoId(): string | null {
  // prioridade máxima: variável única de categoria fixa
  const id = process.env.TRANSMISSAO_CATEGORY_ID?.trim();
  return id && /^\d{5,}$/.test(id) ? id : null;
}

async function resolveCategory(interaction: ChatInputCommandInteraction): Promise<CategoryChannel | null> {
  const gid = interaction.guildId!;

  // 1) TRANSMISSAO_CATEGORY_ID (env) – FORTEMENTE PREFERIDA
  const envId = envTransmissaoId();
  if (envId) {
    const c = await interaction.guild!.channels.fetch(envId).catch(() => null);
    if (c?.type === ChannelType.GuildCategory && (c as CategoryChannel).guildId === gid) {
      return c as CategoryChannel;
    }
  }

  // 2) DEFAULT_CATEGORY_IDS (CONFIG) – mapping por guild (ex: "GID=CATID,...")
  const forcedId = pickDefaultCategoryIdForGuild(CONFIG.defaultCategoryIds, gid);
  if (forcedId) {
    const c = await interaction.guild!.channels.fetch(forcedId).catch(() => null);
    if (c?.type === ChannelType.GuildCategory && (c as CategoryChannel).guildId === gid) {
      return c as CategoryChannel;
    }
  }

  // 3) parâmetro /apalto categoria
  const opt = interaction.options.getChannel('categoria');
  if (opt?.type === ChannelType.GuildCategory && (opt as CategoryChannel).guildId === gid) {
    return opt as CategoryChannel;
  }

  // 4) se estiver em tópico, sobe para a categoria
  if (interaction.channel?.isThread()) {
    const thread = interaction.channel as ThreadChannel;
    const parent = thread.parent as (TextChannel | ForumChannel | NewsChannel | null);
    const catId = parent?.parentId ?? null;
    if (catId) {
      const fetched = await interaction.guild!.channels.fetch(catId).catch(() => null);
      if (fetched?.type === ChannelType.GuildCategory) return fetched as CategoryChannel;
    }
  }

  // 5) pai do canal atual (se já estiver numa categoria)
  const parent = (interaction.channel as TextChannel | ForumChannel | NewsChannel | null)?.parent;
  if (parent?.type === ChannelType.GuildCategory) return parent as CategoryChannel;

  return null;
}

const data = new SlashCommandBuilder()
  .setName('apalto')
  .setDescription('Cria duas calls privadas para ap-alto (TIME 1 e TIME 2).')
  .addChannelOption(opt =>
    opt
      .setName('categoria')
      .setDescription('Categoria onde as calls serão criadas')
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  if (!interaction.inCachedGuild()) {
    await interaction.editReply({ embeds: [err('Use em um servidor')] }).catch(() => {});
    return;
  }

  const category = await resolveCategory(interaction);
  if (!category) {
    await interaction.editReply({
      embeds: [err(
        'Categoria inválida',
        'Defina TRANSMISSAO_CATEGORY_ID no .env **ou** mapeie em DEFAULT_CATEGORY_IDS (GUILD_ID=CATEGORY_ID).'
      )],
    }).catch(() => {});
    return;
  }

  const { team1, team2 } = await createApAltoPair({
    client: interaction.client,
    guildId: interaction.guildId!,
    categoryId: category.id,   // <- garante que nasce DENTRO da categoria
    creatorId: interaction.user.id,
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
    embeds: [ok(
      'Calls criadas',
      `Defina os **líderes** (um pra cada time).\n• ${team1}\n• ${team2}\n\n` +
      `As calls serão **visíveis** para todos, mas só líderes conectam.\n` +
      `Líderes poderão **arrastar / mutar / ensurdecer** na própria call.\n` +
      `As calls são apagadas se as duas ficarem vazias por ${CONFIG.emptyMinutesToDelete} min.`
    )],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(leader1Btn, leader2Btn, applyBtn)],
  }).catch(() => {});
}

export const apalto = { data, execute };
export default apalto;
