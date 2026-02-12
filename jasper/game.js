/**
 * NINJA VS ZOMBIES
 * A 2D side-scrolling action game
 */

// ===== CONSTANTS & CONFIG =====
const CONFIG = {
    GRAVITY: 0.6,
    FRICTION: 0.8,
    PLAYER_SPEED: 5,
    JUMP_FORCE: -12,
    DASH_SPEED: 15,
    DASH_DURATION: 10,
    INVINCIBILITY_DURATION: 30,
    COMBO_TIMEOUT: 60,
    SCREEN_WIDTH: 800,
    SCREEN_HEIGHT: 450,
    GROUND_Y: 380,
    LEVEL_LENGTH: 3000,
    SPAWN_RATE: 120,
    MAX_COMBO: 50
};

const LEVEL_THEMES = [
    { name: 'Abandoned Temple', bg: '#1a1a2e', ground: '#2d2d44' },
    { name: 'Burning Village', bg: '#2e1a1a', ground: '#442d2d' },
    { name: 'Graveyard', bg: '#1a2e1a', ground: '#2d442d' },
    { name: 'Rooftops at Night', bg: '#0a0a1a', ground: '#1a1a2e' },
    { name: 'Underground Catacombs', bg: '#1a0a0a', ground: '#2d1a1a' }
];

// ===== UTILITY FUNCTIONS =====
const Utils = {
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
    lerp: (a, b, t) => a + (b - a) * t,
    distance: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    randomRange: (min, max) => Math.random() * (max - min) + min,
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    rectIntersect: (r1, r2) => !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y),
    formatTime: (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};

// ===== AUDIO SYSTEM =====
class AudioSystem {
    constructor() {
        this.ctx = null;
        this.sounds = {};
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.init();
    }

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not supported');
        }
    }

    playTone(freq, duration, type = 'square', volume = 0.3) {
        if (!this.ctx || !this.sfxEnabled) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playSound(name) {
        if (!this.sfxEnabled) return;
        
        const sounds = {
            punch: () => this.playTone(200, 0.1, 'square', 0.3),
            kick: () => this.playTone(150, 0.15, 'sawtooth', 0.4),
            jump: () => this.playTone(300, 0.2, 'sine', 0.2),
            hit: () => this.playTone(100, 0.1, 'sawtooth', 0.3),
            zombieHit: () => this.playTone(80, 0.1, 'square', 0.25),
            special: () => {
                this.playTone(400, 0.3, 'sawtooth', 0.3);
                setTimeout(() => this.playTone(600, 0.3, 'sawtooth', 0.3), 50);
            },
            dash: () => this.playTone(500, 0.15, 'sine', 0.2),
            block: () => this.playTone(250, 0.1, 'square', 0.2),
            zombieGroan: () => this.playTone(60, 0.3, 'sawtooth', 0.2),
            portal: () => {
                this.playTone(800, 0.5, 'sine', 0.2);
                setTimeout(() => this.playTone(1000, 0.5, 'sine', 0.2), 100);
            },
            gameOver: () => {
                this.playTone(200, 0.5, 'sawtooth', 0.3);
                setTimeout(() => this.playTone(150, 0.5, 'sawtooth', 0.3), 200);
                setTimeout(() => this.playTone(100, 1, 'sawtooth', 0.3), 400);
            },
            levelComplete: () => {
                this.playTone(400, 0.2, 'square', 0.3);
                setTimeout(() => this.playTone(500, 0.2, 'square', 0.3), 100);
                setTimeout(() => this.playTone(600, 0.2, 'square', 0.3), 200);
                setTimeout(() => this.playTone(800, 0.5, 'square', 0.3), 300);
            }
        };
        
        if (sounds[name]) sounds[name]();
    }
}

// ===== INPUT HANDLER =====
class InputHandler {
    constructor() {
        this.keys = {};
        this.joystick = { x: 0, y: 0, active: false };
        this.touchStart = { x: 0, y: 0 };
        this.joystickCenter = { x: 0, y: 0 };
        this.buttons = {
            jump: false,
            attack: false,
            kick: false,
            special: false,
            block: false,
            dash: false
        };
        this.tapCount = 0;
        this.lastTapTime = 0;
        
        this.setupKeyboard();
        this.setupTouch();
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            
            // Keyboard controls for desktop testing
            switch(e.key) {
                case 'ArrowLeft': case 'a': this.joystick.x = -1; break;
                case 'ArrowRight': case 'd': this.joystick.x = 1; break;
                case 'ArrowUp': case 'w': case ' ': this.buttons.jump = true; break;
                case 'z': case 'j': this.buttons.attack = true; break;
                case 'x': case 'k': this.buttons.kick = true; break;
                case 'c': case 'l': this.buttons.special = true; break;
                case 'Shift': this.buttons.dash = true; break;
                case 'Control': this.buttons.block = true; break;
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
            
            switch(e.key) {
                case 'ArrowLeft': case 'a': 
                case 'ArrowRight': case 'd': 
                    if (!this.keys['ArrowLeft'] && !this.keys['a'] && !this.keys['ArrowRight'] && !this.keys['d']) {
                        this.joystick.x = 0;
                    }
                    break;
                case 'ArrowUp': case 'w': case ' ': this.buttons.jump = false; break;
                case 'z': case 'j': this.buttons.attack = false; break;
                case 'x': case 'k': this.buttons.kick = false; break;
                case 'c': case 'l': this.buttons.special = false; break;
                case 'Shift': this.buttons.dash = false; break;
                case 'Control': this.buttons.block = false; break;
            }
        });
    }

    setupTouch() {
        const joystickZone = document.getElementById('joystick-zone');
        const joystickKnob = document.getElementById('joystick-knob');
        
        // Joystick handling
        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = joystickZone.getBoundingClientRect();
            this.joystickCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            this.joystick.active = true;
            this.updateJoystick(touch.clientX, touch.clientY, joystickKnob);
        }, { passive: false });
        
        joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.joystick.active) {
                const touch = e.touches[0];
                this.updateJoystick(touch.clientX, touch.clientY, joystickKnob);
            }
        }, { passive: false });
        
        joystickZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.joystick.active = false;
            this.joystick.x = 0;
            this.joystick.y = 0;
            joystickKnob.style.transform = 'translate(-50%, -50%)';
        });
        
        // Action buttons
        const setupButton = (id, buttonName) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.buttons[buttonName] = true;
                
                // Double tap detection for dash
                if (buttonName === 'attack') {
                    const now = Date.now();
                    if (now - this.lastTapTime < 300) {
                        this.tapCount++;
                        if (this.tapCount >= 2) {
                            this.buttons.dash = true;
                            this.tapCount = 0;
                        }
                    } else {
                        this.tapCount = 1;
                    }
                    this.lastTapTime = now;
                }
            }, { passive: false });
            
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.buttons[buttonName] = false;
                if (buttonName === 'attack') {
                    setTimeout(() => { this.buttons.dash = false; }, 100);
                }
            });
        };
        
        setupButton('btn-jump', 'jump');
        setupButton('btn-attack', 'attack');
        setupButton('btn-kick', 'kick');
        setupButton('btn-special', 'special');
        setupButton('btn-block', 'block');
        setupButton('btn-dash', 'dash');
    }

    updateJoystick(touchX, touchY, knob) {
        const maxDist = 35;
        const dx = touchX - this.joystickCenter.x;
        const dy = touchY - this.joystickCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);
        
        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;
        
        knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
        
        this.joystick.x = Math.cos(angle) * (clampedDist / maxDist);
        this.joystick.y = Math.sin(angle) * (clampedDist / maxDist);
    }

    isPressed(button) {
        return this.buttons[button];
    }

    getJoystickX() {
        return this.joystick.x;
    }
}

// ===== PARTICLE SYSTEM =====
class Particle {
    constructor(x, y, vx, vy, color, life, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // gravity
        this.life--;
    }

    draw(ctx, cameraX) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - cameraX, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

// ===== ENTITY BASE CLASS =====
class Entity {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1; // 1 = right, -1 = left
        this.grounded = false;
        this.dead = false;
        this.invincible = 0;
        this.animFrame = 0;
        this.animTimer = 0;
    }

    getBounds() {
        return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    updatePhysics() {
        this.vy += CONFIG.GRAVITY;
        this.vx *= CONFIG.FRICTION;
        
        this.x += this.vx;
        this.y += this.vy;
        
        // Ground collision
        if (this.y + this.h > CONFIG.GROUND_Y) {
            this.y = CONFIG.GROUND_Y - this.h;
            this.vy = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }
        
        if (this.invincible > 0) this.invincible--;
    }

    takeDamage(amount, knockbackX = 0) {
        if (this.invincible > 0) return false;
        
        this.health -= amount;
        this.vx = knockbackX;
        this.vy = -3;
        this.invincible = CONFIG.INVINCIBILITY_DURATION;
        
        if (this.health <= 0) {
            this.dead = true;
        }
        return true;
    }
}

// ===== PLAYER CLASS =====
class Player extends Entity {
    constructor(x, y) {
        super(x, y, 30, 50);
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.maxEnergy = 100;
        this.energy = this.maxEnergy;
        this.combo = 0;
        this.comboTimer = 0;
        
        // States
        this.state = 'idle'; // idle, walk, punch, kick, jump, hurt, block, dash
        this.punchCount = 0;
        this.punchTimer = 0;
        this.blocking = false;
        this.dashing = false;
        this.dashTimer = 0;
        
        // Attack hitboxes
        this.attackBox = null;
        this.attackTimer = 0;
    }

    update(input, game) {
        // Update state timers
        if (this.comboTimer > 0) this.comboTimer--;
        else this.combo = 0;
        
        if (this.punchTimer > 0) this.punchTimer--;
        if (this.attackTimer > 0) this.attackTimer--;
        if (this.dashTimer > 0) this.dashTimer--;
        
        // Energy regeneration
        if (this.energy < this.maxEnergy) this.energy += 0.2;
        
        // Handle dashing
        if (this.dashing) {
            this.vx = this.facing * CONFIG.DASH_SPEED;
            if (this.dashTimer <= 0) {
                this.dashing = false;
            }
            this.updatePhysics();
            return;
        }
        
        // Handle blocking
        this.blocking = input.isPressed('block') && this.grounded;
        if (this.blocking) {
            this.vx *= 0.5;
            this.state = 'block';
            this.updatePhysics();
            return;
        }
        
        // Movement
        const moveInput = input.getJoystickX();
        if (Math.abs(moveInput) > 0.1) {
            if (!this.dashing) {
                this.vx = moveInput * CONFIG.PLAYER_SPEED;
            }
            this.facing = moveInput > 0 ? 1 : -1;
            if (this.grounded && this.state !== 'punch' && this.state !== 'kick') {
                this.state = 'walk';
            }
        } else if (this.grounded && this.state !== 'punch' && this.state !== 'kick') {
            this.state = 'idle';
        }
        
        // Jump
        if (input.isPressed('jump') && this.grounded && this.state !== 'punch' && this.state !== 'kick') {
            this.vy = CONFIG.JUMP_FORCE;
            this.grounded = false;
            this.state = 'jump';
            game.audio.playSound('jump');
        }
        
        // Dash
        if (input.isPressed('dash') && !this.dashing && this.dashTimer <= 0) {
            this.dashing = true;
            this.dashTimer = CONFIG.DASH_DURATION;
            this.invincible = CONFIG.DASH_DURATION;
            game.audio.playSound('dash');
        }
        
        // Punch combo
        if (input.isPressed('attack') && this.attackTimer <= 0) {
            this.punch();
        }
        
        // Kick
        if (input.isPressed('kick') && this.grounded && this.attackTimer <= 0) {
            this.kick();
        }
        
        // Special attack
        if (input.isPressed('special') && this.energy >= 30 && this.attackTimer <= 0) {
            this.special(game);
        }
        
        // Jump kick
        if (input.isPressed('kick') && !this.grounded && this.attackTimer <= 0) {
            this.jumpKick();
        }
        
        // Clear attack box
        if (this.attackTimer <= 0) {
            this.attackBox = null;
        }
        
        this.updatePhysics();
        this.updateAnimation();
    }

    punch() {
        this.punchCount = (this.punchCount % 3) + 1;
        this.punchTimer = 20;
        this.attackTimer = 15;
        this.state = 'punch';
        
        // Create hitbox
        const reach = 40;
        this.attackBox = {
            x: this.facing > 0 ? this.x + this.w : this.x - reach,
            y: this.y + 10,
            w: reach,
            h: 30,
            damage: 10 + this.punchCount * 5,
            knockback: this.facing * 5
        };
        
        // Freeze briefly for impact
        this.vx *= 0.3;
    }

    kick() {
        this.attackTimer = 25;
        this.state = 'kick';
        
        const reach = 55;
        this.attackBox = {
            x: this.facing > 0 ? this.x + this.w : this.x - reach,
            y: this.y + 15,
            w: reach,
            h: 25,
            damage: 20,
            knockback: this.facing * 8
        };
    }

    jumpKick() {
        this.attackTimer = 20;
        this.state = 'kick';
        
        const reach = 50;
        this.attackBox = {
            x: this.facing > 0 ? this.x + this.w : this.x - reach,
            y: this.y + 10,
            w: reach,
            h: 35,
            damage: 15,
            knockback: this.facing * 6
        };
    }

    special(game) {
        this.energy -= 30;
        this.attackTimer = 30;
        this.state = 'punch';
        
        // AOE attack
        const reach = 80;
        this.attackBox = {
            x: this.facing > 0 ? this.x + this.w - 20 : this.x - reach + 20,
            y: this.y - 10,
            w: reach,
            h: 70,
            damage: 40,
            knockback: this.facing * 12
        };
        
        // Screen shake
        game.screenShake = 10;
        game.audio.playSound('special');
        
        // Particles
        for (let i = 0; i < 10; i++) {
            game.particles.push(new Particle(
                this.x + this.w / 2,
                this.y + this.h / 2,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                '#8844ff',
                30,
                4
            ));
        }
    }

    updateAnimation() {
        this.animTimer++;
        if (this.animTimer > 6) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }
    }

    addCombo() {
        this.combo++;
        this.combo = Math.min(this.combo, CONFIG.MAX_COMBO);
        this.comboTimer = CONFIG.COMBO_TIMEOUT;
        this.energy = Math.min(this.energy + 5, this.maxEnergy);
    }

    draw(ctx, cameraX) {
        const screenX = this.x - cameraX;
        
        // Invincibility flash
        if (this.invincible > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // Draw ninja body
        ctx.fillStyle = '#222';
        ctx.fillRect(screenX, this.y, this.w, this.h);
        
        // Head
        ctx.fillStyle = '#ffccaa';
        ctx.fillRect(screenX + 5, this.y, 20, 15);
        
        // Headband
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(screenX + 3, this.y + 3, 24, 4);
        
        // Headband tails (animated)
        const tailOffset = Math.sin(this.animTimer * 0.5) * 3;
        ctx.fillRect(
            screenX + (this.facing > 0 ? -5 : this.w + 5),
            this.y + 4,
            8,
            3
        );
        
        // Eyes
        ctx.fillStyle = '#000';
        if (this.facing > 0) {
            ctx.fillRect(screenX + 15, this.y + 6, 4, 4);
        } else {
            ctx.fillRect(screenX + 11, this.y + 6, 4, 4);
        }
        
        // Body outfit
        ctx.fillStyle = '#333';
        ctx.fillRect(screenX + 3, this.y + 15, 24, 25);
        
        // Belt
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(screenX + 3, this.y + 30, 24, 4);
        
        // Arms (animated based on state)
        ctx.fillStyle = '#222';
        if (this.state === 'punch' && this.attackTimer > 5) {
            // Punching arm extended
            if (this.facing > 0) {
                ctx.fillRect(screenX + 25, this.y + 18, 20, 8);
                ctx.fillRect(screenX + 5, this.y + 18, 8, 15);
            } else {
                ctx.fillRect(screenX - 15, this.y + 18, 20, 8);
                ctx.fillRect(screenX + 17, this.y + 18, 8, 15);
            }
        } else if (this.state === 'kick' && this.attackTimer > 5) {
            // Kicking leg extended
            ctx.fillRect(screenX + 5, this.y + 18, 8, 12);
            ctx.fillRect(screenX + 17, this.y + 18, 8, 12);
            if (this.facing > 0) {
                ctx.fillRect(screenX + 20, this.y + 38, 25, 8);
            } else {
                ctx.fillRect(screenX - 15, this.y + 38, 25, 8);
            }
        } else if (this.state === 'block') {
            // Blocking pose
            ctx.fillRect(screenX + (this.facing > 0 ? 20 : 0), this.y + 15, 10, 20);
            ctx.fillRect(screenX + (this.facing > 0 ? 0 : 20), this.y + 18, 8, 15);
        } else {
            // Normal arms
            const armOffset = Math.sin(this.animTimer * 0.3) * 2;
            ctx.fillRect(screenX + 5, this.y + 18 + armOffset, 8, 15);
            ctx.fillRect(screenX + 17, this.y + 18 - armOffset, 8, 15);
        }
        
        // Legs (animated when walking)
        ctx.fillStyle = '#222';
        if (this.state === 'walk') {
            const legOffset = Math.sin(this.animTimer * 0.8) * 5;
            ctx.fillRect(screenX + 5, this.y + 38, 8, 12 + legOffset);
            ctx.fillRect(screenX + 17, this.y + 38, 8, 12 - legOffset);
        } else if (this.state === 'kick' && this.attackTimer > 5) {
            // One leg on ground
            ctx.fillRect(screenX + (this.facing > 0 ? 5 : 17), this.y + 38, 8, 12);
        } else {
            ctx.fillRect(screenX + 5, this.y + 38, 8, 12);
            ctx.fillRect(screenX + 17, this.y + 38, 8, 12);
        }
        
        // Attack hitbox debug (optional)
        // if (this.attackBox) {
        //     ctx.strokeStyle = '#0f0';
        //     ctx.strokeRect(this.attackBox.x - cameraX, this.attackBox.y, this.attackBox.w, this.attackBox.h);
        // }
        
        ctx.globalAlpha = 1;
    }
}

// ===== ZOMBIE BASE CLASS =====
class Zombie extends Entity {
    constructor(x, y, type = 'basic') {
        super(x, y, 30, 50);
        this.type = type;
        this.setupType();
        this.attackCooldown = 0;
        this.detectRange = 200;
        this.attackRange = 40;
        this.state = 'idle';
    }

    setupType() {
        switch(this.type) {
            case 'basic':
                this.maxHealth = 30;
                this.speed = 0.8;
                this.damage = 10;
                this.color = '#4a4';
                break;
            case 'fast':
                this.maxHealth = 20;
                this.speed = 2.5;
                this.damage = 8;
                this.color = '#6c6';
                this.w = 25;
                this.h = 40;
                this.y += 10;
                break;
            case 'tank':
                this.maxHealth = 80;
                this.speed = 0.4;
                this.damage = 20;
                this.color = '#2a2';
                this.w = 40;
                this.h = 55;
                break;
            case 'ranged':
                this.maxHealth = 25;
                this.speed = 1;
                this.damage = 15;
                this.color = '#8a8';
                this.attackRange = 150;
                break;
        }
        this.health = this.maxHealth;
    }

    update(player, game) {
        if (this.dead) return;
        
        if (this.attackCooldown > 0) this.attackCooldown--;
        
        const distToPlayer = player.x - this.x;
        const absDist = Math.abs(distToPlayer);
        
        // AI behavior
        if (absDist < this.detectRange) {
            if (absDist > this.attackRange) {
                // Move toward player
                this.facing = distToPlayer > 0 ? 1 : -1;
                this.vx = this.facing * this.speed;
                this.state = 'walk';
            } else if (this.attackCooldown <= 0) {
                // Attack
                this.attack(player, game);
            } else {
                this.vx *= 0.5;
                this.state = 'idle';
            }
        } else {
            this.vx *= 0.5;
            this.state = 'idle';
        }
        
        // Ranged zombie behavior
        if (this.type === 'ranged' && absDist < this.attackRange && this.attackCooldown <= 0) {
            this.rangedAttack(game, player);
        }
        
        this.updatePhysics();
        this.updateAnimation();
    }

    attack(player, game) {
        this.attackCooldown = 60;
        this.state = 'attack';
        
        // Check hit
        const hitbox = {
            x: this.facing > 0 ? this.x + this.w : this.x - 30,
            y: this.y,
            w: 30,
            h: 40
        };
        
        if (Utils.rectIntersect(hitbox, player.getBounds())) {
            let damage = this.damage;
            if (player.blocking) {
                damage = Math.floor(damage * 0.3);
                game.audio.playSound('block');
            }
            if (player.takeDamage(damage, this.facing * 3)) {
                game.audio.playSound('hit');
                game.screenShake = 5;
                
                // Blood particles
                for (let i = 0; i < 5; i++) {
                    game.particles.push(new Particle(
                        player.x + player.w / 2,
                        player.y + player.h / 2,
                        (Math.random() - 0.5) * 5,
                        (Math.random() - 0.5) * 5,
                        '#f00',
                        20,
                        3
                    ));
                }
            }
        }
    }

    rangedAttack(game, player) {
        this.attackCooldown = 90;
        this.state = 'attack';
        
        // Spawn projectile
        game.projectiles.push(new Projectile(
            this.x + this.w / 2,
            this.y + 10,
            this.facing * 4,
            0,
            this.damage,
            'enemy'
        ));
    }

    takeDamage(amount, knockbackX = 0) {
        const result = super.takeDamage(amount, knockbackX);
        if (result) {
            this.state = 'hurt';
        }
        return result;
    }

    updateAnimation() {
        this.animTimer++;
        if (this.animTimer > 8) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }
    }

    draw(ctx, cameraX) {
        const screenX = this.x - cameraX;
        
        if (this.invincible > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // Body
        ctx.fillStyle = this.color;
        ctx.fillRect(screenX, this.y, this.w, this.h);
        
        // Head
        ctx.fillStyle = '#8f8';
        ctx.fillRect(screenX + 3, this.y, this.w - 6, 15);
        
        // Eyes
        ctx.fillStyle = '#f00';
        if (this.facing > 0) {
            ctx.fillRect(screenX + this.w - 10, this.y + 5, 4, 4);
        } else {
            ctx.fillRect(screenX + 6, this.y + 5, 4, 4);
        }
        
        // Mouth
        ctx.fillStyle = '#400';
        ctx.fillRect(screenX + 8, this.y + 10, this.w - 16, 3);
        
        // Ripped clothes
        ctx.fillStyle = '#363';
        ctx.fillRect(screenX + 3, this.y + 15, this.w - 6, 20);
        
        // Arms
        ctx.fillStyle = this.color;
        const armOffset = this.state === 'walk' ? Math.sin(this.animTimer * 0.3) * 3 : 0;
        ctx.fillRect(screenX - 3, this.y + 18 + armOffset, 6, 15);
        ctx.fillRect(screenX + this.w - 3, this.y + 18 - armOffset, 6, 15);
        
        // Legs
        const legOffset = this.state === 'walk' ? Math.sin(this.animTimer * 0.5) * 4 : 0;
        ctx.fillRect(screenX + 5, this.y + 35, 8, 15 + legOffset);
        ctx.fillRect(screenX + this.w - 13, this.y + 35, 8, 15 - legOffset);
        
        // Health bar
        const hpPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX, this.y - 10, this.w, 5);
        ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
        ctx.fillRect(screenX + 1, this.y - 9, (this.w - 2) * hpPercent, 3);
        
        ctx.globalAlpha = 1;
    }
}

// ===== BOSS CLASS =====
class Boss extends Zombie {
    constructor(x, y) {
        super(x, y, 'boss');
        this.w = 60;
        this.h = 80;
        this.maxHealth = 300;
        this.health = this.maxHealth;
        this.speed = 0.6;
        this.damage = 25;
        this.color = '#484';
        this.phase = 1;
        this.specialCooldown = 0;
    }

    update(player, game) {
        if (this.dead) return;
        
        // Phase transition
        const hpPercent = this.health / this.maxHealth;
        if (hpPercent < 0.5 && this.phase === 1) {
            this.phase = 2;
            this.speed = 1;
            this.attackCooldown = 0;
        }
        
        if (this.specialCooldown > 0) this.specialCooldown--;
        
        super.update(player, game);
        
        // Special attack
        if (this.specialCooldown <= 0 && Math.abs(player.x - this.x) < 100) {
            this.groundSmash(game, player);
        }
    }

    groundSmash(game, player) {
        this.specialCooldown = 180;
        
        // AOE damage
        const dist = Math.abs(player.x - this.x);
        if (dist < 120) {
            player.takeDamage(20, (player.x > this.x ? 1 : -1) * 8);
            game.audio.playSound('hit');
            game.screenShake = 15;
        }
        
        // Spawn particles
        for (let i = 0; i < 20; i++) {
            game.particles.push(new Particle(
                this.x + this.w / 2,
                this.y + this.h,
                (Math.random() - 0.5) * 10,
                -Math.random() * 5,
                '#664',
                40,
                5
            ));
        }
        
        // Spawn minions in phase 2
        if (this.phase === 2) {
            game.enemies.push(new Zombie(this.x - 50, CONFIG.GROUND_Y - 50, 'basic'));
            game.enemies.push(new Zombie(this.x + this.w + 50, CONFIG.GROUND_Y - 50, 'basic'));
        }
    }

    draw(ctx, cameraX) {
        const screenX = this.x - cameraX;
        
        // Boss is larger
        ctx.fillStyle = this.color;
        ctx.fillRect(screenX, this.y, this.w, this.h);
        
        // Head
        ctx.fillStyle = '#6a6';
        ctx.fillRect(screenX + 5, this.y, this.w - 10, 25);
        
        // Glowing eyes
        ctx.fillStyle = this.phase === 2 ? '#f80' : '#f00';
        ctx.fillRect(screenX + 10, this.y + 8, 10, 8);
        ctx.fillRect(screenX + this.w - 20, this.y + 8, 10, 8);
        
        // Spikes on back
        ctx.fillStyle = '#262';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(screenX, this.y + 20 + i * 15);
            ctx.lineTo(screenX - 10, this.y + 25 + i * 15);
            ctx.lineTo(screenX, this.y + 30 + i * 15);
            ctx.fill();
        }
        
        // Body armor
        ctx.fillStyle = '#333';
        ctx.fillRect(screenX + 5, this.y + 25, this.w - 10, 30);
        
        // Health bar (larger)
        const hpPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX, this.y - 15, this.w, 8);
        ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
        ctx.fillRect(screenX + 1, this.y - 14, (this.w - 2) * hpPercent, 6);
        
        // Phase indicator
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText(`PHASE ${this.phase}`, screenX, this.y - 20);
    }
}

// ===== PROJECTILE CLASS =====
class Projectile {
    constructor(x, y, vx, vy, damage, owner) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.owner = owner; // 'player' or 'enemy'
        this.w = 10;
        this.h = 6;
        this.dead = false;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Gravity for some projectiles
        if (this.owner === 'enemy') {
            this.vy += 0.1;
        }
    }

    draw(ctx, cameraX) {
        ctx.fillStyle = this.owner === 'player' ? '#88f' : '#8f8';
        ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
    }
}

// ===== PORTAL CLASS =====
class Portal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 60;
        this.h = 80;
        this.active = false;
        this.pulse = 0;
    }

    update() {
        this.pulse += 0.1;
    }

    draw(ctx, cameraX) {
        const screenX = this.x - cameraX;
        const pulseScale = 1 + Math.sin(this.pulse) * 0.1;
        
        // Glow effect
        const gradient = ctx.createRadialGradient(
            screenX + this.w / 2, this.y + this.h / 2, 0,
            screenX + this.w / 2, this.y + this.h / 2, this.w * pulseScale
        );
        gradient.addColorStop(0, 'rgba(136, 68, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(136, 68, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(136, 68, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(screenX - this.w, this.y - this.h, this.w * 3, this.h * 3);
        
        // Portal oval
        ctx.fillStyle = '#84f';
        ctx.beginPath();
        ctx.ellipse(
            screenX + this.w / 2,
            this.y + this.h / 2,
            this.w / 2 * pulseScale,
            this.h / 2 * pulseScale,
            0, 0, Math.PI * 2
        );
        ctx.fill();
        
        // Inner swirl
        ctx.strokeStyle = '#caf';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const angle = this.pulse + (i * Math.PI * 2 / 3);
            const rx = Math.cos(angle) * this.w / 3;
            const ry = Math.sin(angle) * this.h / 3;
            ctx.moveTo(screenX + this.w / 2, this.y + this.h / 2);
            ctx.lineTo(screenX + this.w / 2 + rx, this.y + this.h / 2 + ry);
        }
        ctx.stroke();
    }
}

// ===== GAME CLASS =====
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        this.audio = new AudioSystem();
        this.input = new InputHandler();
        
        this.state = 'menu'; // menu, playing, paused, gameover, complete
        this.gameMode = 'story'; // story, survival, timeattack
        
        this.reset();
        this.setupUI();
        this.loop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.scale = Math.min(this.canvas.width / CONFIG.SCREEN_WIDTH, this.canvas.height / CONFIG.SCREEN_HEIGHT);
    }

    reset() {
        this.player = new Player(100, CONFIG.GROUND_Y - 50);
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.portal = null;
        
        this.cameraX = 0;
        this.level = 1;
        this.score = 0;
        this.kills = 0;
        this.maxCombo = 0;
        this.startTime = 0;
        this.elapsedTime = 0;
        
        this.spawnTimer = 0;
        this.enemiesToSpawn = 10;
        this.enemiesSpawned = 0;
        this.bossSpawned = false;
        
        this.screenShake = 0;
        this.flashEffect = 0;
        
        this.theme = LEVEL_THEMES[0];
    }

    setupUI() {
        // Menu buttons
        document.getElementById('btn-story').addEventListener('click', () => this.startGame('story'));
        document.getElementById('btn-survival').addEventListener('click', () => this.startGame('survival'));
        document.getElementById('btn-timeattack').addEventListener('click', () => this.startGame('timeattack'));
        document.getElementById('btn-help').addEventListener('click', () => this.showHelp());
        document.getElementById('btn-help-back').addEventListener('click', () => this.showMenu());
        document.getElementById('btn-next-level').addEventListener('click', () => this.nextLevel());
        document.getElementById('btn-main-menu-complete').addEventListener('click', () => this.showMenu());
        document.getElementById('btn-retry').addEventListener('click', () => this.restart());
        document.getElementById('btn-main-menu-over').addEventListener('click', () => this.showMenu());
        document.getElementById('btn-resume').addEventListener('click', () => this.resume());
        document.getElementById('btn-pause-menu').addEventListener('click', () => this.showMenu());
        document.getElementById('btn-pause').addEventListener('click', () => this.pause());
        
        window.addEventListener('resize', () => this.resize());
    }

    startGame(mode) {
        this.gameMode = mode;
        this.reset();
        this.state = 'playing';
        this.startTime = Date.now();
        
        // Resume audio context
        if (this.audio.ctx && this.audio.ctx.state === 'suspended') {
            this.audio.ctx.resume();
        }
        
        this.hideAllMenus();
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('controls').classList.remove('hidden');
        document.getElementById('btn-pause').classList.remove('hidden');
        
        this.updateLevelIndicator();
    }

    showHelp() {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('help-screen').classList.remove('hidden');
    }

    showMenu() {
        this.state = 'menu';
        this.hideAllMenus();
        document.getElementById('main-menu').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('controls').classList.add('hidden');
        document.getElementById('btn-pause').classList.add('hidden');
    }

    hideAllMenus() {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('help-screen').classList.add('hidden');
        document.getElementById('level-complete').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');
        document.getElementById('pause-menu').classList.add('hidden');
    }

    pause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            document.getElementById('pause-menu').classList.remove('hidden');
        }
    }

    resume() {
        if (this.state === 'paused') {
            this.state = 'playing';
            document.getElementById('pause-menu').classList.add('hidden');
            this.startTime = Date.now() - this.elapsedTime * 1000;
        }
    }

    restart() {
        this.startGame(this.gameMode);
    }

    nextLevel() {
        this.level++;
        this.player.x = 100;
        this.player.health = Math.min(this.player.health + 30, this.player.maxHealth);
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.portal = null;
        this.enemiesSpawned = 0;
        this.bossSpawned = false;
        this.enemiesToSpawn = 10 + this.level * 3;
        this.spawnTimer = 0;
        this.cameraX = 0;
        
        this.theme = LEVEL_THEMES[(this.level - 1) % LEVEL_THEMES.length];
        
        this.state = 'playing';
        this.hideAllMenus();
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('controls').classList.remove('hidden');
        document.getElementById('btn-pause').classList.remove('hidden');
        
        this.updateLevelIndicator();
    }

    updateLevelIndicator() {
        const levelNames = ['Abandoned Temple', 'Burning Village', 'Graveyard', 'Rooftops', 'Catacombs'];
        document.getElementById('level-indicator').textContent = 
            `LEVEL ${this.level} - ${levelNames[(this.level - 1) % levelNames.length]}`;
    }

    spawnEnemy() {
        if (this.enemiesSpawned >= this.enemiesToSpawn) return;
        
        const types = ['basic', 'basic', 'fast'];
        if (this.level > 1) types.push('tank');
        if (this.level > 2) types.push('ranged');
        
        const type = types[Math.floor(Math.random() * types.length)];
        const spawnRight = Math.random() > 0.5;
        const x = spawnRight ? 
            this.player.x + 400 + Math.random() * 200 : 
            Math.max(50, this.player.x - 400 - Math.random() * 200);
        
        this.enemies.push(new Zombie(x, CONFIG.GROUND_Y - 50, type));
        this.enemiesSpawned++;
    }

    spawnBoss() {
        this.bossSpawned = true;
        this.enemies.push(new Boss(this.player.x + 500, CONFIG.GROUND_Y - 80));
    }

    update() {
        if (this.state !== 'playing') return;
        
        this.elapsedTime = (Date.now() - this.startTime) / 1000;
        
        // Screen shake decay
        if (this.screenShake > 0) this.screenShake *= 0.9;
        if (this.screenShake < 0.5) this.screenShake = 0;
        
        // Update player
        this.player.update(this.input, this);
        
        // Update camera
        const targetCameraX = this.player.x - this.canvas.width / 3;
        this.cameraX = Utils.lerp(this.cameraX, targetCameraX, 0.1);
        this.cameraX = Utils.clamp(this.cameraX, 0, CONFIG.LEVEL_LENGTH - this.canvas.width);
        
        // Spawn enemies
        if (this.spawnTimer-- <= 0 && this.enemiesSpawned < this.enemiesToSpawn) {
            this.spawnEnemy();
            this.spawnTimer = CONFIG.SPAWN_RATE - Math.min(this.level * 10, 60);
        }
        
        // Spawn boss
        if (this.enemiesSpawned >= this.enemiesToSpawn && !this.bossSpawned && this.level % 3 === 0) {
            if (this.enemies.length === 0) {
                this.spawnBoss();
            }
        }
        
        // Activate portal when all enemies defeated
        if (this.enemiesSpawned >= this.enemiesToSpawn && this.enemies.length === 0 && !this.portal && !this.bossSpawned) {
            this.portal = new Portal(CONFIG.LEVEL_LENGTH - 150, CONFIG.GROUND_Y - 80);
            this.audio.playSound('portal');
        }
        
        // Update portal
        if (this.portal) {
            this.portal.update();
            
            // Check portal entry
            if (Utils.rectIntersect(this.player.getBounds(), this.portal)) {
                this.levelComplete();
            }
        }
        
        // Update enemies
        this.enemies = this.enemies.filter(e => {
            if (!e.dead) {
                e.update(this.player, this);
                
                // Check player attack hitting enemy
                if (this.player.attackBox && Utils.rectIntersect(this.player.attackBox, e.getBounds())) {
                    if (e.takeDamage(this.player.attackBox.damage, this.player.attackBox.knockback)) {
                        this.audio.playSound('zombieHit');
                        this.screenShake = 3;
                        this.player.addCombo();
                        this.score += 100 * this.player.combo;
                        this.maxCombo = Math.max(this.maxCombo, this.player.combo);
                        
                        // Blood particles
                        for (let i = 0; i < 8; i++) {
                            this.particles.push(new Particle(
                                e.x + e.w / 2,
                                e.y + e.h / 2,
                                (Math.random() - 0.5) * 6,
                                (Math.random() - 0.5) * 6,
                                '#4a4',
                                25,
                                4
                            ));
                        }
                    }
                }
                
                return true;
            } else {
                this.kills++;
                this.score += 50;
                
                // Death particles
                for (let i = 0; i < 15; i++) {
                    this.particles.push(new Particle(
                        e.x + e.w / 2,
                        e.y + e.h / 2,
                        (Math.random() - 0.5) * 8,
                        (Math.random() - 0.5) * 8,
                        '#2a2',
                        40,
                        5
                    ));
                }
                
                return false;
            }
        });
        
        // Update projectiles
        this.projectiles = this.projectiles.filter(p => {
            p.update();
            
            // Check collision with player
            if (p.owner === 'enemy' && Utils.rectIntersect(p.getBounds ? p.getBounds() : {x: p.x, y: p.y, w: p.w, h: p.h}, this.player.getBounds())) {
                if (this.player.takeDamage(p.damage, p.vx > 0 ? 3 : -3)) {
                    this.audio.playSound('hit');
                }
                return false;
            }
            
            // Remove if off screen
            return p.x > this.cameraX - 100 && p.x < this.cameraX + this.canvas.width + 100;
        });
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.update();
            return p.life > 0;
        });
        
        // Check game over
        if (this.player.dead) {
            this.gameOver();
        }
        
        // Update HUD
        this.updateHUD();
    }

    updateHUD() {
        const hpPercent = (this.player.health / this.player.maxHealth) * 100;
        const energyPercent = (this.player.energy / this.player.energy) * 100;
        
        document.getElementById('health-bar').style.width = `${Math.max(0, hpPercent)}%`;
        document.getElementById('energy-bar').style.width = `${Math.max(0, energyPercent)}%`;
        document.getElementById('score').textContent = this.score;
        document.getElementById('combo').textContent = this.player.combo;
    }

    levelComplete() {
        this.state = 'complete';
        this.audio.playSound('levelComplete');
        
        const timeStr = Utils.formatTime(this.elapsedTime);
        const rank = this.calculateRank();
        
        document.getElementById('stat-time').textContent = timeStr;
        document.getElementById('stat-kills').textContent = this.kills;
        document.getElementById('stat-combo').textContent = this.maxCombo;
        document.getElementById('stat-score').textContent = this.score;
        document.getElementById('stat-rank').textContent = rank;
        
        document.getElementById('level-complete').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('controls').classList.add('hidden');
        document.getElementById('btn-pause').classList.add('hidden');
    }

    calculateRank() {
        const scorePerLevel = 2000 * this.level;
        const ratio = this.score / scorePerLevel;
        if (ratio >= 1.5) return 'S';
        if (ratio >= 1.2) return 'A';
        if (ratio >= 0.8) return 'B';
        return 'C';
    }

    gameOver() {
        this.state = 'gameover';
        this.audio.playSound('gameOver');
        
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-kills').textContent = this.kills;
        
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('controls').classList.add('hidden');
        document.getElementById('btn-pause').classList.add('hidden');
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = this.theme.bg;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply screen shake
        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
        }
        
        this.ctx.save();
        this.ctx.translate(shakeX, shakeY);
        
        // Draw parallax background
        this.drawBackground();
        
        // Draw ground
        this.ctx.fillStyle = this.theme.ground;
        this.ctx.fillRect(0, CONFIG.GROUND_Y, this.canvas.width, this.canvas.height - CONFIG.GROUND_Y);
        
        // Draw ground details
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for (let i = 0; i < 20; i++) {
            const x = ((i * 100) - Math.floor(this.cameraX * 0.5)) % (this.canvas.width + 100);
            const drawX = x < -50 ? x + this.canvas.width + 100 : x;
            this.ctx.fillRect(drawX, CONFIG.GROUND_Y + 10, 30, 5);
        }
        
        // Draw portal
        if (this.portal) {
            this.portal.draw(this.ctx, this.cameraX);
        }
        
        // Draw entities
        this.player.draw(this.ctx, this.cameraX);
        
        this.enemies.forEach(e => e.draw(this.ctx, this.cameraX));
        this.projectiles.forEach(p => p.draw(this.ctx, this.cameraX));
        this.particles.forEach(p => p.draw(this.ctx, this.cameraX));
        
        // Draw player attack box for debug
        // if (this.player.attackBox) {
        //     this.ctx.strokeStyle = '#0f0';
        //     this.ctx.strokeRect(
        //         this.player.attackBox.x - this.cameraX,
        //         this.player.attackBox.y,
        //         this.player.attackBox.w,
        //         this.player.attackBox.h
        //     );
        // }
        
        this.ctx.restore();
    }

    drawBackground() {
        // Stars/ambient particles
        this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (let i = 0; i < 30; i++) {
            const x = ((i * 73) - Math.floor(this.cameraX * 0.1)) % this.canvas.width;
            const drawX = x < 0 ? x + this.canvas.width : x;
            const y = (i * 37) % (CONFIG.GROUND_Y - 50);
            this.ctx.fillRect(drawX, y, 2, 2);
        }
        
        // Distant mountains/buildings
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let i = 0; i < 10; i++) {
            const x = ((i * 200) - Math.floor(this.cameraX * 0.3)) % (this.canvas.width + 100);
            const drawX = x < -100 ? x + this.canvas.width + 100 : x;
            const h = 50 + (i * 17) % 80;
            this.ctx.fillRect(drawX, CONFIG.GROUND_Y - h, 120, h);
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// Start game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
