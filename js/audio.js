/**
 * SCOUNDREL — Audio System
 * Procedural sounds via Web Audio API. No external files required.
 * Usage: SFX.play('flip') | SFX.toggle() | SFX.isMuted()
 */
'use strict';

var SFX = (function () {
    var ctx = null;
    var muted = false;

    function getCtx() {
        if (!ctx) {
            try {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) { return null; }
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    /* ── Sound generators ─────────────────────────────────── */

    function playFlip(c) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(300, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(160, c.currentTime + 0.13);
        g.gain.setValueAtTime(0.16, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.15);
    }

    function playDeal(c) {
        // Soft thud + brief high tick
        var buf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
        var d   = buf.getChannelData(0);
        for (var i = 0; i < d.length; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) * 0.5;
        }
        var src = c.createBufferSource(), g = c.createGain();
        var flt = c.createBiquadFilter();
        flt.type = 'bandpass'; flt.frequency.value = 900; flt.Q.value = 0.8;
        src.buffer = buf; g.gain.value = 0.25;
        src.connect(flt); flt.connect(g); g.connect(c.destination);
        src.start();
    }

    function playSelect(c) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = 1100;
        g.gain.setValueAtTime(0.07, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.08);
    }

    function playDeselect(c) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = 600;
        g.gain.setValueAtTime(0.06, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.07);
    }

    function playDamage(c) {
        var dur = 0.22;
        var buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
        var d   = buf.getChannelData(0);
        for (var i = 0; i < d.length; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.8);
        }
        var src = c.createBufferSource(), g = c.createGain();
        var flt = c.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = 500;
        src.buffer = buf; g.gain.value = 0.32;
        src.connect(flt); flt.connect(g); g.connect(c.destination);
        src.start();
    }

    function playDamageHeavy(c) {
        var dur = 0.38;
        var buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
        var d   = buf.getChannelData(0);
        for (var i = 0; i < d.length; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.4);
        }
        var src = c.createBufferSource(), g = c.createGain();
        var flt = c.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = 300;
        src.buffer = buf; g.gain.value = 0.48;
        src.connect(flt); flt.connect(g); g.connect(c.destination);
        src.start();
        // Sub thud
        var o = c.createOscillator(), og = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(80, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(35, c.currentTime + 0.18);
        og.gain.setValueAtTime(0.3, c.currentTime);
        og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
        o.connect(og); og.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.2);
    }

    function playHeal(c) {
        [523, 659, 784, 1047].forEach(function (freq, i) {
            var o = c.createOscillator(), g = c.createGain();
            var t = c.currentTime + i * 0.07;
            o.type = 'sine'; o.frequency.value = freq;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.12, t + 0.025);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            o.connect(g); g.connect(c.destination);
            o.start(t); o.stop(t + 0.24);
        });
    }

    function playEquip(c) {
        // Metallic scrape
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(180, c.currentTime);
        o.frequency.linearRampToValueAtTime(360, c.currentTime + 0.08);
        g.gain.setValueAtTime(0.14, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
        var flt = c.createBiquadFilter();
        flt.type = 'bandpass'; flt.frequency.value = 800; flt.Q.value = 2;
        o.connect(flt); flt.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.18);
    }

    function playWeaponBreak(c) {
        var dur = 0.45;
        var buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
        var d   = buf.getChannelData(0);
        for (var i = 0; i < d.length; i++) {
            var env = i < 0.04 * c.sampleRate
                ? i / (0.04 * c.sampleRate)
                : Math.pow(1 - (i - 0.04 * c.sampleRate) / (0.41 * c.sampleRate), 1.5);
            d[i] = (Math.random() * 2 - 1) * env;
        }
        var src = c.createBufferSource(), g = c.createGain();
        src.buffer = buf; g.gain.value = 0.45;
        src.connect(g); g.connect(c.destination);
        src.start();
        // Descending tone
        var o = c.createOscillator(), og = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(600, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.3);
        og.gain.setValueAtTime(0.15, c.currentTime);
        og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.32);
        o.connect(og); og.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.35);
    }

    function playAvoid(c) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(440, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(110, c.currentTime + 0.25);
        g.gain.setValueAtTime(0.12, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.28);
    }

    function playVictory(c) {
        // Ascending fanfare
        [[523,0],[659,0.1],[784,0.2],[1047,0.32],[1319,0.45],[1568,0.6]].forEach(function (pair) {
            var o = c.createOscillator(), g = c.createGain();
            var t = c.currentTime + pair[1];
            o.type = 'triangle'; o.frequency.value = pair[0];
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.14, t + 0.025);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
            o.connect(g); g.connect(c.destination);
            o.start(t); o.stop(t + 0.44);
        });
    }

    function playDefeat(c) {
        // Descending toll
        [[294.0,0],[220.0,0.18],[185.0,0.36],[147.0,0.58]].forEach(function (pair) {
            var o = c.createOscillator(), g = c.createGain();
            var t = c.currentTime + pair[1];
            o.type = 'sawtooth'; o.frequency.value = pair[0];
            g.gain.setValueAtTime(0.17, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
            var flt = c.createBiquadFilter();
            flt.type = 'lowpass'; flt.frequency.value = 600;
            o.connect(flt); flt.connect(g); g.connect(c.destination);
            o.start(t); o.stop(t + 0.35);
        });
    }

    function playNewGame(c) {
        [329, 415, 523].forEach(function (freq, i) {
            var o = c.createOscillator(), g = c.createGain();
            var t = c.currentTime + i * 0.09;
            o.type = 'triangle'; o.frequency.value = freq;
            g.gain.setValueAtTime(0.1, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
            o.connect(g); g.connect(c.destination);
            o.start(t); o.stop(t + 0.26);
        });
    }

    function playAchievement(c) {
        [784, 988, 1175, 1568].forEach(function (freq, i) {
            var o = c.createOscillator(), g = c.createGain();
            var t = c.currentTime + i * 0.065;
            o.type = 'triangle'; o.frequency.value = freq;
            g.gain.setValueAtTime(0.11, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            o.connect(g); g.connect(c.destination);
            o.start(t); o.stop(t + 0.24);
        });
    }

    var SOUNDS = {
        flip:         playFlip,
        deal:         playDeal,
        select:       playSelect,
        deselect:     playDeselect,
        damage:       playDamage,
        damageHeavy:  playDamageHeavy,
        heal:         playHeal,
        equip:        playEquip,
        weaponBreak:  playWeaponBreak,
        avoid:        playAvoid,
        victory:      playVictory,
        defeat:       playDefeat,
        newGame:      playNewGame,
        achievement:  playAchievement,
    };

    return {
        play: function (name) {
            if (muted) return;
            var c = getCtx();
            if (!c) return;
            var fn = SOUNDS[name];
            if (fn) { try { fn(c); } catch (e) {} }
        },
        toggle: function () {
            muted = !muted;
            return muted;
        },
        isMuted: function () { return muted; },
    };
})();
