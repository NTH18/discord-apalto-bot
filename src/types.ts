// src/types.ts
import type {
  ChatInputCommandInteraction,
  Client,
  ClientEvents,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import type { Collection } from 'discord.js';

export type CommandData = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;

export type SlashCommand = {
  data: CommandData;
  execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<void>;
};

export type EventModule<K extends keyof ClientEvents = keyof ClientEvents> = {
  name: K;
  once?: boolean;
  execute: (...args: ClientEvents[K]) => void | Promise<void>;
};

export interface ClientWithCommands extends Client {
  commands: Collection<string, SlashCommand>;
}
