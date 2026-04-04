/**
 * SCOUNDREL — Audio System
 * Procedural sound effects + ambient background music via Web Audio API.
 * No external files required.
 *
 * SFX.play(name) | SFX.toggle() | SFX.isMuted() | SFX.setVolume(0-1) | SFX.getVolume()
 * BGM.start()    | BGM.stop()   | BGM.toggle()  | BGM.isMuted()
 * BGM.setMood('dungeon'|'danger') | BGM.setVolume(0-1) | BGM.getVolume() | BGM.isPlaying()
 */
'use strict';

/* ════════════════════════════════════════════════════════════
   Shared Audio Context
════════════════════════════════════════════════════════════ */
var _audioCtx = null;
var _sfxBus   = null;
var _bgmBus   = null;

function _getCtx() {
    if (!_audioCtx) {
        try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { return null; }
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
}

function _getSfxBus() {
    var c = _getCtx();
    if (!c) return null;
    if (!_sfxBus) {
        _sfxBus = c.createGain();
        _sfxBus.gain.value = 0.9;
        _sfxBus.connect(c.destination);
    }
    return _sfxBus;
}

function _getBgmBus() {
    var c = _getCtx();
    if (!c) return null;
    if (!_bgmBus) {
        _bgmBus = c.createGain();
        _bgmBus.gain.value = 0;
        _bgmBus.connect(c.destination);
    }
    return _bgmBus;
}

/* ════════════════════════════════════════════════════════════
   SFX — Sound Effects
════════════════════════════════════════════════════════════ */
var SFX = (function () {
    var muted  = false;
    var volume = 0.9;

    function playFlip(c, d) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(300, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(160, c.currentTime + 0.13);
        g.gain.setValueAtTime(0.16, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
        o.connect(g); g.connect(d); o.start(); o.stop(c.currentTime + 0.15);
    }

    function playDeal(c, d) {
        var buf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++)
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.5;
        var src = c.createBufferSource(), g = c.createGain();
        var flt = c.createBiquadFilter();
        flt.type = 'bandpass'; flt.frequency.value = 900; flt.Q.value = 0.8;
        src.buffer = buf; g.gain.value = 0.25;
        src.connect(flt); flt.connect(g); g.connect(d); src.start();
    }

    function playSelect(c, d) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = 1100;
        g.gain.setValueAtTime(0.07, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
        o.connect(g); g.connect(d); o.start(); o.stop(c.currentTime + 0.08);
    }

    function playDeselect(c, d) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = 600;
        g.gain.setValueAtTime(0.06, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
        o.connect(g); g.connect(d); o.start(); o.stop(c.currentTime + 0.07);
    }

    function playDamage(c, d) {
        var buf = c.createBuffer(1, c.sampleRate * 0.22, c.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++)
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.8);
        var src = c.createBufferSource(), g = c.createGain();
        var flt = c.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = 500;
        src.buffer = buf; g.gain.value = 0.32;
        src.connect(flt); flt.connect(g); g.connect(d); src.start();
    }

    function playDamageHeavy(c, d) {
        var buf = c.createBuffer(1, c.sampleRate * 0.38, c.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++)
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.4);
        var src = c.createBufferSource(), g = c.createGain();
        var flt = c.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = 300;
        src.buffer = buf; g.gain.value = 0.48;
        src.connect(flt); flt.connect(g); g.connect(d); src.start();
        var o = c.createOscillator(), og = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(80, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(35, c.currentTime + 0.18);
        og.gain.setValueAtTime(0.3, c.currentTime);
        og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
        o.connect(og); og.connect(d); o.start(); o.stop(c.currentTime + 0.2);
    }

    function playHeal(c, d) {
        [523, 659, 784, 1047].forEach(function (freq, i) {
            var o = c.createOscillator(), g = c.createGain();
            var t = c.currentTime + i * 0.07;
            o.type = 'sine'; o.frequency.value = freq;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.12, t + 0.025);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.24);
        });
    }

    function playEquip(c, d) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(180, c.currentTime);
        o.frequency.linearRampToValueAtTime(360, c.currentTime + 0.08);
        g.gain.setValueAtTime(0.14, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
        var flt = c.createBiquadFilter();
        flt.type = 'bandpass'; flt.frequency.value = 800; flt.Q.value = 2;
        o.connect(flt); flt.connect(g); g.connect(d); o.start(); o.stop(c.currentTime + 0.18);
    }

    function playWeaponBreak(c, d) {
        var buf = c.createBuffer(1, c.sampleRate * 0.45, c.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++) {
            var env = i < 0.04 * c.sampleRate
                ? i / (0.04 * c.sampleRate)
                : Math.pow(1 - (i - 0.04 * c.sampleRate) / (0.41 * c.sampleRate), 1.5);
            data[i] = (Math.random() * 2 - 1) * env;
        }
        var src = c.createBufferSource(), g = c.createGain();
        src.buffer = buf; g.gain.value = 0.45;
        src.connect(g); g.connect(d); src.start();
        var o = c.createOscillator(), og = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(600, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.3);
        og.gain.setValueAtTime(0.15, c.currentTime);
        og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.32);
        o.connect(og); og.connect(d); o.start(); o.stop(c.currentTime + 0.35);
    }

    function playAvoid(c, d) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(440, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(110, c.currentTime + 0.25);
        g.gain.setValueAtTime(0.12, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);
        o.connect(g); g.connect(d); o.start(); o.stop(c.currentTime + 0.28);
    }

    function playVictory(c, d) {
        [[523,0],[659,0.1],[784,0.2],[1047,0.32],[1319,0.45],[1568,0.6]].forEach(function (p) {
            var o = c.createOscillator(), g = c.createGain();
            var t = c.currentTime + p[1];
            o.type = 'triangle'; o.frequency.value = p[0];
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.14, t + 0.025);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
            o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.44);
        });
    }

    function playDefeat(c, d) {
        [[294,0],[220,0.18],[185,0.36],[147,0.58]].forEach(function (p) {
            var o = c.createOscillator(), g = c.createGain();
            var t = c.currentTime + p[1];
            o.type = 'sawtooth'; o.frequency.value = p[0];
            g.gain.setValueAtTime(0.17, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
            var flt = c.createBiquadFilter();
            flt.type = 'lowpass'; flt.frequency.value = 600;
            o.connect(flt); flt.connect(g); g.connect(d); o.start(t); o.stop(t + 0.35);
        });
    }

    function playNewGame(c, d) {
        [329, 415, 523].forEach(function (freq, i) {
            var o = c.createOscillator(), g = c.createGain();
            var t = c.currentTime + i * 0.09;
            o.type = 'triangle'; o.frequency.value = freq;
            g.gain.setValueAtTime(0.1, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
            o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.26);
        });
    }

    function playAchievement(c, d) {
        [784, 988, 1175, 1568].forEach(function (freq, i) {
            var o = c.createOscillator(), g = c.createGain();
            var t = c.currentTime + i * 0.065;
            o.type = 'triangle'; o.frequency.value = freq;
            g.gain.setValueAtTime(0.11, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.24);
        });
    }

    var SOUNDS = {
        flip: playFlip, deal: playDeal, select: playSelect, deselect: playDeselect,
        damage: playDamage, damageHeavy: playDamageHeavy, heal: playHeal,
        equip: playEquip, weaponBreak: playWeaponBreak, avoid: playAvoid,
        victory: playVictory, defeat: playDefeat, newGame: playNewGame,
        achievement: playAchievement,
    };

    return {
        play: function (name) {
            if (muted) return;
            var c = _getCtx(), dest = _getSfxBus();
            if (!c || !dest) return;
            var fn = SOUNDS[name];
            if (fn) { try { fn(c, dest); } catch (e) {} }
        },
        toggle:    function ()  { muted = !muted; return muted; },
        setVolume: function (v) {
            volume = Math.max(0, Math.min(1, v));
            var b = _getSfxBus();
            if (b && _audioCtx) b.gain.setTargetAtTime(volume, _audioCtx.currentTime, 0.05);
        },
        getVolume: function () { return volume; },
        isMuted:   function () { return muted; },
    };
})();


/* ════════════════════════════════════════════════════════════
   BGM — Background Music
   Procedural dungeon ambient in C minor.  Loops seamlessly.
   Moods: 'dungeon' (atmospheric) | 'danger' (tense, HP <= 5)
════════════════════════════════════════════════════════════ */
var BGM = (function () {
    var muted   = false;
    var volume  = 0.22;
    var playing = false;
    var mood    = 'dungeon';
    var _nodes  = [];
    var _loopId = null;

    /*
     * Note patterns: [freq_hz, startOffset_s, duration_s, gain_scalar]
     * C minor: C2=65.41, G2=98, Bb2=116.54, C3=130.81,
     *          Eb3=155.56, F3=174.61, G3=196, Ab3=207.65
     */
    var DUNGEON = [
        [65.41,   0,   16,  0.070], // C2 pedal drone
        [98.00,   0,   16,  0.030], // G2 fifth
        [130.81,  0.0,  3.0, 0.085], // C3
        [155.56,  3.2,  2.5, 0.075], // Eb3
        [196.00,  5.8,  1.8, 0.070], // G3
        [174.61,  7.8,  2.2, 0.065], // F3
        [155.56,  9.4,  2.2, 0.075], // Eb3
        [130.81, 11.8,  3.5, 0.085], // C3 tail
        [116.54,  2.2,  1.0, 0.050], // Bb2 colour
        [207.65,  6.5,  0.9, 0.045], // Ab3 colour
    ];

    var DANGER = [
        [65.41,   0,   12,  0.090], // C2 pedal
        [92.50,   0,   12,  0.045], // Gb2 tritone tension
        [130.81,  0.0,  1.2, 0.090],
        [116.54,  1.3,  0.9, 0.080],
        [207.65,  2.4,  0.8, 0.075],
        [196.00,  3.3,  0.7, 0.070],
        [174.61,  4.2,  0.8, 0.075],
        [155.56,  5.2,  1.3, 0.080],
        [130.81,  7.0,  1.2, 0.090],
        [116.54,  8.4,  0.9, 0.080],
        [207.65,  9.5,  1.0, 0.065],
    ];

    function getPattern() { return mood === 'danger' ? DANGER  : DUNGEON; }
    function getLoopDur() { return mood === 'danger' ? 12      : 16; }

    function scheduleLoop() {
        var c    = _getCtx();
        var dest = _getBgmBus();
        if (!c || !dest || !playing) return;

        var t0      = c.currentTime;
        var loopDur = getLoopDur();

        getPattern().forEach(function (note) {
            var freq = note[0], off = note[1], dur = note[2], g = note[3];
            var tOn  = t0 + off;
            var tOff = tOn + dur;
            var osc  = c.createOscillator();
            var gain = c.createGain();
            osc.type = (freq < 100) ? 'triangle' : 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, tOn);
            gain.gain.linearRampToValueAtTime(g, tOn + Math.min(0.5, dur * 0.25));
            gain.gain.setValueAtTime(g * 0.85, tOff - Math.min(0.6, dur * 0.35));
            gain.gain.exponentialRampToValueAtTime(0.0001, tOff + 0.1);
            osc.connect(gain); gain.connect(dest);
            osc.start(tOn); osc.stop(tOff + 0.15);
            _nodes.push(osc);
        });

        // Filtered noise for atmospheric "stone room" texture
        var nLen  = Math.ceil(loopDur * c.sampleRate);
        var nBuf  = c.createBuffer(1, nLen, c.sampleRate);
        var nd    = nBuf.getChannelData(0);
        for (var i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.007;
        var nSrc  = c.createBufferSource();
        var nFlt  = c.createBiquadFilter();
        var nGain = c.createGain();
        nFlt.type = 'bandpass'; nFlt.frequency.value = 260; nFlt.Q.value = 0.35;
        nSrc.buffer = nBuf; nGain.gain.value = 0.4;
        nSrc.connect(nFlt); nFlt.connect(nGain); nGain.connect(dest);
        nSrc.start(t0); nSrc.stop(t0 + loopDur);
        _nodes.push(nSrc);

        _loopId = setTimeout(function () {
            if (playing) scheduleLoop();
        }, Math.max(100, (loopDur - 0.3) * 1000));
    }

    function fadeGain(target, tcSec) {
        var bus = _getBgmBus();
        if (bus && _audioCtx) bus.gain.setTargetAtTime(target, _audioCtx.currentTime, tcSec || 0.4);
    }

    return {
        start: function () {
            if (playing) return;
            playing = true;
            fadeGain(muted ? 0 : volume, 0.8);
            scheduleLoop();
        },

        stop: function () {
            if (!playing) return;
            playing = false;
            fadeGain(0, 0.5);
            clearTimeout(_loopId);
            var old = _nodes; _nodes = [];
            setTimeout(function () {
                old.forEach(function (n) { try { n.stop(); } catch (_) {} });
            }, 2500);
        },

        setMood: function (m) {
            if (m === mood) return;
            mood = m;
            if (!playing) return;
            clearTimeout(_loopId);
            var old = _nodes.slice(); _nodes = [];
            scheduleLoop();
            setTimeout(function () {
                old.forEach(function (n) { try { n.stop(); } catch (_) {} });
            }, 1200);
        },

        toggle: function () {
            muted = !muted;
            fadeGain(muted ? 0 : volume, 0.4);
            return muted;
        },

        setVolume: function (v) {
            volume = Math.max(0, Math.min(1, v));
            if (!muted) fadeGain(volume, 0.15);
        },

        getMood:   function () { return mood; },
        getVolume: function () { return volume; },
        isMuted:   function () { return muted; },
        isPlaying: function () { return playing; },
    };
})();
