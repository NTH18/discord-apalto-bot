// src/config.ts
import dotenv from "dotenv";
dotenv.config();

/* ======================================================================================
   🔧 CONFIGURAÇÕES DO BOT
   - Suporte a múltiplas guilds com categorias diferentes
   - Lê STAFF_ROLE_IDS, CALL_GUEST_ROLE_ID e DEFAULT_CATEGORY_IDS mapeadas
====================================================================================== */

/**
 * Espera formato no .env:
 * DEFAULT_CATEGORY_IDS=GUILD1:CATEGORY1,GUILD2:CATEGORY2
 * Exemplo:
 * DEFAULT_CATEGORY_IDS=1213981583779037234:1339399241478570064,1343055413465055304:1367887424545357966
 */

type CategoryMap = Record<string, string>;

function parseCategoryMap(raw?: string): CategoryMap {
  const map: CategoryMap = {};
  if (!raw) return map;

  for (const pair of raw.split(",")) {
    const [guildId, catId] = pair.split(":").map((s) => s.trim());
    if (
      guildId &&
      catId &&
      /^\d{17,20}$/.test(guildId) &&
      /^\d{17,20}$/.test(catId)
    ) {
      map[guildId] = catId;
    }
  }
  return map;
}

function parseIds(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
}

export const CONFIG = {
  token: process.env.DISCORD_TOKEN ?? "",
  clientId: process.env.CLIENT_ID ?? "",
  guildIds: parseIds(process.env.GUILD_IDS),
  emptyMinutesToDelete: Number(process.env.EMPTY_MINUTES_TO_DELETE ?? 5),
  categoryMap: parseCategoryMap(process.env.DEFAULT_CATEGORY_IDS),
  callGuestRoleId: parseIds(process.env.CALL_GUEST_ROLE_ID),
};

/* ======================================================================================
   🧭 Funções utilitárias
====================================================================================== */

/**
 * Retorna a categoria específica da guild ou null se não houver
 */
export function pickDefaultCategoryIdForGuild(guildId: string): string | null {
  return CONFIG.categoryMap[guildId] ?? null;
}

/**
 * Retorna os cargos de staff configurados no .env
 */
export function getStaffRoleIds(): string[] {
  return parseIds(process.env.STAFF_ROLE_IDS);
}
