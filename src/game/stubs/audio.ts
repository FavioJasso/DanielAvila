/** STUB audio: silent, logs when `?audiolog` is in the URL. Replaced by src/game/audio. */
import type { AudioEngine, CreateAudio } from "../contract";

export const createAudio: CreateAudio = () => {
  let muted = false;
  let unlocked = false;
  const log =
    typeof window !== "undefined" && window.location.search.includes("audiolog")
      ? (...a: unknown[]) => console.log("[audio]", ...a)
      : () => {};
  const engine: AudioEngine = {
    unlock() {
      unlocked = true;
      log("unlock");
    },
    get unlocked() {
      return unlocked;
    },
    play(name) {
      log("sfx", name);
    },
    setMusic(track) {
      log("music", track);
    },
    setMuted(m) {
      muted = m;
      log("muted", m);
    },
    get muted() {
      return muted;
    },
    suspend() {},
    resume() {},
    dispose() {},
  };
  return engine;
};
