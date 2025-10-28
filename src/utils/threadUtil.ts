import type { AnyThreadChannel, Snowflake } from 'discord.js';

/** Retorna o conjunto de participantes do tópico:
 *  - quem “entrou” no tópico (thread.members)
 *  - autores das últimas mensagens (até 100)
 */
export async function getThreadParticipants(thread: AnyThreadChannel): Promise<Set<Snowflake>> {
  const ids: string[] = [];

  try {
    const members = await thread.members.fetch();
    ids.push(...members.map(m => m.id));
  } catch {
    // pode falhar em tópicos privados sem o bot presente
  }

  try {
    const msgs = await thread.messages.fetch({ limit: 100 });
    for (const m of msgs.values()) {
      if (m.author?.id) ids.push(m.author.id);
    }
  } catch {
    // se não tiver permissão de ler histórico, ignore
  }

  return new Set(ids);
}
