// src/utils/voiceManager.ts
import {
  Client,
  GuildBasedChannel,
  VoiceChannel,
  ChannelType,
  PermissionFlagsBits,
  OverwriteResolvable,
  VoiceState,
} from "discord.js";
import { CONFIG } from "../config.ts";

type PairInfo = {
  guildId: string;
  team1Id: string;
  team2Id: string;
  categoryId: string;
  creatorId: string;
  deleteTimer?: NodeJS.Timeout | null;
  emptySince?: number | null;
};

const pairs = new Map<string, PairInfo>();
const pairsByChannel = new Map<string, PairInfo>();

function asVoice(ch: GuildBasedChannel | null): VoiceChannel {
  if (!ch || ch.type !== ChannelType.GuildVoice)
    throw new Error("Canal não é de voz");
  return ch as VoiceChannel;
}

/**
 * Cria as duas calls (TIME 1 e TIME 2) com permissões customizadas
 */
export async function createApAltoPair({
  client,
  guildId,
  categoryId,
  creatorId,
  permissionOverwrites,
}: {
  client: Client;
  guildId: string;
  categoryId: string;
  creatorId: string;
  permissionOverwrites?: OverwriteResolvable[];
}) {
  const guild = await client.guilds.fetch(guildId);
  const category = await guild.channels.fetch(categoryId);
  if (!category || category.type !== ChannelType.GuildCategory)
    throw new Error("Categoria inválida");

  const team1 = await guild.channels.create({
    name: "🔥 TIME 1",
    type: ChannelType.GuildVoice,
    parent: category.id,
    permissionOverwrites,
    reason: "apalto: criação TIME 1",
  });

  const team2 = await guild.channels.create({
    name: "⚡ TIME 2",
    type: ChannelType.GuildVoice,
    parent: category.id,
    permissionOverwrites,
    reason: "apalto: criação TIME 2",
  });

  const info: PairInfo = {
    guildId,
    team1Id: team1.id,
    team2Id: team2.id,
    categoryId,
    creatorId,
    deleteTimer: null,
    emptySince: null,
  };

  pairs.set(`${team1.id}:${team2.id}`, info);
  pairsByChannel.set(team1.id, info);
  pairsByChannel.set(team2.id, info);

  refreshDeletionTimer(client, info).catch(() => {});
  return { team1, team2 };
}

/**
 * Dá acesso aos líderes dos times (voz, mover, mutar, etc.)
 */
export async function grantTeamAccessForLeaders(opts: {
  client: Client;
  guildId: string;
  team1Id: string;
  team2Id: string;
  leader1Id?: string | null;
  leader2Id?: string | null;
}) {
  const { client, guildId, team1Id, team2Id, leader1Id, leader2Id } = opts;

  const guild = await client.guilds.fetch(guildId);
  const everyoneId = guild.roles.everyone.id;

  const [ch1Raw, ch2Raw] = await Promise.all([
    guild.channels.fetch(team1Id),
    guild.channels.fetch(team2Id),
  ]);

  const ch1 = asVoice(ch1Raw as any);
  const ch2 = asVoice(ch2Raw as any);

  const baseEveryone: OverwriteResolvable = {
    id: everyoneId,
    allow: [PermissionFlagsBits.ViewChannel],
    deny: [PermissionFlagsBits.Connect],
  };

  const leaderAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.MoveMembers,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.DeafenMembers,
  ];

  const overwrites1: OverwriteResolvable[] = [
    baseEveryone,
    ...(leader1Id ? [{ id: leader1Id, allow: leaderAllow } as OverwriteResolvable] : []),
  ];

  const overwrites2: OverwriteResolvable[] = [
    baseEveryone,
    ...(leader2Id ? [{ id: leader2Id, allow: leaderAllow } as OverwriteResolvable] : []),
  ];

  await Promise.all([
    ch1.permissionOverwrites.set(overwrites1),
    ch2.permissionOverwrites.set(overwrites2),
  ]);
}

/**
 * Tempo máximo vazio antes de deletar calls
 */
const EMPTY_MS = Math.max(1, CONFIG.emptyMinutesToDelete) * 60 * 1000;

/**
 * Atualiza o timer de deleção automática se ambas as calls estiverem vazias
 */
async function refreshDeletionTimer(client: Client, info: PairInfo) {
  if (info.deleteTimer) clearTimeout(info.deleteTimer);

  const guild = await client.guilds.fetch(info.guildId);
  const [c1, c2] = await Promise.all([
    guild.channels.fetch(info.team1Id),
    guild.channels.fetch(info.team2Id),
  ]);

  const v1 = asVoice(c1 as any);
  const v2 = asVoice(c2 as any);

  const bothEmpty = v1.members.size === 0 && v2.members.size === 0;

  if (bothEmpty) {
    if (!info.emptySince) info.emptySince = Date.now();
    const msLeft = Math.max(0, info.emptySince + EMPTY_MS - Date.now());

    info.deleteTimer = setTimeout(async () => {
      try {
        await v1.fetch(true);
        await v2.fetch(true);
        if (v1.members.size === 0 && v2.members.size === 0) {
          await Promise.allSettled([v1.delete("apalto: vazio"), v2.delete("apalto: vazio")]);
        }
      } catch {}
      const key = `${info.team1Id}:${info.team2Id}`;
      pairs.delete(key);
      pairsByChannel.delete(info.team1Id);
      pairsByChannel.delete(info.team2Id);
    }, msLeft);
  } else {
    info.emptySince = null;
  }
}

/**
 * Handler de evento: quando alguém entra ou sai de uma call
 */
export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  const affected = new Set<string>();
  if (oldState.channelId) affected.add(oldState.channelId);
  if (newState.channelId) affected.add(newState.channelId);

  for (const chId of affected) {
    const pair = pairsByChannel.get(chId);
    if (!pair) continue;
    await refreshDeletionTimer(newState.client, pair);
  }
}
