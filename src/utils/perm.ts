// src/utils/perm
import { PermissionsBitField, PermissionFlagsBits } from 'discord.js';
import type { GuildMember, APIInteractionGuildMember } from 'discord.js';
import { getStaffRoleIds } from '../config.js';

/**
 * Verifica se o membro tem permissão de staff.
 * Pode ser via permissão (ManageChannels / ManageGuild)
 * ou via cargo listado em STAFF_ROLE_IDS no .env.
 */
export function hasStaffPermission(
  member: GuildMember | APIInteractionGuildMember | null | undefined
): boolean {
  if (!member) return false;

  // 1️⃣ Pega o bitfield de permissões do membro
  const perms =
    (member as GuildMember).permissions ??
    new PermissionsBitField(BigInt((member as APIInteractionGuildMember).permissions ?? '0'));

  // 2️⃣ Staff por permissão administrativa direta
  if (perms.has(PermissionFlagsBits.ManageChannels) || perms.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  // 3️⃣ Staff por cargo (STAFF_ROLE_IDS definidos no .env)
  const staffRoleIds = getStaffRoleIds();
  let roles: string[] = [];

  if ((member as GuildMember).roles?.cache) {
    roles = Array.from((member as GuildMember).roles.cache.keys());
  } else if (Array.isArray((member as APIInteractionGuildMember).roles)) {
    roles = (member as APIInteractionGuildMember).roles;
  }

  return roles.some((r) => staffRoleIds.includes(r));
}
