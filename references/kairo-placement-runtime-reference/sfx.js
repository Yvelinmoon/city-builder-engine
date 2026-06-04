function initBrickCitySfx() {
  let ctx = null;
  let muted = true;
  let bgmTimer = null;
  const tones = {
    tap: [520, 0.035, 'square', 0.025],
    build: [740, 0.08, 'triangle', 0.035],
    coin: [920, 0.09, 'sine', 0.04],
    invalid: [180, 0.12, 'sawtooth', 0.035],
    upgrade: [620, 0.08, 'triangle', 0.04],
    event: [420, 0.18, 'sine', 0.035]
  };
  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function beep(freq, dur, type, vol, delay = 0) {
    if (muted) return;
    ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + dur + 0.02);
  }
  function play(name) {
    const t = tones[name] || tones.tap;
    beep(t[0], t[1], t[2], t[3]);
    if (name === 'coin') beep(t[0] * 1.25, t[1], t[2], t[3] * 0.8, 0.06);
    if (name === 'upgrade') beep(t[0] * 1.5, t[1], t[2], t[3] * 0.8, 0.08);
  }
  function updateButton() {
    const btn = document.getElementById('soundToggleBtn');
    if (!btn) return;
    btn.classList.toggle('active', !muted);
    btn.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  }
  function playBgm() {
    if (bgmTimer) return;
    let step = 0;
    const seq = [262, 330, 392, 523, 392, 330];
    bgmTimer = setInterval(() => {
      if (!muted) beep(seq[step++ % seq.length], 0.08, 'sine', 0.012);
    }, 520);
  }
  function stopBgm() { clearInterval(bgmTimer); bgmTimer = null; }
  function toggleBgm() { ensure(); muted = !muted; if (!muted) playBgm(); else stopBgm(); updateButton(); }
  function unlock() { ensure(); }
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
  document.addEventListener('DOMContentLoaded', updateButton);
  window.RoomCareSfx = { play, playRandom(names){ if (names?.length) play(names[Math.floor(Math.random()*names.length)]); }, playBgm, stopBgm, toggleBgm, unlock };
}

initBrickCitySfx();
