/**
 * SCOUNDREL — Particle System
 * DOM-based particles driven by CSS custom property animations.
 * Usage: Particles.burst(x, y, type) | Particles.burstFromElement(el, type)
 */
'use strict';

var Particles = (function () {
    var container = null;

    var TYPE_COLORS = {
        damage:  ['#e74c3c', '#c0392b', '#ff6b6b', '#ff2200'],
        heal:    ['#2ecc71', '#27ae60', '#a8ff78', '#56ab2f'],
        equip:   ['#3498db', '#2980b9', '#56ccf2', '#74b9ff'],
        victory: ['#f5c842', '#f39c12', '#ffd700', '#fff', '#e17055'],
        avoid:   ['#f39c12', '#e67e22', '#fdcb6e'],
        flip:    ['#8891b8', '#4e5478', '#a29bfe'],
    };

    function getContainer() {
        if (!container) {
            container = document.createElement('div');
            container.id = 'particle-container';
            container.setAttribute('aria-hidden', 'true');
            document.body.appendChild(container);
        }
        return container;
    }

    function burst(x, y, type, count) {
        count = count || 12;
        var colors = TYPE_COLORS[type] || TYPE_COLORS.flip;
        var c      = getContainer();

        for (var i = 0; i < count; i++) {
            (function () {
                var p     = document.createElement('div');
                p.className = 'particle';
                var size  = 3 + Math.random() * 7;
                var angle = Math.random() * 360;
                var dist  = 28 + Math.random() * 64;
                var dx    = Math.cos(angle * Math.PI / 180) * dist;
                var dy    = Math.sin(angle * Math.PI / 180) * dist;
                var color = colors[Math.floor(Math.random() * colors.length)];
                var dur   = 380 + Math.random() * 280;
                var delay = Math.random() * 60;

                p.style.cssText = [
                    'left:' + (x - size / 2) + 'px',
                    'top:'  + (y - size / 2) + 'px',
                    'width:'  + size + 'px',
                    'height:' + size + 'px',
                    'background:' + color,
                    '--pdx:' + dx + 'px',
                    '--pdy:' + dy + 'px',
                    'animation-duration:' + dur + 'ms',
                    'animation-delay:' + delay + 'ms',
                ].join(';');

                c.appendChild(p);
                setTimeout(function () {
                    if (p.parentNode) p.parentNode.removeChild(p);
                }, dur + delay + 50);
            })();
        }
    }

    function burstFromElement(el, type, count) {
        if (!el) return;
        var rect = el.getBoundingClientRect();
        var x    = rect.left + rect.width  / 2;
        var y    = rect.top  + rect.height / 2;
        burst(x, y, type, count);
    }

    return { burst: burst, burstFromElement: burstFromElement };
})();
