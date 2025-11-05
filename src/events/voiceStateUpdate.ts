// src/events/voiceStateUpdate.ts
import { Events, type VoiceState } from "discord.js";
import { onVoiceStateUpdate } from "../utils/voiceManager.js";

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceState, newState: VoiceState) {
    await onVoiceStateUpdate(oldState, newState);
  },
};
