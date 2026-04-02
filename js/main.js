/**
 * SCOUNDREL — Complete Game Implementation
 * ==========================================
 * Sections:
 *   1.  Config & State
 *   2.  Deck Setup (Fisher-Yates, 44 cards)
 *   3.  Game Actions  (newGame, drawRoom, avoidRoom, resolveCard)
 *   4.  Weapon Rule   (non-increasing sequence helper)
 *   5.  End-Game & Scoring
 *   6.  Persistence   (localStorage)
 *   7.  Render        (render → renderHUD + renderRoom + renderControls)
 *   8.  Card DOM      (createCardElement, RANK_DISPLAY)
 *   9.  Action Log    (log, logClear)
 *  10.  Overlays      (showEndGame, hideEndGame, showHelp, hideHelp)
 *  11.  Event Listeners
 *  12.  Init
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   1.  CONFIG & STATE
═══════════════════════════════════════════════════════════════ */

const CFG = Object.freeze({
    MAX_HEALTH:  20,
    ROOM_SIZE:   4,
    STORAGE_KEY: 'scoundrel_v1',
});

// True only during drawRoom() so renderRoom knows to start cards face-down
var _isNewDeal = false;

function freshState() {
    return {
        health:              CFG.MAX_HEALTH,
        deck:                [],
        room:                [],
        discard:             [],
        equippedWeapon:      null,
        lastActionWasAvoid:  false,
        potionUsedThisRoom:  false,
        resolvedThisRoom:    0,
        turnCount:           0,
        isGameOver:          false,
        gameResult:          null,
        score:               0,
    };
}

let gs = freshState();


/* ═══════════════════════════════════════════════════════════════
   2.  DECK SETUP
═══════════════════════════════════════════════════════════════ */

const RANK_DISPLAY = v => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[v] ?? String(v));

/**
 * Returns the relative path to the background image for a given card.
 *
 * Mapping rules:
 *   ♥  (potion)  → heart.jpg  (all values)
 *   ♣  (monster) → club-1.jpg  (2–5) | club-2.jpg  (6–10) | club-3.jpg  (J/Q/K/A = 11–14)
 *   ♠  (monster) → spade-1.png (2–5) | spade-2.jpg (6–10) | spade-3.jpg (11–14)
 *   ♦  (weapon)  → diamond-1.jpg (2–4) | diamond-2.jpg (5–7) | diamond-3.jpg (8–10)
 */
function getCardImage(card) {
    var base = 'assets/images.jpg/';
    var v    = card.value;
    switch (card.suit) {
        case '\u2665': return base + 'heart.jpg';
        case '\u2663':
            if (v <= 5)  return base + 'club-1.jpg';
            if (v <= 10) return base + 'club-2.jpg';
            return base + 'club-3.jpg';
        case '\u2660':
            if (v <= 5)  return base + 'spade-1.png';
            if (v <= 10) return base + 'spade-2.jpg';
            return base + 'spade-3.jpg';
        case '\u2666':
            if (v <= 4)  return base + 'diamond-1.jpg';
            if (v <= 7)  return base + 'diamond-2.jpg';
            return base + 'diamond-3.jpg';
    }
    return '';
}

function createDeck() {
    const cards = [];
    for (const suit of ['\u2663', '\u2660']) {
        for (let v = 2; v <= 14; v++) {
            cards.push({ suit, value: v, type: 'monster', id: suit + v, carried: false });
        }
    }
    for (let v = 2; v <= 10; v++) {
        cards.push({ suit: '\u2666', value: v, type: 'weapon', id: '\u2666' + v, carried: false });
    }
    for (let v = 2; v <= 10; v++) {
        cards.push({ suit: '\u2665', value: v, type: 'potion', id: '\u2665' + v, carried: false });
    }
    return fisherYatesShuffle(cards);
}

function fisherYatesShuffle(arr, fn) {
    fn = fn || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(fn() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
}


/* ═══════════════════════════════════════════════════════════════
   3.  GAME ACTIONS
═══════════════════════════════════════════════════════════════ */

function newGame() {
    gs = freshState();
    gs.deck = createDeck();
    localStorage.removeItem(CFG.STORAGE_KEY);
    logClear();
    log('New game started — good luck, scoundrel.', 'log-system');
    drawRoom();
}

function restartGame() {
    const saved = loadGame();
    if (!saved) {
        log('No saved game found — starting fresh.', 'log-system');
        newGame();
        return;
    }
    gs = saved;
    log('Session restored. Continue your run.', 'log-system');
    render();
}

function drawRoom() {
    if (gs.isGameOver) return;

    const carried = gs.room.length === 1 ? Object.assign({}, gs.room[0], { carried: true }) : null;
    gs.room = [];
    if (carried) gs.room.push(carried);

    while (gs.room.length < CFG.ROOM_SIZE && gs.deck.length > 0) {
        gs.room.push(Object.assign({}, gs.deck.pop(), { carried: false }));
    }

    gs.potionUsedThisRoom = false;
    gs.resolvedThisRoom   = 0;
    gs.turnCount++;
    saveGame();

    // Mark as new deal so renderRoom starts cards face-down (for flip animation)
    _isNewDeal = true;
    render();
    _isNewDeal = false;

    // Animate flip for NON-carried new cards only
    requestAnimationFrame(function() {
        document.querySelectorAll('#room-grid .card-slot.is-new-deal').forEach(function(slot, i) {
            setTimeout(function() { slot.classList.add('is-flipped'); }, i * 80 + 40);
        });
    });
}

function avoidRoom() {
    if (gs.isGameOver) return;
    if (gs.lastActionWasAvoid) {
        log('Cannot avoid two rooms in a row!', 'log-avoid');
        return;
    }
    if (gs.room.length < CFG.ROOM_SIZE) {
        log('Cannot avoid — room is incomplete.', 'log-system');
        return;
    }
    gs.deck = gs.room.concat(gs.deck);
    gs.room = [];
    gs.lastActionWasAvoid = true;
    log('Avoided the room — all cards sent to the bottom of the deck.', 'log-avoid');
    drawRoom();
}

function resolveCard(cardIndex) {
    if (gs.isGameOver) return;
    const card = gs.room[cardIndex];
    if (!card) return;
    if (gs.resolvedThisRoom >= CFG.ROOM_SIZE - 1) return;

    let message  = '';
    let logClass = 'log-entry';

    if (card.type === 'weapon') {
        if (gs.equippedWeapon) {
            var oldStack = gs.equippedWeapon.stack || [];
            gs.discard = gs.discard.concat(oldStack).concat([gs.equippedWeapon]);
        }
        gs.equippedWeapon = Object.assign({}, card, { lastDefeated: null, stack: [] });
        gs.discard.push(card);
        message  = 'Equipped \u2666' + card.value + '. Old weapon & stack discarded.';
        logClass = 'log-equip';

    } else if (card.type === 'potion') {
        if (!gs.potionUsedThisRoom) {
            var before = gs.health;
            gs.health = Math.min(CFG.MAX_HEALTH, gs.health + card.value);
            var healed = gs.health - before;
            gs.potionUsedThisRoom = true;
            message  = 'Drank \u2665' + card.value + ' \u2014 healed ' + healed + ' HP (' + gs.health + '/' + CFG.MAX_HEALTH + ').';
            logClass = 'log-heal';
        } else {
            message  = '\u2665' + card.value + ' discarded \u2014 only 1 potion per room.';
            logClass = 'log-system';
        }
        gs.discard.push(card);

    } else if (card.type === 'monster') {
        /*
         * Non-increasing weapon rule:
         *   Weapon usable only if monsterValue <= lastDefeated (or first use).
         * Example: equip ♦7, defeat ♣9 (damage 2, lastDefeated=9).
         *   Next: ♣9 OK (9<=9, damage 2). ♣10 NOT OK (10>9, bare-handed 10 dmg).
         */
        var usedWeapon = canUseWeapon(card.value);
        var damage;
        if (usedWeapon) {
            damage = Math.max(0, card.value - gs.equippedWeapon.value);
            gs.equippedWeapon.stack.push(card);
            gs.equippedWeapon.lastDefeated = card.value;
            if (damage > 0) {
                message  = card.suit + RANK_DISPLAY(card.value) + ' hit for ' + damage + ' dmg (weapon absorbed ' + (card.value - damage) + ').';
                logClass = 'log-damage';
            } else {
                message  = card.suit + RANK_DISPLAY(card.value) + ' fully blocked by \u2666' + gs.equippedWeapon.value + '!';
                logClass = 'log-equip';
            }
        } else {
            damage = card.value;
            var reason = !gs.equippedWeapon
                ? 'bare-handed'
                : 'weapon too dull (chain: \u2264' + gs.equippedWeapon.lastDefeated + ')';
            message  = card.suit + RANK_DISPLAY(card.value) + ' fought ' + reason + ' \u2014 ' + damage + ' damage!';
            logClass = 'log-damage';
            gs.discard.push(card);
        }
        gs.health -= damage;
    }

    gs.room.splice(cardIndex, 1);
    gs.resolvedThisRoom++;
    gs.lastActionWasAvoid = false;

    log(message, logClass);
    checkEndGame();
    saveGame();

    // When the 3rd card of the room has been resolved, exactly 1 card remains
    // (the carried card). Call drawRoom() after a short pause so the player sees
    // it before the next room is dealt. Skip the intermediate render() here —
    // drawRoom() will do a full render itself, preventing the "cards disappear
    // then reappear" cycle.
    var nextRoomPending = !gs.isGameOver
        && gs.room.length === 1
        && gs.resolvedThisRoom === CFG.ROOM_SIZE - 1;

    if (nextRoomPending) {
        setTimeout(drawRoom, 400);
    } else {
        render();
    }
}


/* ═══════════════════════════════════════════════════════════════
   4.  WEAPON RULE
═══════════════════════════════════════════════════════════════ */

function canUseWeapon(monsterValue) {
    if (!gs.equippedWeapon) return false;
    var ld = gs.equippedWeapon.lastDefeated;
    return ld === null || monsterValue <= ld;
}

function previewDamage(monsterValue) {
    if (canUseWeapon(monsterValue)) {
        return Math.max(0, monsterValue - gs.equippedWeapon.value);
    }
    return monsterValue;
}


/* ═══════════════════════════════════════════════════════════════
   5.  END-GAME & SCORING
═══════════════════════════════════════════════════════════════ */

function checkEndGame() {
    if (gs.health <= 0) {
        gs.health     = 0;
        gs.isGameOver = true;
        gs.gameResult = 'lose';
        var remaining = gs.deck.concat(gs.room).filter(function(c) { return c.type === 'monster'; });
        gs.score = -remaining.reduce(function(sum, c) { return sum + c.value; }, 0);
        log('Defeated! Score: ' + gs.score, 'log-lose');
        setTimeout(showEndGame, 600);
        return;
    }
    if (gs.deck.length === 0 && gs.room.length === 0) {
        gs.isGameOver = true;
        gs.gameResult = 'win';
        gs.score      = gs.health;
        log('Victory! Dungeon cleared. Score: ' + gs.score, 'log-win');
        setTimeout(showEndGame, 600);
    }
}


/* ═══════════════════════════════════════════════════════════════
   6.  PERSISTENCE
═══════════════════════════════════════════════════════════════ */

function saveGame() {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(gs)); } catch(_) {}
}

function loadGame() {
    try {
        var raw = localStorage.getItem(CFG.STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(_) { return null; }
}


/* ═══════════════════════════════════════════════════════════════
   7.  RENDER
═══════════════════════════════════════════════════════════════ */

function render() {
    renderHUD();
    renderRoom();
    renderControls();
}

function renderHUD() {
    var pct   = (gs.health / CFG.MAX_HEALTH) * 100;
    var fill  = document.getElementById('health-bar-fill');
    var track = document.getElementById('health-bar-track');

    fill.style.width = pct + '%';
    fill.classList.remove('hp-mid', 'hp-low');
    if      (pct <= 25) fill.classList.add('hp-low');
    else if (pct <= 50) fill.classList.add('hp-mid');

    track.setAttribute('aria-valuenow', gs.health);
    document.getElementById('health-value').textContent = gs.health + ' / ' + CFG.MAX_HEALTH;

    var weaponDisplay = document.getElementById('weapon-display');
    var weaponVal     = document.getElementById('weapon-value');
    var weaponLast    = document.getElementById('weapon-last-value');

    if (gs.equippedWeapon) {
        weaponDisplay.classList.remove('no-weapon');
        weaponVal.textContent  = '\u2666' + gs.equippedWeapon.value;
        weaponLast.textContent = gs.equippedWeapon.lastDefeated !== null
            ? String(gs.equippedWeapon.lastDefeated) : '\u2014';
    } else {
        weaponDisplay.classList.add('no-weapon');
        weaponVal.textContent  = '\u2014';
        weaponLast.textContent = '\u2014';
    }

    document.getElementById('turn-counter').textContent  = gs.turnCount;
    document.getElementById('deck-count').textContent    = gs.deck.length;
    document.getElementById('discard-count').textContent = gs.discard.length;

    document.getElementById('avoid-notice').hidden  = !gs.lastActionWasAvoid;
    document.getElementById('potion-notice').hidden = !gs.potionUsedThisRoom;
}

function renderRoom() {
    var grid = document.getElementById('room-grid');
    grid.innerHTML = '';

    gs.room.forEach(function(card, index) {
        grid.appendChild(createCardElement(card, index));
    });

    for (var i = gs.room.length; i < CFG.ROOM_SIZE; i++) {
        var empty = document.createElement('li');
        empty.className = 'card-slot card-slot--empty';
        empty.setAttribute('role', 'listitem');
        empty.setAttribute('aria-label', 'Empty slot');
        grid.appendChild(empty);
    }
}

function renderControls() {
    var btnAvoid = document.getElementById('btn-avoid');
    var canAvoid = !gs.isGameOver
        && !gs.lastActionWasAvoid
        && gs.room.length === CFG.ROOM_SIZE;

    btnAvoid.setAttribute('aria-disabled', String(!canAvoid));
    if (canAvoid) {
        btnAvoid.removeAttribute('disabled');
    } else {
        btnAvoid.setAttribute('disabled', '');
    }

    document.getElementById('avoid-badge').hidden = !gs.lastActionWasAvoid;
}


/* ═══════════════════════════════════════════════════════════════
   8.  CARD DOM
═══════════════════════════════════════════════════════════════ */

function createCardElement(card, index) {
    var rank      = RANK_DISPLAY(card.value);
    var suit      = card.suit;
    var typeLabel = card.type.charAt(0).toUpperCase() + card.type.slice(1);
    var isCarried = !!card.carried;

    var tipText = '';
    if (card.type === 'monster') {
        var dmg = previewDamage(card.value);
        if (canUseWeapon(card.value)) {
            tipText = dmg === 0 ? 'Fully blocked by weapon' : dmg + ' dmg (weapon)';
        } else {
            tipText = card.value + ' dmg (bare-handed)';
        }
    } else if (card.type === 'potion') {
        if (gs.potionUsedThisRoom) {
            tipText = 'Will be discarded';
        } else {
            var healed = Math.min(CFG.MAX_HEALTH - gs.health, card.value);
            tipText = healed > 0 ? '+' + healed + ' HP' : 'Already at full HP';
        }
    } else if (card.type === 'weapon') {
        tipText = 'Equip \u2666' + card.value;
    }

    var ariaLabel = typeLabel + ' ' + suit + rank + (tipText ? ': ' + tipText : '') + '. Press to resolve.';

    var imgSrc = getCardImage(card);

    var slot = document.createElement('li');
    // During a new deal: non-carried cards start face-down (is-new-deal, no is-flipped yet).
    // Mid-room (player resolving cards): all cards already visible → add is-flipped immediately.
    var classes = ['card-slot', 'card-slot--' + card.type, 'is-dealing'];
    if (isCarried) {
        classes.push('is-carried', 'is-flipped');
    } else if (_isNewDeal) {
        classes.push('is-new-deal'); // RAF in drawRoom() will add is-flipped with stagger
    } else {
        classes.push('is-flipped'); // already visible mid-room, show face-up
    }
    slot.className = classes.join(' ');
    slot.setAttribute('role', 'listitem');
    slot.setAttribute('aria-label', ariaLabel);

    var carriedBadge = isCarried ? '<span class="carried-badge" aria-hidden="true">\u25c8 carried</span>' : '';
    var damageTip    = tipText   ? '<span class="card-damage-tip" aria-hidden="true">' + tipText + '</span>' : '';

    var imgStyle = imgSrc ? ' style="background-image:url(\'' + imgSrc + '\')"' : '';

    slot.innerHTML =
        '<span class="card-slot-number" aria-hidden="true">' + (index + 1) + '</span>' +
        '<div class="card-inner">' +
          '<div class="card-face card-back" aria-hidden="true"></div>' +
          '<button class="card-face card-front" tabindex="0"' +
                  ' aria-label="' + ariaLabel + '"' +
                  ' data-index="' + index + '"' +
                  imgStyle + '>' +
            '<span class="card-tl" aria-hidden="true">' +
              '<span class="card-rank">' + rank + '</span>' +
              '<span class="card-suit-small">' + suit + '</span>' +
            '</span>' +
            '<span class="card-center-suit" aria-hidden="true">' + suit + '</span>' +
            '<span class="card-br" aria-hidden="true">' +
              '<span class="card-rank">' + rank + '</span>' +
              '<span class="card-suit-small">' + suit + '</span>' +
            '</span>' +
            '<span class="card-type-label" aria-hidden="true">' + typeLabel + '</span>' +
            carriedBadge +
            damageTip +
          '</button>' +
        '</div>';

    slot.querySelector('.card-front').addEventListener('click', function() {
        if (!gs.isGameOver) resolveCard(index);
    });

    return slot;
}


/* ═══════════════════════════════════════════════════════════════
   9.  ACTION LOG
═══════════════════════════════════════════════════════════════ */

function log(message, cls) {
    cls = cls || '';
    var list = document.getElementById('log-list');
    var li   = document.createElement('li');
    li.className = ('log-entry ' + cls).trim();
    var prefix = gs.turnCount > 0 ? '[T' + gs.turnCount + '] ' : '';
    li.textContent = prefix + message;
    list.appendChild(li);
    requestAnimationFrame(function() {
        var scroll = document.getElementById('log-scroll');
        scroll.scrollTop = scroll.scrollHeight;
    });
}

function logClear() {
    document.getElementById('log-list').innerHTML = '';
}


/* ═══════════════════════════════════════════════════════════════
  10.  OVERLAYS
═══════════════════════════════════════════════════════════════ */

function showEndGame() {
    var overlay = document.getElementById('overlay-endgame');
    var title   = document.getElementById('endgame-title');
    var desc    = document.getElementById('endgame-desc');
    var scoreEl = document.getElementById('endgame-score');

    if (gs.gameResult === 'win') {
        title.textContent = '\u2694 Victory!';
        title.className   = 'dialog-title win';
        desc.textContent  = 'You cleared the dungeon and lived to tell the tale.';
    } else {
        title.textContent = '\u2620 Defeated';
        title.className   = 'dialog-title lose';
        desc.textContent  = "You fell in the dungeon. The scoundrel's luck ran out.";
    }

    scoreEl.textContent = gs.score;
    scoreEl.className   = 'score-value' + (gs.score < 0 ? ' negative' : '');

    overlay.hidden = false;
    var firstBtn = overlay.querySelector('button');
    if (firstBtn) firstBtn.focus();
}

function hideEndGame() {
    document.getElementById('overlay-endgame').hidden = true;
}

function showHelp() {
    document.getElementById('overlay-help').hidden = false;
    document.getElementById('btn-help-close').focus();
}

function hideHelp() {
    document.getElementById('overlay-help').hidden = true;
    document.getElementById('btn-help').focus();
}


/* ═══════════════════════════════════════════════════════════════
  11.  EVENT LISTENERS
═══════════════════════════════════════════════════════════════ */

function setupEvents() {
    document.getElementById('btn-new-game').addEventListener('click', newGame);
    document.getElementById('btn-restart').addEventListener('click', restartGame);
    document.getElementById('btn-avoid').addEventListener('click', avoidRoom);
    document.getElementById('btn-help').addEventListener('click', showHelp);
    document.getElementById('btn-help-close').addEventListener('click', hideHelp);

    document.getElementById('overlay-help').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) hideHelp();
    });

    document.getElementById('btn-endgame-new').addEventListener('click', function() {
        hideEndGame(); newGame();
    });
    document.getElementById('btn-endgame-restart').addEventListener('click', function() {
        hideEndGame(); restartGame();
    });
    document.getElementById('overlay-endgame').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) hideEndGame();
    });

    document.addEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
    if (e.target.matches('input, textarea, select')) return;

    var helpOpen    = !document.getElementById('overlay-help').hidden;
    var endgameOpen = !document.getElementById('overlay-endgame').hidden;

    if (e.key === 'Escape') {
        if (helpOpen)    { hideHelp();    return; }
        if (endgameOpen) { hideEndGame(); return; }
    }

    if (helpOpen || endgameOpen) return;

    var key = e.key.toUpperCase();
    if (key === 'N') { e.preventDefault(); newGame();   return; }
    if (key === 'A') { e.preventDefault(); avoidRoom(); return; }
    if (key === 'H' || e.key === '?') { e.preventDefault(); showHelp(); return; }
    if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        if (!gs.isGameOver) resolveCard(Number(e.key) - 1);
    }
}


/* ═══════════════════════════════════════════════════════════════
  12.  INIT
═══════════════════════════════════════════════════════════════ */

function init() {
    setupEvents();
    var saved = loadGame();
    if (saved && !saved.isGameOver) {
        gs = saved;
        log('Session restored. Continue your run.', 'log-system');
        render();
        requestAnimationFrame(function() {
            document.querySelectorAll('#room-grid .card-slot').forEach(function(slot) {
                slot.classList.add('is-flipped');
            });
        });
    } else {
        newGame();
    }
}

init();
