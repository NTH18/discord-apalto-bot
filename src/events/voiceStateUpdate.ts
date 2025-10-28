import { Events, type VoiceState } from 'discord.js';
import { onVoiceStateUpdate } from '../utils/voiceManager.ts';

const mod = {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceState, newState: VoiceState) {
    onVoiceStateUpdate(oldState, newState);
  }
};
export default mod;
