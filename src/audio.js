const effects = {
  mote_picked: [660, 880], charm_picked: [523, 659, 784], lantern_lit: [392, 523, 659, 784],
  pulse: [430, 260, 130], player_hit: [151, 83], jump: [310, 550], dash: [220, 440, 650],
  won: [392, 494, 587, 784, 988], lost: [349, 262, 196], shade_spawned: [112, 136],
  countdown: [740], wind: [190, 160, 121], drifter_steal: [294, 196],
}
const melody = [146.83, 220, 196, 164.81, 130.81, 196, 174.61, 146.83]

export class NightAudio {
  constructor(volume) {
    this.volume = volume
    this.beat = 0
    this.loop = null
  }

  async unlock() {
    const Context = window.AudioContext ?? window.webkitAudioContext
    if (!Context) return
    if (!this.context) {
      this.context = new Context()
      this.master = this.context.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') await this.context.resume()
  }

  setVolume(value) {
    this.volume = value
    if (this.master) this.master.gain.setTargetAtTime(value, this.context.currentTime, .025)
  }

  tone(hz, start, duration, volume, waveform) {
    const oscillator = this.context.createOscillator()
    const envelope = this.context.createGain()
    oscillator.type = waveform
    oscillator.frequency.value = hz
    envelope.gain.setValueAtTime(.0001, start)
    envelope.gain.exponentialRampToValueAtTime(volume, start + .026)
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration)
    oscillator.connect(envelope)
    envelope.connect(this.master)
    oscillator.start(start)
    oscillator.stop(start + duration + .01)
  }

  effect(name) {
    if (!this.context || this.context.state !== 'running' || !effects[name]) return
    const now = this.context.currentTime
    const waveform = name === 'player_hit' || name === 'shade_spawned' ? 'triangle' : 'sine'
    effects[name].forEach((note, i) => this.tone(note, now + i * .065, .23, .11, waveform))
  }

  music(playing, night) {
    if (this.loop !== null) clearInterval(this.loop)
    this.loop = null
    if (!playing) return
    const play = () => {
      if (!this.context || this.context.state !== 'running') return
      const i = this.beat++
      const note = melody[(i + night - 1) % melody.length]
      const now = this.context.currentTime
      this.tone(note, now, .78, .043, 'sine')
      if (i % 2 === 0) this.tone(note * 2, now, .52, .018, 'triangle')
    }
    play()
    this.loop = setInterval(play, 820)
  }
}
