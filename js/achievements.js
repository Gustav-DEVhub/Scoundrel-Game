/**
 * SCOUNDREL — Achievements System
 * 14 dungeon-themed achievements, persisted in localStorage.
 * Shows toast notifications on unlock.
 * Usage: Achievements.check(event, data) | Achievements.getAll()
 */
'use strict';

var Achievements = (function () {
    var STORAGE_KEY = 'scoundrel_ach_v1';

    /* ── Definitions ────────────────────────────────────────── */
    var DEFS = [
        { id: 'first_blood',    icon: '🗡️',  title: 'First Blood',        desc: 'Take damage for the first time.'                         },
        { id: 'survivor',       icon: '💀',  title: 'Against All Odds',   desc: 'Survive a bare-handed hit of 10 or more damage.'         },
        { id: 'armorer',        icon: '⚔️',  title: 'Armed & Dangerous',  desc: 'Equip a weapon for the first time.'                      },
        { id: 'field_medic',    icon: '🧪',  title: 'Field Medic',        desc: 'Heal fully back to 20 HP with a potion.'                 },
        { id: 'dungeon_delver', icon: '🏚️',  title: 'Dungeon Delver',     desc: 'Survive 10 turns in a single run.'                       },
        { id: 'iron_will',      icon: '🩸',  title: 'Iron Will',          desc: 'Reach exactly 1 HP and keep going.'                      },
        { id: 'scoundrel',      icon: '🏆',  title: 'Scoundrel Supreme',  desc: 'Clear the dungeon and claim victory.'                    },
        { id: 'speedrun',       icon: '⚡',  title: 'Like a Ghost',       desc: 'Win the game in 12 turns or fewer.'                      },
        { id: 'weapon_master',  icon: '🛡️',  title: 'Weapon Master',      desc: 'Block a monster completely — 0 damage taken.'           },
        { id: 'lightweight',    icon: '🥴',  title: 'Lightweight',        desc: 'Waste a potion (already used one this room).'            },
        { id: 'dragon_slayer',  icon: '🐉',  title: 'Dragon Slayer',      desc: 'Defeat an Ace (value 14) monster.'                       },
        { id: 'shadow_step',    icon: '🌀',  title: 'Shadow Step',        desc: 'Avoid 3 rooms in a single run.'                          },
        { id: 'shattered',      icon: '💔',  title: 'Shattered',          desc: 'Watch your weapon break in the middle of a fight.'       },
        { id: 'legend',         icon: '👑',  title: 'Dungeon Legend',     desc: 'Score 25 or higher on a winning run.'                    },
    ];

    var DEFS_MAP = {};
    DEFS.forEach(function (d) { DEFS_MAP[d.id] = d; });

    var _unlocked  = {};
    var _session   = {};
    var _toastQueue = [];
    var _toastBusy  = false;

    /* ── Persistence ────────────────────────────────────────── */
    function load() {
        try { _unlocked = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
        catch (e) { _unlocked = {}; }
    }
    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_unlocked)); } catch (e) {}
    }

    /* ── Toast ──────────────────────────────────────────────── */
    function showNextToast() {
        if (_toastBusy || _toastQueue.length === 0) return;
        _toastBusy = true;
        var def   = _toastQueue.shift();
        var toast = document.createElement('div');
        toast.className = 'ach-toast';
        toast.setAttribute('role', 'status');
        toast.innerHTML =
            '<span class="ach-toast-icon">' + def.icon + '</span>' +
            '<div class="ach-toast-body">' +
              '<span class="ach-toast-label">Achievement Unlocked</span>' +
              '<span class="ach-toast-title">' + def.title + '</span>' +
              '<span class="ach-toast-desc">'  + def.desc  + '</span>' +
            '</div>' +
            '<button class="ach-toast-close" aria-label="Dismiss">✕</button>';
        document.body.appendChild(toast);
        toast.querySelector('.ach-toast-close').addEventListener('click', function () {
            dismiss(toast);
        });
        requestAnimationFrame(function () { toast.classList.add('is-visible'); });

        var timer = setTimeout(function () { dismiss(toast); }, 3800);
        function dismiss(t) {
            clearTimeout(timer);
            t.classList.remove('is-visible');
            setTimeout(function () {
                if (t.parentNode) t.parentNode.removeChild(t);
                _toastBusy = false;
                showNextToast();
            }, 420);
        }
    }

    /* ── Unlock ─────────────────────────────────────────────── */
    function unlock(id) {
        if (_unlocked[id]) return;
        _unlocked[id] = Date.now();
        save();
        var def = DEFS_MAP[id];
        if (!def) return;
        if (typeof SFX !== 'undefined') SFX.play('achievement');
        _toastQueue.push(def);
        showNextToast();
    }

    /* ── Public: check ──────────────────────────────────────── */
    function check(event, data) {
        data = data || {};
        switch (event) {
            case 'damage':
                unlock('first_blood');
                if (data.bare && data.amount >= 10) unlock('survivor');
                break;
            case 'equip':
                unlock('armorer');
                break;
            case 'heal_full':
                unlock('field_medic');
                break;
            case 'weapon_break':
                unlock('shattered');
                break;
            case 'weapon_block':
                unlock('weapon_master');
                break;
            case 'potion_wasted':
                unlock('lightweight');
                break;
            case 'dragon_slayer':
                unlock('dragon_slayer');
                break;
            case 'avoid':
                _session.avoidCount = (_session.avoidCount || 0) + 1;
                if (_session.avoidCount >= 3) unlock('shadow_step');
                break;
            case 'turn':
                if (data.turn >= 10) unlock('dungeon_delver');
                break;
            case 'low_hp':
                if (data.health <= 1) unlock('iron_will');
                break;
            case 'win':
                unlock('scoundrel');
                if (data.turns  <= 12)  unlock('speedrun');
                if (data.score  >= 25)  unlock('legend');
                break;
        }
    }

    /* ── Public: renderOverlay ──────────────────────────────── */
    function renderOverlay() {
        var grid = document.getElementById('ach-grid');
        if (!grid) return;
        grid.innerHTML = '';
        DEFS.forEach(function (def) {
            var won = !!_unlocked[def.id];
            var card = document.createElement('div');
            card.className = 'ach-card' + (won ? ' ach-card--won' : ' ach-card--locked');
            card.innerHTML =
                '<span class="ach-card-icon">' + (won ? def.icon : '🔒') + '</span>' +
                '<span class="ach-card-title">' + def.title + '</span>' +
                '<span class="ach-card-desc">'  + (won ? def.desc : '???') + '</span>' +
                (won && def.date ? '<span class="ach-card-date">' + new Date(_unlocked[def.id]).toLocaleDateString() + '</span>' : '');
            grid.appendChild(card);
        });
    }

    /* ── Init ───────────────────────────────────────────────── */
    load();

    return {
        check:         check,
        resetSession:  function () { _session = {}; },
        getAll:        function () { return DEFS.map(function (d) { return Object.assign({}, d, { unlocked: !!_unlocked[d.id] }); }); },
        renderOverlay: renderOverlay,
    };
})();
