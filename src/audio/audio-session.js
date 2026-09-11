const VALID_TYPES = new Set(['auto', 'ambient', 'playback', 'transient', 'transient-solo', 'play-and-record']);

export function setAudioSessionType(type) {
  if (!VALID_TYPES.has(type) || typeof navigator === 'undefined') return false;
  try {
    if (!navigator.audioSession) return false;
    navigator.audioSession.type = type;
    return navigator.audioSession.type === type;
  } catch {
    return false;
  }
}

export function prepareMicrophoneAudioSession() {
  return setAudioSessionType('play-and-record');
}

export function restorePlaybackAudioSession({ settleMs = 140 } = {}) {
  setAudioSessionType('playback');
  if (!settleMs) return Promise.resolve();
  return new Promise(resolve => {
    setTimeout(() => {
      setAudioSessionType('playback');
      resolve();
    }, settleMs);
  });
}
