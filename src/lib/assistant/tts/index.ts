/**
 * AVS ERP self-hosted TTS barrel (Qwen3-TTS primary).
 */

export {
  TTS_VARIANT_EVALS,
  PRIMARY_TTS_VARIANT_ID,
  getPrimaryTtsVariant,
  getDownloadableTtsVariants,
  type TtsVariantId,
  type TtsVariantEval,
} from "./catalog";
export {
  applyJewelleryPronunciation,
  JEWELLERY_PRONUNCIATION_RULES,
  TTS_PRONUNCIATION_PHRASE_PACK,
} from "./pronunciation-lexicon";
export { StreamingAudioPlayer, type PcmChunk, type StreamPlayerState } from "./streaming-player";
export {
  registerTtsRuntime,
  listTtsRuntimes,
  getReadyTtsRuntime,
  getTtsRuntimeById,
  type OrnexaTtsRuntime,
  type TtsSynthesizeRequest,
  type TtsEmotion,
} from "./runtime";
export { ensureQwen3TtsRuntimeRegistered, createQwen3TtsRuntimeForTests } from "./qwen3-tts-runtime";
export {
  getCentralVoice,
  getActiveCentralVoice,
  enrollCentralVoice,
  activateCentralVoice,
  revokeCentralVoice,
  type OrnexaCentralVoice,
} from "./central-voice-store";
export {
  listVoiceProfiles,
  getActiveVoiceProfile,
  enrollVoiceProfile,
  activateVoiceProfile,
  revokeVoiceProfile,
  updateVoicePlaybackPrefs,
  markVoiceTest,
  type OrnexaVoiceProfile,
} from "./voice-profile-store";
export { storePrivateVoiceRef, isPublicHttpUrl } from "./voice-ref-audio";
export {
  TTS_PACK_CATALOG,
  downloadTtsPack,
  loadInstalledTtsEngine,
  listInstalledTtsPacks,
  describeTtsPack,
  type TtsPackEntry,
} from "./pack";
export {
  runOnDeviceTtsBenchmark,
  loadTtsBenchmarkReport,
  formatTtsStatusLine,
  type TtsBenchmarkReport,
} from "./benchmark";
export { speakWithOrnexaVoice, getOrnexaVoiceStatus, preferOrnexaVoice } from "./speak";
