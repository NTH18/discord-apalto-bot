// src/utils/perm.ts
import { PermissionsBitField, PermissionFlagsBits } from 'discord.js';
import type { GuildMember, APIInteractionGuildMember } from 'discord.js';
import { CONFIG } from '../config.ts';

export function hasStaffPermission(
  member: GuildMember | APIInteractionGuildMember | null | undefined
): boolean {
  if (!member) return false;

  // 1) Construir o bitfield de permissões
  // - GuildMember: já vem um PermissionsBitField
  // - APIInteractionGuildMember: vem como string (bits); precisamos transformar
  const perms =
    (member as GuildMember).permissions ??
    new PermissionsBitField(BigInt((member as APIInteractionGuildMember).permissions ?? '0'));

  // 2) Staff por perm: ManageChannels ou ManageGuild
  if (perms.has(PermissionFlagsBits.ManageChannels) || perms.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  // 3) Staff por cargo (STAFF_ROLE_IDS no .env)
  let roles: string[] = [];
  if ((member as GuildMember).roles?.cache) {
    roles = Array.from((member as GuildMember).roles.cache.keys());
  } else if (Array.isArray((member as APIInteractionGuildMember).roles)) {
    roles = (member as APIInteractionGuildMember).roles;
  }

  return roles.some((r) => CONFIG.staffRoleIds.includes(r));
}
