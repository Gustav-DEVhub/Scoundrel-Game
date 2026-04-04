/**
 * SCOUNDREL — Leaderboard
 * Top-10 scores persisted in localStorage. Dungeon-themed overlay.
 * Usage: Leaderboard.add(score, result, turns) | Leaderboard.show() | Leaderboard.hide()
 */
'use strict';

var Leaderboard = (function () {
    var STORAGE_KEY = 'scoundrel_lb_v1';
    var MAX         = 10;

    function load() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
        catch (e) { return []; }
    }
    function save(entries) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (e) {}
    }

    function add(score, result, turns) {
        var entries = load();
        entries.push({ score: score, result: result, turns: turns, date: Date.now() });
        entries.sort(function (a, b) { return b.score - a.score; });
        save(entries.slice(0, MAX));
    }

    function fmtDate(ts) {
        return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
    }

    function renderOverlay() {
        var list    = document.getElementById('lb-list');
        if (!list) return;
        var entries = load();
        list.innerHTML = '';

        if (entries.length === 0) {
            var li = document.createElement('li');
            li.className = 'lb-empty';
            li.textContent = 'No runs recorded yet. Brave the dungeon to leave your mark!';
            list.appendChild(li);
            return;
        }

        var medals = ['👑', '🥈', '🥉'];
        entries.forEach(function (e, i) {
            var li = document.createElement('li');
            li.className = 'lb-entry' + (e.result === 'win' ? ' lb-entry--win' : ' lb-entry--lose');
            var rank  = i < 3 ? medals[i] : '<span class="lb-num">' + (i + 1) + '</span>';
            var badge = e.result === 'win' ? '<span class="lb-badge lb-badge--win">⚔️ Victory</span>'
                                           : '<span class="lb-badge lb-badge--lose">💀 Defeat</span>';
            li.innerHTML =
                '<span class="lb-rank">'  + rank  + '</span>' +
                badge +
                '<span class="lb-score ' + (e.score < 0 ? 'lb-score--neg' : '') + '">' +
                    (e.score > 0 ? '+' : '') + e.score +
                '</span>' +
                '<span class="lb-turns">' + e.turns + ' turns</span>' +
                '<span class="lb-date">'  + fmtDate(e.date) + '</span>';
            list.appendChild(li);
        });
    }

    function show() {
        renderOverlay();
        var overlay = document.getElementById('overlay-leaderboard');
        if (overlay) overlay.hidden = false;
    }

    function hide() {
        var overlay = document.getElementById('overlay-leaderboard');
        if (overlay) overlay.hidden = true;
    }

    return { add: add, show: show, hide: hide };
})();
