/**
 * SCOUNDREL - Core Game Logic
 * Implements solo dungeon-crawl rules with persistent state.
 */

const GAME_CONFIG = {
    MAX_HEALTH: 20,
    ROOM_SIZE: 4,
    STORAGE_KEY: 'scoundrel_save_state'
};

let gameState = {
    health: GAME_CONFIG.MAX_HEALTH,
    deck: [],
    room: [],
    discard: [],
    equippedWeapon: null, // { value: number, lastDefeated: number|null }
    lastActionWasAvoid: false,
    potionsUsedInCurrentRoom: 0,
    isGameOver: false,
    stats: {
        monstersDefeated: 0,
        turnCount: 0
    }
};

// 1. DECK SETUP
function createDeck() {
    const suites = {
        MONSTER: ['♣', '♠'],
        WEAPON: ['♦'],
        POTION: ['♥']
    };
    
    let newDeck = [];

    // Monsters: 2-10, J(11), Q(12), K(13), A(14) of Spades/Clubs
    [...suites.MONSTER].forEach(suit => {
        for (let v = 2; v <= 14; v++) {
            newDeck.push({ suit, value: v, type: 'monster' });
        }
    });

    // Weapons: 2-10 of Diamonds
    for (let v = 2; v <= 10; v++) {
        newDeck.push({ suit: '♦', value: v, type: 'weapon' });
    }

    // Potions: 2-10 of Hearts
    for (let v = 2; v <= 10; v++) {
        newDeck.push({ suit: '♥', value: v, type: 'potion' });
    }

    return shuffle(newDeck);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 2. CORE GAME ACTIONS
function drawRoom() {
    if (gameState.isGameOver) return;

    // Carry forward the 4th card if it exists
    const carriedCard = gameState.room.length === 1 ? gameState.room[0] : null;
    gameState.room = [];
    
    if (carriedCard) gameState.room.push(carriedCard);

    while (gameState.room.length < GAME_CONFIG.ROOM_SIZE && gameState.deck.length > 0) {
        gameState.room.push(gameState.deck.pop());
    }

    gameState.potionsUsedInCurrentRoom = 0;
    gameState.stats.turnCount++;
    saveGame();
    render();
}

function avoidRoom() {
    if (gameState.lastActionWasAvoid || gameState.stats.turnCount <= 1) {
        logAction("Cannot avoid twice in a row!");
        return;
    }

    // Move room to bottom of deck
    gameState.deck = [...gameState.room, ...gameState.deck];
    gameState.room = [];
    gameState.lastActionWasAvoid = true;
    
    drawRoom();
}

function resolveCard(index) {
    const card = gameState.room[index];
    if (!card) return;

    let message = "";

    switch (card.type) {
        case 'weapon':
            gameState.equippedWeapon = { value: card.value, lastDefeated: null };
            message = `Equipped Weapon ♦${card.value}. Old stack discarded.`;
            break;

        case 'potion':
            if (gameState.potionsUsedInCurrentRoom === 0) {
                const oldHealth = gameState.health;
                gameState.health = Math.min(GAME_CONFIG.MAX_HEALTH, gameState.health + card.value);
                gameState.potionsUsedInCurrentRoom++;
                message = `Drank Potion ♥${card.value}. Healed ${gameState.health - oldHealth} HP.`;
            } else {
                message = `Potion ♥${card.value} discarded (Limit: 1 per room).`;
            }
            break;

        case 'monster':
            const damage = calculateMonsterDamage(card.value);
            gameState.health -= damage;
            
            if (gameState.equippedWeapon && card.value < (gameState.equippedWeapon.lastDefeated || 99)) {
                 gameState.equippedWeapon.lastDefeated = card.value;
            }

            message = damage > 0 
                ? `Fought Monster ${card.suit}${card.value}. Took ${damage} damage.` 
                : `Defeated Monster ${card.suit}${card.value} with weapon safely.`;
            break;
    }

    // Remove card from room
    gameState.room.splice(index, 1);
    gameState.lastActionWasAvoid = false;
    logAction(message);

    checkEndGame();
    
    // Auto-draw if 3 cards resolved
    if (gameState.room.length === 1 && !gameState.isGameOver) {
        drawRoom();
    }
    
    render();
    saveGame();
}

function calculateMonsterDamage(monsterValue) {
    if (!gameState.equippedWeapon) return monsterValue;

    // Non-increasing weapon rule
    const lastDefeated = gameState.equippedWeapon.lastDefeated;
    if (lastDefeated !== null && monsterValue >= lastDefeated) {
        logAction("Weapon too dull for this monster! Took full damage.");
        return monsterValue;
    }

    return Math.max(0, monsterValue - gameState.equippedWeapon.value);
}

// 3. PERSISTENCE & UI RENDERING
function saveGame() {
    localStorage.setItem(GAME_CONFIG.STORAGE_KEY, JSON.stringify(gameState));
}

function checkEndGame() {
    if (gameState.health <= 0) {
        gameState.isGameOver = true;
        const penalty = gameState.deck.reduce((acc, c) => acc + (c.type === 'monster' ? c.value : 0), 0);
        logAction(`GAME OVER. Final Score: -${penalty}`);
    } else if (gameState.deck.length === 0 && gameState.room.length === 0) {
        gameState.isGameOver = true;
        logAction(`VICTORY! Final Score: ${gameState.health}`);
    }
}

// Logic for rendering and HUD updates would go here...
// (Copilot will help you connect this to your index.html IDs)

function init() {
    gameState.deck = createDeck();
    drawRoom();
}

init();