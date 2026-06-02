/**
 * Synthesized High-Fidelity Audio Engine using browser Web Audio API.
 * This guarantees zero network lag, 100% offline compatibility, and zero file dependencies.
 */

let audioCtx = null;
let activeRingtone = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a beautiful, dual-tone electronic chime for incoming notifications.
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // First tone (C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Second tone (E5) after brief delay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
    
    gain2.gain.setValueAtTime(0.18, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.4);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.5);
  } catch (err) {
    console.warn('[AUDIO] Failed to play notification sound:', err);
  }
}

/**
 * Play a very quick, soft, satisfying low-to-high tick for sent messages.
 */
export function playSentSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.1);
  } catch (err) {
    console.warn('[AUDIO] Failed to play sent sound:', err);
  }
}

/**
 * Start playing an elegant looping ringtone for incoming calls.
 */
export function startIncomingCallRing() {
  if (activeRingtone) return;
  
  try {
    const ctx = getAudioContext();
    let isPlaying = true;
    
    const playRingCycle = () => {
      if (!isPlaying) return;
      const now = ctx.currentTime;
      
      // Synthesize a pleasant dual-tone telephone bell ring
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.value = 853; // Standard European calling frequency
      
      osc2.type = 'sine';
      osc2.frequency.value = 960;
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.setValueAtTime(0.15, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + 1.3);
      osc2.stop(now + 1.3);
      
      // Looping interval of 2.2 seconds
      activeRingtone.timeoutId = setTimeout(playRingCycle, 2200);
    };
    
    activeRingtone = {
      stop: () => {
        isPlaying = false;
        if (activeRingtone.timeoutId) {
          clearTimeout(activeRingtone.timeoutId);
        }
      }
    };
    
    playRingCycle();
  } catch (err) {
    console.warn('[AUDIO] Failed to start incoming ringtone:', err);
  }
}

/**
 * Start playing Dialing sound (repeating comfortable soft hums).
 */
export function startDialingSound() {
  if (activeRingtone) return;
  
  try {
    const ctx = getAudioContext();
    let isPlaying = true;
    
    const playDialCycle = () => {
      if (!isPlaying) return;
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // standard ringback A4
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
      gain.gain.setValueAtTime(0.1, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 1.6);
      
      activeRingtone.timeoutId = setTimeout(playDialCycle, 3000);
    };
    
    activeRingtone = {
      stop: () => {
        isPlaying = false;
        if (activeRingtone.timeoutId) {
          clearTimeout(activeRingtone.timeoutId);
        }
      }
    };
    
    playDialCycle();
  } catch (err) {
    console.warn('[AUDIO] Failed to play dialing sound:', err);
  }
}

/**
 * Stop any active call sound loop (ringtone or dialing).
 */
export function stopCallSound() {
  if (activeRingtone) {
    activeRingtone.stop();
    activeRingtone = null;
  }
}
