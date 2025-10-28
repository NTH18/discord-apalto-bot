// Carrega .env e expõe a configuração tipada

import 'dotenv/config';

function splitIds(v?: string): string[] {
  return (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

export const CONFIG = {
  token: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.CLIENT_ID ?? '',
  guildIds: splitIds(process.env.GUILD_IDS),
  // categoria principal desejada (ex.: 1339399241478570064)
  transmissaoCategoryId: process.env.TRANSMISSAO_CATEGORY_ID ?? '',
  // fallback (lista) caso a principal não exista
  defaultCategoryIds: splitIds(process.env.DEFAULT_CATEGORY_IDS),
  staffRoleIds: splitIds(process.env.STAFF_ROLE_IDS),
  emptyMinutesToDelete: Math.max(1, Number(process.env.EMPTY_MINUTES ?? '4')),
};

export function pickDefaultCategoryIdForGuild(all: string[], guildId: string | null): string | null {
  if (!guildId) return all[0] ?? null;
  // heurística simples: primeira que existe na lista
  return all[0] ?? null;
}
