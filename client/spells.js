import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

export const spells = [];

export class Spell {
    constructor({ name, range, cooldown, castTime = 0, channel = false, manaCost = 0, effect }) {
        this.name = name;
        this.range = range;
        this.cooldown = cooldown;
        this.castTime = castTime;
        this.channel = channel;
        this.manaCost = manaCost;
        this.effect = effect;
        this.lastCast = -Infinity;
    }

    canCast(currentTime) {
        return currentTime - this.lastCast >= this.cooldown;
    }

    cast(caster, currentTime) {
        if (!this.canCast(currentTime)) {
            console.log(`${this.name} is on cooldown.`);
            return false;
        }
        if (this.castTime > 0) {
            if (caster.currentlyCasting) {
                console.log(`${caster.type} is already casting.`);
                return false;
            }
            if (this.manaCost > 0 && caster.mana < this.manaCost) {
                console.log(`Not enough mana for ${this.name}`);
                return false;
            }
            caster.currentlyCasting = {
                spell: this,
                startTime: currentTime,
                castTime: this.castTime,
                channel: this.channel,
                manaCost: this.manaCost,
                lastManaRestoreTime: currentTime
            };
            console.log(`Started casting ${this.name} for ${caster.type} (${this.castTime} ms)`);
            return true;
        } else {
            if (this.manaCost > 0) {
                caster.mana -= this.manaCost;
            }
            this.lastCast = currentTime;
            this.effect(caster);
            console.log(`${this.name} cast instantly by ${caster.type}`);
            return true;
        }
    }
}

export function updateCasting(caster, currentTime) {
    if (caster.currentlyCasting) {
        const elapsed = currentTime - caster.currentlyCasting.startTime;
        if (caster.currentlyCasting.spell.name === "Innovation") {
            if (currentTime - caster.currentlyCasting.lastManaRestoreTime >= 1000) {
                let restoreAmount = caster.maxMana / 8;
                caster.mana = Math.min(caster.maxMana, caster.mana + restoreAmount);
                caster.currentlyCasting.lastManaRestoreTime = currentTime;
                console.log("Innovation: restored mana, current mana:", caster.mana);
            }
        }
        if (elapsed >= caster.currentlyCasting.castTime) {
            if (caster.currentlyCasting.spell.name !== "Innovation" && caster.currentlyCasting.manaCost > 0) {
                if (caster.mana >= caster.currentlyCasting.manaCost) {
                    caster.mana -= caster.currentlyCasting.manaCost;
                } else {
                    console.log(`Not enough mana to complete ${caster.currentlyCasting.spell.name}, cast canceled.`);
                    caster.currentlyCasting = null;
                    return;
                }
            }
            if (caster.currentlyCasting.spell.name === "Innovation") {
                caster.mana = caster.maxMana;
            }
            caster.currentlyCasting.spell.lastCast = currentTime;
            caster.currentlyCasting.spell.effect(caster);
            console.log(`${caster.currentlyCasting.spell.name} cast by ${caster.type} completed.`);
            if (caster.currentlyCasting.spell.name === "Innovation" && caster.innovationAura) {
                caster.mesh.remove(caster.innovationAura);
                caster.innovationAura = null;
            }
            caster.currentlyCasting = null;
        }
    }
}

// ---- Mage Spells ----

// Fireball: 2s cast; damage + DOT; homes in on target if selected.
export class FireballSpell extends Spell {
    constructor() {
        super({
            name: 'Fireball',
            range: 18,
            cooldown: 0,
            castTime: 2000,
            channel: false,
            manaCost: 20,
            effect: (caster) => {
                if (!caster.mesh) return;
                const geometry = new THREE.SphereGeometry(0.2, 8, 8);
                const material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                const fireball = new THREE.Mesh(geometry, material);
                fireball.position.copy(caster.mesh.position);
                // If there's a target, set it; otherwise, use default direction.
                if (window.currentTarget) {
                    fireball.userData.target = window.currentTarget;
                }
                fireball.userData.velocity = new THREE.Vector3(0, 0, -1).applyQuaternion(caster.mesh.quaternion).multiplyScalar(0.2);
                fireball.userData.damage = 10;
                fireball.userData.dot = 5;
                fireball.userData.dotDuration = 5000;
                fireball.userData.type = 'fireball';
                spells.push(fireball);
                if (typeof window.scene !== 'undefined') {
                    window.scene.add(fireball);
                }
            }
        });
    }
}

// Frost Bolt: 1.5s cast; damage + 30% slow for 8s; homes in on target if selected.
export class FrostBoltSpell extends Spell {
    constructor() {
        super({
            name: 'Frost Bolt',
            range: 18,
            cooldown: 2500,
            castTime: 1500,
            channel: false,
            manaCost: 15,
            effect: (caster) => {
                if (!caster.mesh) return;
                const geometry = new THREE.SphereGeometry(0.2, 8, 8);
                const material = new THREE.MeshStandardMaterial({ color: 0xadd8e6 });
                const frostbolt = new THREE.Mesh(geometry, material);
                frostbolt.position.copy(caster.mesh.position);
                if (window.currentTarget) {
                    frostbolt.userData.target = window.currentTarget;
                }
                frostbolt.userData.velocity = new THREE.Vector3(0, 0, -1).applyQuaternion(caster.mesh.quaternion).multiplyScalar(0.2);
                frostbolt.userData.damage = 8;
                frostbolt.userData.slowAmount = 0.3;
                frostbolt.userData.slowDuration = 8000;
                frostbolt.userData.type = 'frostbolt';
                spells.push(frostbolt);
                if (typeof window.scene !== 'undefined') {
                    window.scene.add(frostbolt);
                }
            }
        });
    }
}

// Frost Nova: Instant; AOE freeze for 8s.
export class FrostNovaSpell extends Spell {
    constructor() {
        super({
            name: 'Frost Nova',
            range: 30,
            cooldown: 5000,
            castTime: 0,
            channel: false,
            manaCost: 25,
            effect: (caster) => {
                if (!caster.mesh) return;
                const freezeRadius = 5;
                // Check if target is within freezeRadius:
                if (window.currentTarget && caster.mesh.position.distanceTo(window.currentTarget.position) <= freezeRadius) {
                    window.currentTarget.userData.freezeUntil = Date.now() + 8000;
                    window.currentTarget.material.color.set(0xadd8e6);
                    setTimeout(() => {
                        window.currentTarget.material.color.set(0xff0000);
                        window.currentTarget.userData.freezeUntil = null;
                    }, 8000);
                }
                // Create an expanding ring visual effect.
                const geometry = new THREE.RingGeometry(0.5, 0.6, 32);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xadd8e6, side: THREE.DoubleSide, transparent: true, opacity: 0.7
                });
                const ring = new THREE.Mesh(geometry, material);
                ring.position.copy(caster.mesh.position);
                ring.rotation.x = -Math.PI / 2;
                spells.push(ring);
                if (typeof window.scene !== 'undefined') {
                    window.scene.add(ring);
                }
                let scale = 1;
                const interval = setInterval(() => {
                    scale += 0.1;
                    ring.scale.set(scale, scale, scale);
                    if (scale > 3) {
                        clearInterval(interval);
                        if (typeof window.scene !== 'undefined') window.scene.remove(ring);
                    }
                }, 50);
            }
        });
    }
}

// Innovation: 8s channel; every second, restore maxMana/8; on completion, mana full.
export class InnovationSpell extends Spell {
    constructor() {
        super({
            name: 'Innovation',
            range: 0,
            cooldown: 12000,
            castTime: 8000,
            channel: true,
            manaCost: 0,
            effect: (caster) => {
                console.log('Innovation channel complete.');
            }
        });
    }

    cast(caster, currentTime) {
        if (!this.canCast(currentTime)) {
            console.log(`${this.name} is on cooldown.`);
            return false;
        }
        if (this.castTime > 0) {
            if (caster.currentlyCasting) {
                console.log(`${caster.type} is already casting.`);
                return false;
            }
            caster.currentlyCasting = {
                spell: this,
                startTime: currentTime,
                castTime: this.castTime,
                channel: this.channel,
                manaCost: this.manaCost,
                lastManaRestoreTime: currentTime
            };
            // Add an aura for visual feedback.
            const geometry = new THREE.SphereGeometry(1.5, 16, 16);
            const material = new THREE.MeshBasicMaterial({ color: 0x800080, transparent: true, opacity: 0.5 });
            const aura = new THREE.Mesh(geometry, material);
            aura.position.set(0, 0, 0);
            caster.mesh.add(aura);
            caster.innovationAura = aura;
            console.log(`Started casting ${this.name} for ${caster.type} (${this.castTime} ms)`);
            return true;
        } else {
            this.lastCast = currentTime;
            this.effect(caster);
            console.log(`${this.name} cast instantly by ${caster.type}`);
            return true;
        }
    }
}

// Sheep: 2s cast; if target selected, transform it to a small cube ("sheep") with random movement for 8s.
export class SheepSpell extends Spell {
    constructor() {
        super({
            name: 'Sheep',
            range: 18,
            cooldown: 10000,
            castTime: 2000,
            channel: false,
            manaCost: 30,
            effect: (caster) => {
                if (window.currentTarget) {
                    console.log('Sheep cast: target transformed into a sheep for 8 seconds.');

                    // Store original HP and add sheep status
                    const originalHP = window.currentTarget.userData.hp || 100;
                    window.currentTarget.userData.originalHP = originalHP;
                    window.currentTarget.userData.isSheeped = true;
                    window.currentTarget.userData.sheepStartTime = Date.now();
                    window.currentTarget.userData.sheepDuration = 8000;

                    // Visual transformation
                    window.currentTarget.scale.set(0.5, 0.5, 0.5);
                    window.currentTarget.material.color.set(0xffffff);
                    window.currentTarget.userData.sheepVelocity = new THREE.Vector3(
                        (Math.random() - 0.5) * 0.05,
                        0,
                        (Math.random() - 0.5) * 0.05
                    );

                    // Healing interval (5% per second)
                    const healingPercentage = 0.05; // 5% per second
                    const maxHP = window.currentTarget.userData.maxHp || 100;
                    const healingInterval = setInterval(() => {
                        // Check if still sheeped
                        if (!window.currentTarget || !window.currentTarget.userData.isSheeped) {
                            clearInterval(healingInterval);
                            return;
                        }

                        // Heal 5% of max health
                        const healAmount = maxHP * healingPercentage;
                        window.currentTarget.userData.hp = Math.min(
                            maxHP,
                            window.currentTarget.userData.hp + healAmount
                        );

                        console.log(`Sheep healing: +${healAmount.toFixed(1)} HP`);
                        // Use the global showPopup function if available
                        if (window.showPopup) {
                            window.showPopup(`Sheep healing: +${healAmount.toFixed(1)} HP`);
                        }

                        // Check if sheep duration has ended
                        const currentTime = Date.now();
                        if (currentTime > window.currentTarget.userData.sheepStartTime + window.currentTarget.userData.sheepDuration) {
                            clearInterval(healingInterval);
                        }
                    }, 1000); // Heal every second

                    // Remove sheep after duration
                    setTimeout(() => {
                        if (window.currentTarget && window.currentTarget.userData.isSheeped) {
                            clearSheepEffect(window.currentTarget);
                        }
                    }, 8000);
                } else {
                    console.log('Sheep cast: no target selected.');
                }
            }
        });
    }
}

// Helper function to clear sheep effect
function clearSheepEffect(target) {
    target.scale.set(1, 1, 1);
    target.material.color.set(0xff0000);
    target.userData.sheepVelocity = null;
    target.userData.isSheeped = false;
    console.log('Sheep effect removed.');
}

// Add a function to the global scope to be called when damage is applied
window.checkAndBreakSheepEffect = function (target, damageAmount) {
    if (target && target.userData.isSheeped) {
        console.log(`Sheep broken by ${damageAmount} damage!`);
        showPopup("Sheep broken by damage!");
        clearSheepEffect(target);
    }
};

// Character & Mage classes
export class Character {
    constructor(type, mesh = null) {
        this.type = type;
        this.hp = 100;
        this.maxHp = 100;
        this.mana = 100;
        this.maxMana = 100;
        this.spells = [];
        this.mesh = mesh || new THREE.Object3D();
        this.currentlyCasting = null;
    }

    castSpell(spellName, currentTime) {
        const spell = this.spells.find(s => s.name === spellName);
        if (spell) {
            return spell.cast(this, currentTime);
        } else {
            console.log(`Spell ${spellName} not available for ${this.type}`);
            return false;
        }
    }

    requiresTarget(spellName) {
        // These spells require a target
        const targetSpells = [
            'Fireball', 'Frost Bolt', 'Sheep',
            'Dual Attack', 'Slow Shot', 'Poison Shot',
            'Charge', 'Hamstring', 'Heroic Strike'
        ];

        // These spells do NOT require a target
        const nonTargetSpells = [
            'Frost Nova', 'Innovation', 'Feint Death',
            'Berserk', 'Thunderclap', 'Ice Trap',
        ];

        // If it's in nonTargetSpells, explicitly return false
        if (nonTargetSpells.includes(spellName)) {
            return false;
        }

        // Otherwise, check if it's in targetSpells
        return targetSpells.includes(spellName);
    }
}

export class Mage extends Character {
    constructor(mesh = null) {
        super('Mage', mesh);
        this.spells.push(new FireballSpell());
        this.spells.push(new FrostBoltSpell());
        this.spells.push(new FrostNovaSpell());
        this.spells.push(new InnovationSpell());
        this.spells.push(new SheepSpell());
    }
}

// ---- Hunter Spells ----

// Dual Attack: Uses bow for long range or axe for close combat
export class DualAttackSpell extends Spell {
    constructor() {
        super({
            name: 'Dual Attack',
            range: 18,
            cooldown: 3000,
            castTime: 0,
            channel: false,
            manaCost: 20,
            effect: (caster) => {
                if (!caster.mesh) return;
                const distance = caster.mesh.position.distanceTo(window.currentTarget.position);
                if (distance > 5) {
                    // Long range bow attack
                    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
                    const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
                    const projectile = new THREE.Mesh(geometry, material);
                    projectile.position.copy(caster.mesh.position);
                    projectile.userData = {
                        target: window.currentTarget,
                        damage: 15,
                        velocity: new THREE.Vector3(),
                        type: 'bowshot'
                    };
                    spells.push(projectile);
                    window.scene.add(projectile);
                } else {
                    // Close combat axe attack
                    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.1);
                    const material = new THREE.MeshBasicMaterial({ color: 0x808080 });
                    const axe = new THREE.Mesh(geometry, material);
                    axe.position.copy(caster.mesh.position);
                    window.scene.add(axe);
                    setTimeout(() => window.scene.remove(axe), 1000);
                }
            }
        });
    }
}

// Slow Shot: Slows target and deals damage
export class SlowShotSpell extends Spell {
    constructor() {
        super({
            name: 'Slow Shot',
            range: 18,
            cooldown: 5000,
            castTime: 0,
            channel: false,
            manaCost: 25,
            effect: (caster) => {
                if (!caster.mesh) return;
                const geometry = new THREE.SphereGeometry(0.2, 8, 8);
                const material = new THREE.MeshStandardMaterial({ color: 0x00ffff });
                const projectile = new THREE.Mesh(geometry, material);
                projectile.position.copy(caster.mesh.position);
                projectile.userData = {
                    target: window.currentTarget,
                    damage: 10,
                    velocity: new THREE.Vector3(),
                    type: 'slowshot',
                    slowAmount: 0.5,
                    slowDuration: 5000
                };
                spells.push(projectile);
                window.scene.add(projectile);
            }
        });
    }
}

// Poison Shot: Applies damage-over-time
export class PoisonShotSpell extends Spell {
    constructor() {
        super({
            name: 'Poison Shot',
            range: 18,
            cooldown: 8000,
            castTime: 0,
            channel: false,
            manaCost: 30,
            effect: (caster) => {
                if (!caster.mesh) return;
                const geometry = new THREE.SphereGeometry(0.2, 8, 8);
                const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
                const projectile = new THREE.Mesh(geometry, material);
                projectile.position.copy(caster.mesh.position);
                projectile.userData = {
                    target: window.currentTarget,
                    damage: 5,
                    velocity: new THREE.Vector3(),
                    type: 'poisonshot',
                    dot: 3,
                    dotDuration: 8000
                };
                spells.push(projectile);
                window.scene.add(projectile);
            }
        });
    }
}

// Feint Death: Makes hunter untargetable
export class FeintDeathSpell extends Spell {
    constructor() {
        super({
            name: 'Feint Death',
            range: 0,
            cooldown: 15000,
            castTime: 0,
            channel: false,
            manaCost: 40,
            effect: (caster) => {
                if (!caster.mesh) return;
                caster.mesh.material.transparent = true;
                caster.mesh.material.opacity = 0.3;
                const originalPosition = caster.mesh.position.clone();
                const checkMovement = setInterval(() => {
                    if (caster.mesh.position.distanceTo(originalPosition) > 0.1) {
                        caster.mesh.material.transparent = false;
                        caster.mesh.material.opacity = 1;
                        clearInterval(checkMovement);
                    }
                }, 100);
            }
        });
    }
}

// Ice Trap: Freezes target when triggered
export class IceTrapSpell extends Spell {
    constructor() {
        super({
            name: 'Ice Trap',
            range: 18,
            cooldown: 10000,
            castTime: 1000,
            channel: false,
            manaCost: 35,
            effect: (caster) => {
                if (!caster.mesh || !window.currentTarget) return;
                const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1);
                const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
                const trap = new THREE.Mesh(geometry, material);
                trap.position.copy(window.currentTarget.position);
                trap.userData.type = 'icetrap';
                spells.push(trap);
                window.scene.add(trap);
                setTimeout(() => {
                    window.scene.remove(trap);
                    spells.splice(spells.indexOf(trap), 1);
                }, 8000);
            }
        });
    }
}

// ---- Warrior Spells ----

// Charge: Stuns target after charging
export class ChargeSpell extends Spell {
    constructor() {
        super({
            name: 'Charge',
            range: 18,
            cooldown: 8000,
            castTime: 0,
            channel: false,
            manaCost: 20,
            effect: (caster) => {
                if (!caster.mesh || !window.currentTarget) return;
                const direction = new THREE.Vector3()
                    .subVectors(window.currentTarget.position, caster.mesh.position)
                    .normalize();
                caster.mesh.position.add(direction.multiplyScalar(5));
                window.currentTarget.userData.stunnedUntil = Date.now() + 2000;
                window.currentTarget.material.color.set(0xffff00);
                setTimeout(() => {
                    window.currentTarget.material.color.set(0xff0000);
                    window.currentTarget.userData.stunnedUntil = null;
                }, 2000);
            }
        });
    }
}

// Thunderclap: AOE damage and slow
export class ThunderclapSpell extends Spell {
    constructor() {
        super({
            name: 'Thunderclap',
            range: 5,
            cooldown: 10000,
            castTime: 1000,
            channel: false,
            manaCost: 30,
            effect: (caster) => {
                if (!caster.mesh) return;
                const geometry = new THREE.CylinderGeometry(2, 2, 0.1);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xffff00,
                    transparent: true,
                    opacity: 0.5
                });
                const thunder = new THREE.Mesh(geometry, material);
                thunder.position.copy(caster.mesh.position);
                thunder.userData.type = 'thunderclap';
                spells.push(thunder);
                window.scene.add(thunder);
                setTimeout(() => {
                    window.scene.remove(thunder);
                    spells.splice(spells.indexOf(thunder), 1);
                }, 3000);
            }
        });
    }
}

// Hamstring: Slows target and deals damage
export class HamstringSpell extends Spell {
    constructor() {
        super({
            name: 'Hamstring',
            range: 5,
            cooldown: 6000,
            castTime: 0,
            channel: false,
            manaCost: 25,
            effect: (caster) => {
                if (!caster.mesh || !window.currentTarget) return;
                const geometry = new THREE.SphereGeometry(1);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                    transparent: true,
                    opacity: 0.3
                });
                const hamstring = new THREE.Mesh(geometry, material);
                hamstring.position.copy(window.currentTarget.position);
                window.scene.add(hamstring);
                window.currentTarget.userData.slowUntil = Date.now() + 5000;
                window.currentTarget.userData.slowAmount = 0.5;
                setTimeout(() => {
                    window.scene.remove(hamstring);
                    window.currentTarget.userData.slowUntil = null;
                    window.currentTarget.userData.slowAmount = 1;
                }, 5000);
            }
        });
    }
}

// Berserk: Increases attack power and speed
export class BerserkSpell extends Spell {
    constructor() {
        super({
            name: 'Berserk',
            range: 0,
            cooldown: 15000,
            castTime: 0,
            channel: false,
            manaCost: 40,
            effect: (caster) => {
                if (!caster.mesh) return;
                caster.mesh.material.color.set(0xff0000);
                setTimeout(() => {
                    caster.mesh.material.color.set(0xe35050);
                }, 10000);
            }
        });
    }
}

// Heroic Strike: Deals significant damage
export class HeroicStrikeSpell extends Spell {
    constructor() {
        super({
            name: 'Heroic Strike',
            range: 5,
            cooldown: 5000,
            castTime: 1000,
            channel: false,
            manaCost: 35,
            effect: (caster) => {
                if (!caster.mesh || !window.currentTarget) return;
                const geometry = new THREE.BoxGeometry(1, 0.1, 1);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                    transparent: true,
                    opacity: 0.5
                });
                const strike = new THREE.Mesh(geometry, material);
                strike.position.copy(window.currentTarget.position);
                strike.userData.type = 'heroicstrike';
                spells.push(strike);
                window.scene.add(strike);
                setTimeout(() => {
                    window.scene.remove(strike);
                    spells.splice(spells.indexOf(strike), 1);
                }, 1000);
            }
        });
    }
}

// Update Hunter and Warrior classes to use the new spells
export class Hunter extends Character {
    constructor(mesh = null) {
        super('Hunter', mesh);
        this.spells.push(new DualAttackSpell());
        this.spells.push(new SlowShotSpell());
        this.spells.push(new PoisonShotSpell());
        this.spells.push(new FeintDeathSpell());
        this.spells.push(new IceTrapSpell());
    }
}

export class Warrior extends Character {
    constructor(mesh = null) {
        super('Warrior', mesh);
        this.spells.push(new ChargeSpell());
        this.spells.push(new ThunderclapSpell());
        this.spells.push(new HamstringSpell());
        this.spells.push(new BerserkSpell());
        this.spells.push(new HeroicStrikeSpell());
    }
}

// ------------------ UI FUNCTIONS ------------------
export function createUI() {
    // HP Bar (top left)
    const hpContainer = document.createElement('div');
    hpContainer.id = 'hpContainer';
    hpContainer.style.position = 'absolute';
    hpContainer.style.top = '10px';
    hpContainer.style.left = '10px';
    hpContainer.style.width = '200px';
    hpContainer.style.height = '20px';
    hpContainer.style.backgroundColor = '#555';
    hpContainer.style.border = '2px solid #fff';
    hpContainer.style.zIndex = '1000';
    document.body.appendChild(hpContainer);

    const hpBar = document.createElement('div');
    hpBar.id = 'hpBar';
    hpBar.style.height = '100%';
    hpBar.style.width = '100%';
    hpBar.style.backgroundColor = '#f00';
    hpContainer.appendChild(hpBar);

    // Mana Bar (below HP, top left)
    const manaContainer = document.createElement('div');
    manaContainer.id = 'manaContainer';
    manaContainer.style.position = 'absolute';
    manaContainer.style.top = '40px';
    manaContainer.style.left = '10px';
    manaContainer.style.width = '200px';
    manaContainer.style.height = '20px';
    manaContainer.style.backgroundColor = '#555';
    manaContainer.style.border = '2px solid #fff';
    manaContainer.style.zIndex = '1000';
    document.body.appendChild(manaContainer);

    const manaBar = document.createElement('div');
    manaBar.id = 'manaBar';
    manaBar.style.height = '100%';
    manaBar.style.width = '100%';
    manaBar.style.backgroundColor = '#00f';
    manaContainer.appendChild(manaBar);

    // Cast Bar (bottom center)
    const castContainer = document.createElement('div');
    castContainer.id = 'castContainer';
    castContainer.style.position = 'absolute';
    castContainer.style.bottom = '10px';
    castContainer.style.left = '50%';
    castContainer.style.transform = 'translateX(-50%)';
    castContainer.style.width = '300px';
    castContainer.style.height = '20px';
    castContainer.style.backgroundColor = '#333';
    castContainer.style.border = '2px solid #fff';
    castContainer.style.zIndex = '1000';
    document.body.appendChild(castContainer);

    const castBar = document.createElement('div');
    castBar.id = 'castBar';
    castBar.style.height = '100%';
    castBar.style.width = '0%';
    castBar.style.backgroundColor = '#ff0';
    castContainer.appendChild(castBar);

    // Spell Bar (under cast bar)
    const spellBarContainer = document.createElement('div');
    spellBarContainer.id = 'spellBarContainer';
    spellBarContainer.style.position = 'fixed';
    spellBarContainer.style.bottom = '40px';
    spellBarContainer.style.left = '50%';
    spellBarContainer.style.transform = 'translateX(-50%)';
    spellBarContainer.style.display = 'flex';
    spellBarContainer.style.gap = '10px';
    spellBarContainer.style.zIndex = '1000';
    document.body.appendChild(spellBarContainer);

    // Create spell buttons for current player
    if (window.currentPlayer && window.currentPlayer.spells) {
        console.log('Creating spell buttons for player:', window.currentPlayer.type);
        window.currentPlayer.spells.forEach((spell, index) => {
            const button = document.createElement('button');

            // Create spell container with name and key
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.style.width = '100%';
            container.style.height = '100%';

            // Add key number
            const keyNumber = document.createElement('div');
            keyNumber.textContent = index + 1;
            keyNumber.style.fontSize = '20px';
            keyNumber.style.fontWeight = 'bold';

            // Add spell name
            const spellName = document.createElement('div');
            spellName.textContent = spell.name;
            spellName.style.fontSize = '10px';
            spellName.style.marginTop = '2px';

            container.appendChild(keyNumber);
            container.appendChild(spellName);

            button.appendChild(container);
            button.style.width = '80px';
            button.style.height = '60px';
            button.style.border = '2px solid #fff';
            button.style.backgroundColor = '#333';
            button.style.color = 'white';
            button.style.cursor = 'pointer';
            button.style.padding = '5px';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.onclick = () => {
                if (!button.disabled) {
                    console.log('Casting spell:', spell.name);
                    window.currentPlayer.castSpell(spell.name, Date.now());
                }
            };
            spellBarContainer.appendChild(button);
        });
    } else {
        console.log('No current player or spells found');
    }
}

export function updateUI(character) {
    const hpBar = document.getElementById('hpBar');
    const manaBar = document.getElementById('manaBar');
    if (hpBar) {
        hpBar.style.width = (character.hp / character.maxHp * 100) + '%';
    }
    if (manaBar) {
        manaBar.style.width = (character.mana / character.maxMana * 100) + '%';
    }
}

export function updateCastBar(character, currentTime) {
    const castBar = document.getElementById('castBar');
    if (character.currentlyCasting && castBar) {
        const elapsed = currentTime - character.currentlyCasting.startTime;
        const percent = Math.min((elapsed / character.currentlyCasting.castTime) * 100, 100);
        castBar.style.width = percent + '%';
    } else if (castBar) {
        castBar.style.width = '0%';
    }
}

export function updateSpellBar(player, currentTime) {
    const container = document.getElementById('spellBarContainer');
    if (!container) return;

    const buttons = container.getElementsByTagName('button');
    for (let i = 0; i < buttons.length; i++) {
        const spell = player.spells[i];
        if (!spell) continue;

        const button = buttons[i];
        const cooldown = spell.cooldown;
        const lastCast = spell.lastCast || 0;
        const timeSinceLastCast = currentTime - lastCast;

        if (timeSinceLastCast < cooldown) {
            button.disabled = true;
            button.style.backgroundColor = '#666';

            // Update only the key number with cooldown
            const keyNumber = button.querySelector('div > div:first-child');
            if (keyNumber) {
                const remainingCooldown = Math.ceil((cooldown - timeSinceLastCast) / 1000);
                keyNumber.textContent = remainingCooldown;
            }
        } else {
            button.disabled = false;
            button.style.backgroundColor = '#333';

            // Reset the key number
            const keyNumber = button.querySelector('div > div:first-child');
            if (keyNumber) {
                keyNumber.textContent = i + 1;
            }
        }
    }
}

export function createTargetUI() {
    if (document.getElementById('targetContainer')) return;
    const targetContainer = document.createElement('div');
    targetContainer.id = 'targetContainer';
    targetContainer.style.position = 'absolute';
    targetContainer.style.top = '10px';
    targetContainer.style.left = '220px';
    targetContainer.style.width = '200px';
    targetContainer.style.height = '40px';
    targetContainer.style.backgroundColor = '#333';
    targetContainer.style.border = '2px solid #fff';
    targetContainer.style.zIndex = '1000';
    document.body.appendChild(targetContainer);

    const targetHp = document.createElement('div');
    targetHp.id = 'targetHp';
    targetHp.style.height = '20px';
    targetHp.style.width = '100%';
    targetHp.style.backgroundColor = '#f00';
    targetContainer.appendChild(targetHp);

    const targetMana = document.createElement('div');
    targetMana.id = 'targetMana';
    targetMana.style.height = '20px';
    targetMana.style.width = '100%';
    targetMana.style.backgroundColor = '#00f';
    targetContainer.appendChild(targetMana);
}

export function updateTargetUI(target) {
    const targetHp = document.getElementById('targetHp');
    const targetMana = document.getElementById('targetMana');
    if (targetHp && targetMana) {
        const hp = target.userData.hp || 100;
        const maxHp = target.userData.maxHp || 100;
        const mana = target.userData.mana || 100;
        const maxMana = target.userData.maxMana || 100;
        targetHp.style.width = (hp / maxHp * 100) + '%';
        targetMana.style.width = (mana / maxMana * 100) + '%';
    }
}


