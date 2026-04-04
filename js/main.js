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
var _isNewDeal    = false;
// Guard: prevents a second drawRoom() from firing if the user clicks
// another card while the 400ms transition setTimeout is still pending
var _drawPending  = false;

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
        selectedCards:       [],
        carriedCard:         null,
        killingCard:         null,
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
    // Smooth reset: flip current cards back, then deal a fresh room
    var existingSlots = document.querySelectorAll(
        '#room-grid .card-slot:not(.card-slot--empty):not(.is-resetting)'
    );
    if (existingSlots.length > 0) {
        existingSlots.forEach(function(slot) {
            slot.classList.add('is-resetting');
        });
        setTimeout(_startNewGame, 240);
    } else {
        _startNewGame();
    }
}

function _startNewGame() {
    gs = freshState();
    gs.deck = createDeck();
    localStorage.removeItem(CFG.STORAGE_KEY);
    logClear();
    log('New game started — good luck, scoundrel.', 'log-system');
    SFX.play('newGame');
    Achievements.resetSession();
    // Start / reset BGM to normal dungeon mood
    if (typeof BGM !== 'undefined') {
        if (!BGM.isPlaying()) BGM.start();
        else BGM.setMood('dungeon');
    }
    drawRoom();
}

function updateBgmMood() {
    if (typeof BGM === 'undefined' || gs.isGameOver) return;
    BGM.setMood(gs.health <= 5 ? 'danger' : 'dungeon');
}

function drawRoom() {
    if (gs.isGameOver) return;
    _drawPending = false; // clear the guard whenever we actually run

    const carried = gs.room.length === 1 ? Object.assign({}, gs.room[0], { carried: true }) : null;
    gs.room = [];
    if (carried) gs.room.push(carried);

    while (gs.room.length < CFG.ROOM_SIZE && gs.deck.length > 0) {
        gs.room.push(Object.assign({}, gs.deck.pop(), { carried: false }));
    }

    gs.potionUsedThisRoom = false;
    gs.resolvedThisRoom   = 0;
    gs.selectedCards      = [];
    gs.carriedCard        = null;
    gs.turnCount++;
    if (gs.turnCount > 1) logTurnDivider(gs.turnCount);
    saveGame();

    // Mark as new deal so renderRoom starts cards face-down (for flip animation)
    _isNewDeal = true;
    render();
    _isNewDeal = false;

    // Animate flip for NON-carried new cards only
    requestAnimationFrame(function() {
        document.querySelectorAll('#room-grid .card-slot.is-new-deal').forEach(function(slot) {
            slot.classList.add('is-flipped');
        });
        SFX.play('deal');
    });
    Achievements.check('turn', { turn: gs.turnCount });
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
    var slots = document.querySelectorAll(
        '#room-grid .card-slot:not(.card-slot--empty):not(.is-resetting)'
    );
    if (slots.length > 0) {
        slots.forEach(function(slot) {
            slot.classList.add('is-resetting');
        });
        setTimeout(_avoidRoomNow, 200);
    } else {
        _avoidRoomNow();
    }
}

function _avoidRoomNow() {
    gs.deck = gs.room.concat(gs.deck);
    gs.room = [];
    gs.lastActionWasAvoid = true;
    SFX.play('avoid');
    Achievements.check('avoid');
    log('Avoided the room — all cards sent to the bottom of the deck.', 'log-avoid');
    drawRoom();
}

/* ── Selection ── */
function toggleCardSelection(index) {
    if (gs.isGameOver) return;
    var card = gs.room[index];
    if (!card) return;

    var pos = gs.selectedCards.indexOf(index);
    if (pos !== -1) {
        // Already selected — deselect
        gs.selectedCards.splice(pos, 1);
        SFX.play('deselect');
    } else {
        // Select only if under the 3-card limit
        if (gs.selectedCards.length >= CFG.ROOM_SIZE - 1) {
            log('You can only select 3 cards — deselect one first.', 'log-system');
            return;
        }
        gs.selectedCards.push(index);
        SFX.play('select');
    }
    render();
    updateUIState();
}

function resolveCurrentRoom() {
    if (gs.isGameOver) return;
    if (gs.selectedCards.length < CFG.ROOM_SIZE - 1) return;

    // 1. Identify the carried card — the room index NOT in selectedCards
    var carriedIdx = [0, 1, 2, 3].find(function(i) {
        return i < gs.room.length && gs.selectedCards.indexOf(i) === -1;
    });
    gs.carriedCard = (carriedIdx !== undefined)
        ? Object.assign({}, gs.room[carriedIdx])
        : null;

    // 2. Snapshot card *references* in selection order so strategic order
    //    (e.g. equip weapon → fight monster) is honoured, and so we can
    //    find each card's live index by reference after prior splices.
    var toResolve = gs.selectedCards.map(function(idx) {
        return gs.room[idx];
    });

    SFX.play('flip');

    // Animate selected cards flipping back before resolution
    gs.selectedCards.forEach(function(idx) {
        var btn = document.querySelector('#room-grid .card-front[data-index="' + idx + '"]');
        if (btn && btn.parentElement && btn.parentElement.parentElement) {
            btn.parentElement.parentElement.classList.add('is-resolving');
        }
    });

    // 3. Clear selection visually before processing
    gs.selectedCards = [];

    // 4. Process each card after a short flip animation
    setTimeout(function() {
        toResolve.forEach(function(card) {
            var currentIdx = gs.room.indexOf(card);
            if (currentIdx !== -1) resolveCard(currentIdx);
        });
    }, 220);
}

function updateUIState() {
    var btn     = document.getElementById('btn-face');
    var counter = document.getElementById('face-counter');
    if (!btn) return;

    var selected = gs.selectedCards.length;
    var needed   = (CFG.ROOM_SIZE - 1) - selected;
    var canFace  = selected >= CFG.ROOM_SIZE - 1
                   && !gs.isGameOver
                   && gs.room.length === CFG.ROOM_SIZE;

    if (canFace) {
        btn.disabled = false;
        btn.classList.add('is-ready');
        counter.textContent = '';
    } else {
        btn.disabled = true;
        btn.classList.remove('is-ready');
        counter.textContent = needed > 0 ? '(' + needed + ' more)' : '';
    }
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
            // Old weapon + all monsters it defeated go to discard when replaced
            var oldStack = gs.equippedWeapon.stack || [];
            gs.discard = gs.discard.concat(oldStack).concat([gs.equippedWeapon]);
            message  = 'Equipped \u2666' + card.value + '. Old \u2666' + gs.equippedWeapon.value + ' & stack discarded.';
        } else {
            message  = 'Equipped \u2666' + card.value + '.';
        }
        // Weapon stays "in play" as equippedWeapon — it goes to discard only when replaced or broken
        // lastDefeated starts at Infinity so the first monster always triggers weapon use
        gs.equippedWeapon = Object.assign({}, card, { lastDefeated: Infinity, stack: [] });
        logClass = 'log-equip';
        SFX.play('equip');
        Achievements.check('equip');
        Particles.burstFromElement(document.getElementById('weapon-display'), 'equip', 10);

    } else if (card.type === 'potion') {
        if (!gs.potionUsedThisRoom) {
            var before = gs.health;
            gs.health = Math.min(CFG.MAX_HEALTH, gs.health + card.value);
            var healed = gs.health - before;
            gs.potionUsedThisRoom = true;
            message  = 'Drank \u2665' + card.value + ' \u2014 healed ' + healed + ' HP (' + gs.health + '/' + CFG.MAX_HEALTH + ').';
            logClass = 'log-heal';
            SFX.play('heal');
            Particles.burstFromElement(document.getElementById('health-bar-fill'), 'heal', 16);
            if (gs.health === CFG.MAX_HEALTH) Achievements.check('heal_full');
            updateBgmMood();
        } else {
            message  = '\u2665' + card.value + ' discarded \u2014 only 1 potion per room.';
            logClass = 'log-system';
            Achievements.check('potion_wasted');
        }
        gs.discard.push(card);

    } else if (card.type === 'monster') {
        /*
         * Strictly-decreasing weapon rule:
         *   Weapon usable only if monsterValue < lastDefeated (Infinity on a fresh weapon).
         * Example: equip ♦7, defeat ♣9 (damage 2, lastDefeated=9).
         *   Next: ♣8 OK (8<9). ♣9 NOT OK (9≮9, weapon breaks, full damage).
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
                SFX.play('damage');
                Particles.burstFromElement(document.getElementById('health-bar-fill'), 'damage', 10);
            } else {
                message  = card.suit + RANK_DISPLAY(card.value) + ' fully blocked by \u2666' + gs.equippedWeapon.value + '!';
                logClass = 'log-equip';
                SFX.play('equip');
                Achievements.check('weapon_block');
            }
        } else if (gs.equippedWeapon) {
            // Weapon exists but monster >= lastDefeated — weapon BREAKS
            damage = card.value;
            var brokenWeapon = gs.equippedWeapon;
            gs.discard = gs.discard.concat(brokenWeapon.stack || []).concat([brokenWeapon]);
            gs.equippedWeapon = null;
            gs.discard.push(card);
            message  = '\u2620 ' + card.suit + RANK_DISPLAY(card.value) + ' overpowered the weapon! \u2666' + brokenWeapon.value + ' broke \u2014 ' + damage + ' damage!';
            logClass = 'log-damage';
            log('\u26A0\uFE0F The weapon broke!', 'log-system');
            SFX.play('weaponBreak');
            Achievements.check('weapon_break');
            Particles.burstFromElement(document.getElementById('weapon-display'), 'damage', 14);
        } else {
            // No weapon — bare-handed
            damage = card.value;
            gs.discard.push(card);
            message  = card.suit + RANK_DISPLAY(card.value) + ' fought bare-handed \u2014 ' + damage + ' damage!';
            logClass = 'log-damage';
            SFX.play(damage >= 8 ? 'damageHeavy' : 'damage');
            Particles.burstFromElement(document.getElementById('health-bar-fill'), 'damage', 10);
            Achievements.check('damage', { bare: true, amount: damage });
        }
        gs.health -= damage;
        if (gs.health <= 0 && !gs.killingCard) gs.killingCard = Object.assign({}, card);
        if (gs.health > 0) Achievements.check('low_hp', { health: gs.health });
        if (card.value === 14) Achievements.check('dragon_slayer');
        updateBgmMood();
    }

    gs.room.splice(cardIndex, 1);
    gs.resolvedThisRoom++;
    gs.lastActionWasAvoid = false;

    log(message, logClass);
    checkEndGame();
    saveGame();

    // Always render immediately so the resolved card disappears at once.
    render();

    // After the 3rd resolve, 1 card remains (the carry-forward).
    // Trigger the next room after a short pause. The _drawPending guard
    // prevents a double draw if the user somehow triggers another action
    // before the timeout fires.
    var nextRoomPending = !gs.isGameOver
        && gs.room.length === 1
        && gs.resolvedThisRoom === CFG.ROOM_SIZE - 1;

    if (nextRoomPending && !_drawPending) {
        _drawPending = true;
        setTimeout(drawRoom, 300);
    }
}


/* ═══════════════════════════════════════════════════════════════
   4.  WEAPON RULE
═══════════════════════════════════════════════════════════════ */

function canUseWeapon(monsterValue) {
    if (!gs.equippedWeapon) return false;
    var ld = gs.equippedWeapon.lastDefeated; // Infinity on a fresh weapon
    return monsterValue < ld; // strictly less — equal or greater breaks the weapon
}

function previewDamage(monsterValue) {
    if (canUseWeapon(monsterValue)) {
        return Math.max(0, monsterValue - gs.equippedWeapon.value);
    }
    return monsterValue; // bare-handed or weapon will break
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
        SFX.play('defeat');
        if (typeof BGM !== 'undefined') BGM.stop();
        Leaderboard.add(gs.score, 'lose', gs.turnCount);
        setTimeout(showEndGame, 600);
        return;
    }
    if (gs.deck.length === 0 && gs.room.length === 0) {
        gs.isGameOver = true;
        gs.gameResult = 'win';
        var weaponBonus = gs.equippedWeapon ? gs.equippedWeapon.value : 0;
        gs.score      = gs.health + weaponBonus;
        log('Victory! Dungeon cleared. Score: ' + gs.score + ' (HP ' + gs.health + (weaponBonus ? ' + weapon ' + weaponBonus : '') + ')', 'log-win');
        SFX.play('victory');
        if (typeof BGM !== 'undefined') BGM.stop();
        Achievements.check('win', { turns: gs.turnCount, score: gs.score });
        Leaderboard.add(gs.score, 'win', gs.turnCount);
        var roomEl = document.getElementById('room-grid');
        if (roomEl) {
            var r = roomEl.getBoundingClientRect();
            Particles.burst(r.left + r.width / 2, r.top + r.height / 2, 'victory', 36);
        }
        setTimeout(showEndGame, 600);
    }
}


/* ═══════════════════════════════════════════════════════════════
   6.  PERSISTENCE
═══════════════════════════════════════════════════════════════ */

function saveGame() {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(gs)); } catch(_) {}
    flashSaveIndicator();
}

function flashSaveIndicator() {
    var el = document.getElementById('save-indicator');
    if (!el) return;
    el.classList.remove('is-saving');
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('is-saving');
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
    updateUIState();
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
        weaponLast.textContent = (gs.equippedWeapon.lastDefeated === Infinity)
            ? '\u2014' : String(gs.equippedWeapon.lastDefeated);
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
        var el = createCardElement(card, index);
        if (gs.selectedCards.indexOf(index) !== -1) {
            el.classList.add('is-selected');
        }
        grid.appendChild(el);
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
    // Only animate the deal drop-in during actual new deals, NOT mid-room re-renders.
    // Adding is-dealing on every render was causing visible card jumps on selection.
    var classes = ['card-slot', 'card-slot--' + card.type];
    if (isCarried) {
        classes.push('is-carried', 'is-flipped');
    } else if (_isNewDeal) {
        classes.push('is-dealing', 'is-new-deal'); // RAF in drawRoom() adds is-flipped
    } else {
        classes.push('is-flipped', 'is-instant-flip'); // mid-room: snap face-up, no transition
    }
    slot.className = classes.join(' ');
    slot.setAttribute('role', 'listitem');
    slot.setAttribute('aria-label', ariaLabel);

    var carriedBadge = isCarried ? '<span class="carried-badge" aria-hidden="true">\u25c8 carried</span>' : '';
    var damageTip    = tipText   ? '<span class="card-damage-tip" aria-hidden="true">' + tipText + '</span>' : '';

    var imgStyle = imgSrc ? ' style="background-image:url(\'' + imgSrc + '\')"' : '';

    // When a background image is present:
    //  - omit the large center suit pip (it covers the art)
    //  - omit the type label (redundant with the image)
    //  - keep only the small corner rank+suit badges
    var centerSuit = imgSrc ? '' : '<span class="card-center-suit" aria-hidden="true">' + suit + '</span>';
    var typeLabel2 = imgSrc ? '' : '<span class="card-type-label" aria-hidden="true">' + typeLabel + '</span>';

    slot.innerHTML =
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
            centerSuit +
            typeLabel2 +
            carriedBadge +
            damageTip +
          '</button>' +
        '</div>';

    slot.querySelector('.card-front').addEventListener('click', function() {
        if (!gs.isGameOver) {
            Particles.burstFromElement(this, 'flip', 6);
            toggleCardSelection(index);
        }
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
    li.textContent = message;
    list.appendChild(li);
    requestAnimationFrame(function() {
        var scroll = document.getElementById('log-scroll');
        scroll.scrollTop = scroll.scrollHeight;
    });
}

function logTurnDivider(n) {
    var list = document.getElementById('log-list');
    var li   = document.createElement('li');
    li.className = 'log-turn-divider';
    li.setAttribute('aria-hidden', 'true');
    li.innerHTML = '<span class="log-turn-label">Turn ' + n + '</span>';
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
        desc.textContent  = 'You died in the dungeon. The scoundrel\'s luck ran out.';
    }

    scoreEl.textContent = gs.score;
    scoreEl.className   = 'score-value' + (gs.score < 0 ? ' negative' : '');

    // Killing card — only displayed on defeat
    var killingWrap = document.getElementById('killing-card-wrap');
    var killingEl   = document.getElementById('killing-card');
    if (gs.gameResult === 'lose' && gs.killingCard) {
        var kc      = gs.killingCard;
        var imgSrc  = getCardImage(kc);
        var imgAttr = imgSrc ? ' style="background-image:url(\'' + imgSrc + '\')"' : '';
        killingEl.className = 'killing-card killing-card--' + kc.type;
        killingEl.innerHTML =
            '<div class="killing-card-inner"' + imgAttr + '>' +
              '<span class="card-tl" aria-hidden="true">' +
                '<span class="card-rank">' + RANK_DISPLAY(kc.value) + '</span>' +
                '<span class="card-suit-small">' + kc.suit + '</span>' +
              '</span>' +
            '</div>';
        killingWrap.hidden = false;
    } else {
        killingEl.innerHTML = '';
        killingWrap.hidden  = true;
    }

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

/* ── Button ripple effect ──────────────────────────────── */
function addRipple(e) {
    var btn  = e.currentTarget;
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var x    = (e.clientX || rect.left + rect.width  / 2) - rect.left - size / 2;
    var y    = (e.clientY || rect.top  + rect.height / 2) - rect.top  - size / 2;
    var span = document.createElement('span');
    span.className = 'btn-ripple';
    span.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + x + 'px;top:' + y + 'px';
    btn.appendChild(span);
    setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 500);
}

/* ── Focus trap ─────────────────────────────────────────── */
function trapFocus(overlayEl) {
    var focusable = overlayEl.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last  = focusable[focusable.length - 1];
    overlayEl.addEventListener('keydown', function onTrap(e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
            if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
    });
}

/* ── Settings ───────────────────────────────────────────── */
function showSettings() {
    var overlay = document.getElementById('overlay-settings');
    if (!overlay) return;
    // Sync all controls with current runtime state
    document.getElementById('toggle-sound').checked  = !SFX.isMuted();
    document.getElementById('toggle-motion').checked = !document.body.classList.contains('reduce-motion');
    var tMusic = document.getElementById('toggle-music');
    if (tMusic) tMusic.checked = !BGM.isMuted();
    var sSfx = document.getElementById('slider-sfx-vol');
    if (sSfx) sSfx.value = Math.round(SFX.getVolume() * 100);
    var sMus = document.getElementById('slider-music-vol');
    if (sMus) sMus.value = Math.round(BGM.getVolume() * 100);
    overlay.hidden = false;
    document.getElementById('btn-settings-close').focus();
}

/* ── Touch / swipe controls ─────────────────────────────── */
function setupTouchControls() {
    var grid = document.getElementById('room-grid');
    if (!grid || !('ontouchstart' in window)) return;

    var tx = 0, ty = 0, ts = 0;
    var DIST = 50, TIME = 380; // px and ms thresholds

    grid.addEventListener('touchstart', function (e) {
        tx = e.touches[0].clientX;
        ty = e.touches[0].clientY;
        ts = Date.now();
    }, { passive: true });

    grid.addEventListener('touchend', function (e) {
        if (!e.changedTouches.length) return;
        var dx = e.changedTouches[0].clientX - tx;
        var dy = e.changedTouches[0].clientY - ty;
        if (Date.now() - ts > TIME) return;
        var ax = Math.abs(dx), ay = Math.abs(dy);
        if (ax < DIST && ay < DIST) return; // tap, not swipe
        if (ax > ay * 1.4 && dx < 0) { // swipe left → avoid
            avoidRoom(); return;
        }
        if (ay > ax * 1.4 && dy < 0) { // swipe up → face selected
            if (gs.selectedCards.length >= CFG.ROOM_SIZE - 1) resolveCurrentRoom();
        }
    }, { passive: true });

    // Show swipe hint once, then dismiss
    var hint = document.getElementById('swipe-hint');
    if (hint && !localStorage.getItem('scoundrel_swipe_v1')) {
        hint.hidden = false;
        setTimeout(function () { hint.hidden = true; }, 4000);
        hint.addEventListener('click', function () { hint.hidden = true; });
        localStorage.setItem('scoundrel_swipe_v1', '1');
    }
}
function hideSettings() {
    document.getElementById('overlay-settings').hidden = true;
    document.getElementById('btn-settings').focus();
}

/* ── Onboarding ─────────────────────────────────────────── */
var ONBOARD_KEY = 'scoundrel_welcomed_v1';
function showOnboarding() {
    var overlay = document.getElementById('overlay-onboarding');
    if (!overlay) return;
    overlay.hidden = false;
    var btn = overlay.querySelector('button');
    if (btn) btn.focus();
    trapFocus(overlay);
}
function hideOnboarding() {
    var overlay = document.getElementById('overlay-onboarding');
    if (!overlay) return;
    overlay.hidden = true;
    localStorage.setItem(ONBOARD_KEY, '1');
    newGame();
}

function setupEvents() {
    setupTouchControls();
    document.querySelectorAll('.btn').forEach(function (b) { b.addEventListener('click', addRipple); });

    // Trap focus in all dialog overlays
    document.querySelectorAll('.overlay').forEach(trapFocus);

    document.getElementById('btn-new-game').addEventListener('click', newGame);
    document.getElementById('btn-avoid').addEventListener('click', avoidRoom);
    document.getElementById('btn-face').addEventListener('click', function() {
        if (gs.selectedCards.length >= CFG.ROOM_SIZE - 1) resolveCurrentRoom();
    });
    document.getElementById('btn-help').addEventListener('click', showHelp);
    document.getElementById('btn-help-close').addEventListener('click', hideHelp);
    document.getElementById('btn-settings').addEventListener('click', showSettings);
    document.getElementById('btn-settings-close').addEventListener('click', hideSettings);
    document.getElementById('overlay-settings').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) hideSettings();
    });

    // Settings toggles
    document.getElementById('toggle-sound').addEventListener('change', function() {
        var shouldMute = !this.checked;
        if (shouldMute !== SFX.isMuted()) {
            SFX.toggle();
            var btn = document.getElementById('btn-mute');
            btn.textContent = shouldMute ? '🔇' : '🔊';
            btn.setAttribute('aria-label', shouldMute ? 'Unmute sounds' : 'Mute sounds');
        }
    });
    document.getElementById('toggle-motion').addEventListener('change', function() {
        document.body.classList.toggle('reduce-motion', !this.checked);
        localStorage.setItem('scoundrel_motion', this.checked ? '1' : '0');
    });
    document.getElementById('btn-reset-data').addEventListener('click', function() {
        if (!confirm('Reset all scores and achievements? This cannot be undone.')) return;
        localStorage.removeItem('scoundrel_ach_v1');
        localStorage.removeItem('scoundrel_lb_v1');
        hideSettings();
        log('All scores and achievements cleared.', 'log-system');
    });

    document.getElementById('btn-leaderboard').addEventListener('click', Leaderboard.show);
    document.getElementById('btn-lb-close').addEventListener('click', Leaderboard.hide);
    document.getElementById('overlay-leaderboard').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) Leaderboard.hide();
    });
    document.getElementById('btn-achievements').addEventListener('click', function() {
        Achievements.renderOverlay();
        document.getElementById('overlay-achievements').hidden = false;
    });
    document.getElementById('btn-ach-close').addEventListener('click', function() {
        document.getElementById('overlay-achievements').hidden = true;
    });
    document.getElementById('overlay-achievements').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) document.getElementById('overlay-achievements').hidden = true;
    });
    document.getElementById('btn-mute').addEventListener('click', function() {
        var muted = SFX.toggle();
        BGM.toggle(); // mute/unmute music together
        this.textContent = muted ? '🔇' : '🔊';
        this.setAttribute('aria-label', muted ? 'Unmute sounds' : 'Mute sounds');
        // Keep settings toggles in sync
        var t = document.getElementById('toggle-sound');
        if (t) t.checked = !muted;
        var tm = document.getElementById('toggle-music');
        if (tm) tm.checked = !BGM.isMuted();
    });

    // Music toggle in settings
    var toggleMusic = document.getElementById('toggle-music');
    if (toggleMusic) {
        toggleMusic.addEventListener('change', function() {
            var shouldMute = !this.checked;
            if (shouldMute !== BGM.isMuted()) BGM.toggle();
        });
    }
    // SFX volume slider + live output
    var sliderSfx = document.getElementById('slider-sfx-vol');
    if (sliderSfx) {
        sliderSfx.addEventListener('input', function() {
            SFX.setVolume(Number(this.value) / 100);
            var out = document.getElementById('out-sfx-vol');
            if (out) out.value = this.value;
        });
    }
    // Music volume slider + live output
    var sliderMus = document.getElementById('slider-music-vol');
    if (sliderMus) {
        sliderMus.addEventListener('input', function() {
            BGM.setVolume(Number(this.value) / 100);
            var out = document.getElementById('out-music-vol');
            if (out) out.value = this.value;
        });
    }

    document.getElementById('btn-onboard-start').addEventListener('click', function() {
        hideOnboarding();
    });

    // Mobile: toggle HUD controls panel
    document.getElementById('btn-hud-toggle').addEventListener('click', function() {
        var controls = document.getElementById('hud-controls');
        var btn      = this;
        var isOpen   = controls.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(isOpen));
    });

    document.getElementById('overlay-help').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) hideHelp();
    });

    document.getElementById('btn-endgame-new').addEventListener('click', function() {
        hideEndGame(); newGame();
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
    var lbOpen      = !document.getElementById('overlay-leaderboard').hidden;
    var achOpen     = !document.getElementById('overlay-achievements').hidden;

    if (e.key === 'Escape') {
        if (helpOpen)    { hideHelp();             return; }
        if (endgameOpen) { hideEndGame();           return; }
        if (lbOpen)      { Leaderboard.hide();      return; }
        if (achOpen)     { document.getElementById('overlay-achievements').hidden = true; return; }
        if (!document.getElementById('overlay-settings').hidden) { hideSettings(); return; }
    }

    if (helpOpen || endgameOpen || lbOpen || achOpen) return;

    var key = e.key.toUpperCase();
    if (key === 'N') { e.preventDefault(); newGame();   return; }
    if (key === 'A') { e.preventDefault(); avoidRoom(); return; }
    if (key === 'H' || e.key === '?') { e.preventDefault(); showHelp(); return; }
    if (key === 'L') { e.preventDefault(); Leaderboard.show(); return; }
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

    // Restore motion preference
    var motionPref = localStorage.getItem('scoundrel_motion');
    if (motionPref === '0') document.body.classList.add('reduce-motion');

    var saved = loadGame();
    if (saved && !saved.isGameOver) {
        gs = saved;
        // Resume banner
        var banner = document.getElementById('resume-banner');
        if (banner) {
            banner.textContent = '↩ Run restored — Turn ' + (gs.turnCount || 1);
            banner.hidden = false;
            setTimeout(function() { banner.hidden = true; }, 3500);
        }
        log('Session restored. Continue your run.', 'log-system');
        // Start BGM once the user interacts (required by browser autoplay policy)
        document.addEventListener('click', function startBgmOnce() {
            if (!BGM.isPlaying()) BGM.start();
            document.removeEventListener('click', startBgmOnce);
        }, { once: true });
        render();
        requestAnimationFrame(function() {
            document.querySelectorAll('#room-grid .card-slot').forEach(function(slot) {
                slot.classList.add('is-flipped');
            });
        });
    } else {
        // Show onboarding only on very first visit
        if (!localStorage.getItem(ONBOARD_KEY)) {
            showOnboarding();
        } else {
            newGame();
        }
    }
}

init();
