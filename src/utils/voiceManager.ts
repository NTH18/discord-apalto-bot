// src/utils/voiceManager.ts
import {
  ChannelType,
  Client,
  OverwriteResolvable,
  PermissionFlagsBits,
  VoiceChannel,
  type GuildBasedChannel,
  type VoiceState,
} from "discord.js";
import { CONFIG } from "../config.js";

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
const PAIR_PREFIX = "apalto";

function pairKey(a: string, b: string) {
  return `${PAIR_PREFIX}:${[a, b].sort().join(":")}`;
}

function asVoice(ch: GuildBasedChannel | null): VoiceChannel {
  if (!ch || ch.type !== ChannelType.GuildVoice)
    throw new Error("Canal não é de voz");
  return ch as VoiceChannel;
}

function randomTwoEmojis(): [string, string] {
  const pool = ["🔥", "🧯", "⚡", "🍀", "🎯", "🛡️", "🥇", "🥈"];
  const a = Math.floor(Math.random() * pool.length);
  let b = Math.floor(Math.random() * pool.length);
  while (b === a) b = Math.floor(Math.random() * pool.length);
  return [pool[a], pool[b]];
}

function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{17,20}$/.test(s));
}

/* ============================================================
   🔧 CRIA AS CALLS TIME 1 / TIME 2
============================================================ */
export async function createApAltoPair(opts: {
  client: Client;
  guildId: string;
  categoryId: string;
  creatorId: string;
}) {
  const { client, guildId, categoryId, creatorId } = opts;

  console.log("🔧 [apalto] createApAltoPair >", { guildId, categoryId, creatorId });

  const guild = await client.guilds.fetch(guildId);

  // ✅ segurança extra: garante que o canal pertence à guild
  const category = await guild.channels.fetch(categoryId).catch(() => null);

  if (!category || category.guild.id !== guild.id) {
    throw new Error(
      `❌ Categoria inválida ou de outra guild (recebido ${categoryId}, guild atual ${guild.id})`
    );
  }

  if (category.type !== ChannelType.GuildCategory) {
    throw new Error("❌ Categoria inválida: verifique DEFAULT_CATEGORY_IDS");
  }

  // 📜 IDs de staff e convidados
  const staffRoles = parseIdList(process.env.STAFF_ROLE_IDS);
  const guestRoles = parseIdList(process.env.CALL_GUEST_ROLE_ID);

  // 🔍 Busca cargos válidos
  const roles = await guild.roles.fetch();
  const validRoleIds = new Set(roles.map((r) => r.id));
  const everyoneId = guild.roles.everyone.id;

  // 👑 Permissões do Staff
  const staffAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.Stream,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.DeafenMembers,
    PermissionFlagsBits.MoveMembers,
  ];

  // 🙋 Permissões dos Guests
  const guestAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
  ];

  // 👤 Permissões do criador
  const creatorAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
  ];

  // 🌍 Permissões base para @everyone + staff + guests + criador
  const permissionOverwrites: OverwriteResolvable[] = [
    {
      id: everyoneId,
      allow: [PermissionFlagsBits.ViewChannel],
      deny: [PermissionFlagsBits.Connect],
    },

    // 🙋 Guests
    ...guestRoles
      .filter((id) => validRoleIds.has(id))
      .map((id) => ({
        id,
        allow: guestAllow,
      })),

    // 👑 Staffs
    ...staffRoles
      .filter((id) => validRoleIds.has(id))
      .map((id) => ({
        id,
        allow: staffAllow,
      })),

    // 👤 Criador
    {
      id: creatorId,
      allow: creatorAllow,
    },
  ];

  console.log("📋 [apalto] Overwrites finais (verificados):");
  for (const ow of permissionOverwrites) {
    console.log("-", String(ow.id), validRoleIds.has(String(ow.id)) ? "✅ válido" : "❌ inválido");
  }

  const [e1, e2] = randomTwoEmojis();
  let team1: VoiceChannel;
  let team2: VoiceChannel;

  try {
    team1 = (await guild.channels.create({
      name: `${e1} ・ TIME 1`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites,
      reason: "apalto: criação TIME 1",
    })) as VoiceChannel;

    team2 = (await guild.channels.create({
      name: `${e2} ・ TIME 2`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites,
      reason: "apalto: criação TIME 2",
    })) as VoiceChannel;
  } catch (err: any) {
    console.error("❌ [apalto] ERRO ao criar canais:", {
      code: err?.code,
      name: err?.name,
      message: err?.message,
      raw: err?.rawError ?? err,
    });

    throw new Error(
      "❌ Falha ao criar os canais. Verifique se os IDs no .env são válidos, se os cargos existem e se o bot tem **Gerenciar Canais** na categoria."
    );
  }

  const info: PairInfo = {
    guildId,
    team1Id: team1.id,
    team2Id: team2.id,
    categoryId,
    creatorId,
    deleteTimer: null,
    emptySince: null,
  };

  const key = pairKey(team1.id, team2.id);
  pairs.set(key, info);
  pairsByChannel.set(team1.id, info);
  pairsByChannel.set(team2.id, info);

  refreshDeletionTimer(client, info).catch(() => {});
  return { team1, team2 };
}

/* ============================================================
   🔧 DÁ ACESSO AOS LÍDERES SEM REMOVER OS CARGOS EXISTENTES
============================================================ */
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

  // ✅ busca segura — evita erro se o canal pertencer a outra guild
  const ch1Raw = await guild.channels.fetch(team1Id).catch(() => null);
  const ch2Raw = await guild.channels.fetch(team2Id).catch(() => null);

  if (!ch1Raw || !ch2Raw) {
    console.warn(`[apalto] grantTeamAccessForLeaders: canais não encontrados ou pertencem a outra guild (${guildId})`);
    return;
  }

  const ch1 = asVoice(ch1Raw as any);
  const ch2 = asVoice(ch2Raw as any);

  const leaderAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.Stream,
    PermissionFlagsBits.MoveMembers,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.DeafenMembers,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
  ];

  const current1 = Array.from(ch1.permissionOverwrites.cache.values()).map((ow) => ({
    id: ow.id,
    allow: ow.allow.bitfield,
    deny: ow.deny.bitfield,
  }));

  const current2 = Array.from(ch2.permissionOverwrites.cache.values()).map((ow) => ({
    id: ow.id,
    allow: ow.allow.bitfield,
    deny: ow.deny.bitfield,
  }));

  if (leader1Id) {
    const existing = current1.find((o) => o.id === leader1Id);
    const allowBitsBigInt = leaderAllow.map((perm) => BigInt(perm)).reduce((a, b) => a | b, 0n);
    if (existing) existing.allow |= allowBitsBigInt;
    else current1.push({ id: leader1Id, allow: allowBitsBigInt, deny: 0n });
  }

  if (leader2Id) {
    const existing = current2.find((o) => o.id === leader2Id);
    const allowBitsBigInt = leaderAllow.map((perm) => BigInt(perm)).reduce((a, b) => a | b, 0n);
    if (existing) existing.allow |= allowBitsBigInt;
    else current2.push({ id: leader2Id, allow: allowBitsBigInt, deny: 0n });
  }

  await Promise.allSettled([
    ch1.permissionOverwrites.set(current1 as any).catch(() => {}),
    ch2.permissionOverwrites.set(current2 as any).catch(() => {}),
  ]);

  console.log(`✅ [apalto] Líderes aplicados com sucesso em ${guild.name}`);
}

/* ============================================================
   🧹 AUTO DELETE APÓS AMBAS VAZIAS
============================================================ */
const EMPTY_MS = Math.max(1, CONFIG.emptyMinutesToDelete) * 60 * 1000;

async function refreshDeletionTimer(client: Client, info: PairInfo) {
  if (info.deleteTimer) clearTimeout(info.deleteTimer);

  const guild = await client.guilds.fetch(info.guildId);

  if (!client.guilds.cache.has(info.guildId)) {
    console.warn(`[apalto] Ignorando PairInfo inválido (guild ${info.guildId} não encontrada no cache)`);
    return;
  }

  const c1 = await guild.channels.fetch(info.team1Id).catch(() => null);
  const c2 = await guild.channels.fetch(info.team2Id).catch(() => null);

  if (!c1 || !c2) {
    console.warn(`[apalto] Ignorando par órfão: canais não pertencem à guild ${guild.id}`);
    pairs.delete(pairKey(info.team1Id, info.team2Id));
    pairsByChannel.delete(info.team1Id);
    pairsByChannel.delete(info.team2Id);
    return;
  }

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
          await Promise.allSettled([
            v1.delete("apalto: vazio"),
            v2.delete("apalto: vazio"),
          ]);
        }
      } catch {
        // ignora erros de exclusão
      }
      const key = pairKey(info.team1Id, info.team2Id);
      pairs.delete(key);
      pairsByChannel.delete(info.team1Id);
      pairsByChannel.delete(info.team2Id);
    }, msLeft);
  } else {
    info.emptySince = null;
  }
}

/* ============================================================
   🛰️ ATUALIZAÇÃO DE ESTADO DE VOZ
============================================================ */
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
