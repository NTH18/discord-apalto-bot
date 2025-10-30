import 'dotenv/config';

export const CONFIG = {
  defaultCategoryIds: process.env.DEFAULT_CATEGORY_IDS || '',
  emptyMinutesToDelete: parseInt(process.env.EMPTY_MINUTES || '5', 10),
};

/**
 * Retorna a categoria padrão conforme o ID da guild.
 */
export function pickDefaultCategoryIdForGuild(mapping: string, guildId: string): string | null {
  if (!mapping) return null;
  const pairs = mapping.split(',').map(s => s.trim());
  for (const pair of pairs) {
    const [gid, catId] = pair.split('=');
    if (gid === guildId && /^\d{5,}$/.test(catId)) return catId;
  }
  return null;
}

/**
 * Retorna todos os cargos de staff definidos no .env
 * Exemplo: STAFF_ROLE_IDS=123,456,789
 */
export function getStaffRoleIds(): string[] {
  const raw = process.env.STAFF_ROLE_IDS?.trim() ?? '';
  return raw.length > 0
    ? raw
        .split(',')
        .map(id => id.trim())
        .filter(id => /^\d{5,}$/.test(id))
    : [];
}
