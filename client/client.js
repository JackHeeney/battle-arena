import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';
import { io } from 'https://cdn.socket.io/4.4.1/socket.io.esm.min.js';
import { GameMenu } from './menu.js';
import {
    Mage,
    Hunter,
    Warrior,
    createUI,
    updateUI,
    updateCastBar,
    updateSpellBar,
    updateCasting,
    spells,
    createTargetUI,
    updateTargetUI
} from './spells.js';

// ------------------ HELPER: Popup Message ------------------
function showPopup(message) {
    const popup = document.createElement('div');
    popup.innerText = message;
    popup.style.position = 'absolute';
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.color = '#fff';
    popup.style.fontSize = '24px';
    popup.style.padding = '10px';
    popup.style.backgroundColor = 'rgba(0,0,0,0.7)';
    popup.style.borderRadius = '5px';
    popup.style.zIndex = '2000';
    document.body.appendChild(popup);
    let opacity = 1;
    let yOffset = 0;
    const interval = setInterval(() => {
        opacity -= 0.02;
        yOffset -= 1;
        popup.style.opacity = opacity;
        popup.style.transform = `translate(-50%, calc(-50% + ${yOffset}px))`;
        if (opacity <= 0) {
            clearInterval(interval);
            popup.remove();
        }
    }, 30);
}

// Make showPopup available globally
window.showPopup = showPopup;

// ------------------ HELPER: Check if Mage is Facing Target ------------------
function isFacingTarget(casterMesh, targetMesh) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(casterMesh.quaternion).normalize();
    const toTarget = new THREE.Vector3().subVectors(targetMesh.position, casterMesh.position).normalize();
    const angle = forward.angleTo(toTarget);
    return angle < Math.PI / 6; // within 30 degrees
}

// ------------------ SOCKET SETUP ------------------
const socket = io();
window.socket = socket;

// ------------------ MENU SETUP ------------------
const gameMenu = new GameMenu();
gameMenu.show();

// ------------------ SCENE SETUP ------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
window.scene = scene;
window.spells = spells;

// ------------------ CAMERA SETUP ------------------
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraOffsetDistance = 5;
const cameraHeightOffset = 2;

// ------------------ RENDERER ------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB);
document.body.appendChild(renderer.domElement);

// ------------------ GROUND & GRID ------------------
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const gridHelper = new THREE.GridHelper(100, 100);
scene.add(gridHelper);

// ------------------ LIGHTS ------------------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// ------------------ MAGE PLAYER ------------------
const mageGeometry = new THREE.BoxGeometry(1, 2, 1);
const mageMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const mageMesh = new THREE.Mesh(mageGeometry, mageMaterial);
mageMesh.position.set(0, 1, 0);
scene.add(mageMesh);

// Front Marker ("F")
function createFrontMarker() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.font = 'Bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('F', 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const markerGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const markerMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(0, 1, -0.51);
    return marker;
}
mageMesh.add(createFrontMarker());

// Initialize current player as Mage by default
window.currentPlayer = new Mage(mageMesh);
window.currentPlayer.class = 'Mage';

// ------------------ DUMMY ENEMY (with automatic movement) ------------------
const enemyGeometry = new THREE.BoxGeometry(1, 2, 1);
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const enemyMesh = new THREE.Mesh(enemyGeometry, enemyMaterial);
enemyMesh.position.set(5, 1, 0);
enemyMesh.userData = { hp: 100, maxHp: 100, mana: 100, maxMana: 100 };
// Set initial random velocity for dummy enemy
enemyMesh.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.05);
scene.add(enemyMesh);
let currentTarget = null;
window.currentTarget = currentTarget;

// ------------------ UI ------------------
createUI();

// ------------------ CAMERA & MANUAL OVERRIDE VARIABLES ------------------
let playerYaw = 0;       // Mage's facing angle (radians)
let cameraYaw = playerYaw;
let cameraPitch = 0;
const pitchLimit = Math.PI / 3;
let leftMouseDown = false;
let isDragging = false;
let manualCameraYaw = cameraYaw;
let manualCameraPitch = cameraPitch;

// Add at the top with other state variables
let canMove = true;
let countdown = 20;

// Add a global variable for camera positioning
let cameraFollowsPlayer = true;

// ------------------ MOUSE EVENTS (CAMERA & TARGET SELECTION) ------------------
document.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
        leftMouseDown = true;
        isDragging = false;
        manualCameraYaw = cameraYaw;
        manualCameraPitch = cameraPitch;
    }
});
document.addEventListener('mousemove', (event) => {
    if (leftMouseDown) {
        if (Math.abs(event.movementX) > 2 || Math.abs(event.movementY) > 2) {
            isDragging = true;
        }
        manualCameraYaw -= event.movementX * 0.002;
        manualCameraPitch += event.movementY * 0.002; // dragging up increases pitch
        manualCameraPitch = Math.max(-pitchLimit, Math.min(manualCameraPitch, pitchLimit));
    }
});
document.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
        leftMouseDown = false;
        if (!isDragging) { // Only select target if not dragging
            selectTarget(event);
        }
    }
});

// Extract target selection logic to reuse with Tab key
function selectTarget(event) {
    if (!canMove) return; // Only allow target selection after game starts

    // If it's a mouse event, use the mouse coordinates
    if (event instanceof MouseEvent) {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects([enemyMesh]);
        if (intersects.length > 0) {
            console.log("Enemy selected!");
            currentTarget = enemyMesh;
            window.currentTarget = currentTarget;
            createTargetUI();
            enemyMesh.material.emissive = new THREE.Color(0x00ffff);
            setTimeout(() => { enemyMesh.material.emissive = new THREE.Color(0x000000); }, 500);
        } else {
            currentTarget = null;
            window.currentTarget = null;
            const targetContainer = document.getElementById('targetContainer');
            if (targetContainer) targetContainer.remove();
        }
    } else {
        // Direct target selection (Tab key)
        console.log("Tab target selection");
        currentTarget = enemyMesh;
        window.currentTarget = currentTarget;
        createTargetUI();
        enemyMesh.material.emissive = new THREE.Color(0x00ffff);
        setTimeout(() => { enemyMesh.material.emissive = new THREE.Color(0x000000); }, 500);
    }
}

// ------------------ MOVEMENT (WASD) ------------------
const move = { forward: false, backward: false, left: false, right: false };
const moveSpeed = 0.1;

// Update the movement event handlers
document.addEventListener('keydown', (event) => {
    // Always register key presses, but only apply movement if canMove is true
    switch (event.code) {
        case 'KeyW': move.forward = true; break;
        case 'KeyS': move.backward = true; break;
        case 'KeyA': move.left = true; break;
        case 'KeyD': move.right = true; break;
        case 'Tab':
            event.preventDefault(); // Prevent tab from changing focus
            selectTarget(); // Tab targeting
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW': move.forward = false; break;
        case 'KeyS': move.backward = false; break;
        case 'KeyA': move.left = false; break;
        case 'KeyD': move.right = false; break;
    }
});

// ------------------ SPELL CASTING (Digits 1-5) ------------------
document.addEventListener('keydown', (event) => {
    if (!window.currentPlayer) return;

    const currentTime = Date.now();
    let spellIndex = -1;

    // Map key codes to spell indices
    if (event.code === 'Digit1' || event.code === 'Numpad1') spellIndex = 0;
    else if (event.code === 'Digit2' || event.code === 'Numpad2') spellIndex = 1;
    else if (event.code === 'Digit3' || event.code === 'Numpad3') spellIndex = 2;
    else if (event.code === 'Digit4' || event.code === 'Numpad4') spellIndex = 3;
    else if (event.code === 'Digit5' || event.code === 'Numpad5') spellIndex = 4;

    if (spellIndex >= 0 && spellIndex < window.currentPlayer.spells.length) {
        const spell = window.currentPlayer.spells[spellIndex];
        console.log('Attempting to cast spell:', spell.name);

        // For non-targeted spells, we don't need to check if canMove is true
        if (!window.currentPlayer.requiresTarget(spell.name)) {
            console.log('Casting non-targeted spell');
            window.currentPlayer.castSpell(spell.name, currentTime);
            return;
        }

        // For targeted spells, require canMove and proper targeting
        if (!canMove) {
            console.log('Cannot cast targeted spells yet, wait for countdown');
            showPopup("Cannot cast yet!");
            return;
        }

        // Check if spell requires target
        if (window.currentPlayer.requiresTarget(spell.name)) {
            if (!window.currentTarget) {
                showPopup("No target selected!");
                return;
            }
            if (!isFacingTarget(window.currentPlayer.mesh, window.currentTarget)) {
                showPopup("Not facing target!");
                return;
            }
        }

        window.currentPlayer.castSpell(spell.name, currentTime);
    }
});

// ------------------ WEBSOCKET EVENTS ------------------
socket.on('matchFound', (data) => {
    console.log('Match found event received:', data);

    // Initialize player based on selected class
    console.log('Initializing player for class:', data.class);
    initializePlayer(data.class);

    // Position the dummy enemy based on the selected class
    if (data.isDummyMatch) {
        console.log('Setting up dummy enemy with class:', data.dummyClass);
        enemyMesh.position.set(5, 1, 0);
        enemyMesh.userData.hp = 100;
        enemyMesh.userData.maxHp = 100;
        enemyMesh.userData.mana = 100;
        enemyMesh.userData.maxMana = 100;
        enemyMesh.material.color.set(0xff0000);
        enemyMesh.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.05);
        enemyMesh.userData.nextMoveTime = Date.now() + 2000;
        enemyMesh.userData.class = data.dummyClass;
    }

    // Remove existing UI elements
    const existingUI = document.getElementById('spellBarContainer');
    if (existingUI) {
        console.log('Removing existing UI');
        existingUI.remove();
    }

    // Recreate UI with new player's spells
    console.log('Creating new UI');
    createUI();

    // Show countdown UI
    console.log('Showing countdown');
    showCountdown();

    // Notify server that we're ready with game ID
    console.log('Notifying server we are ready');
    socket.emit('gameReady', { gameId: data.gameId });

    // Force enable movement and spells after 10 seconds, in case server doesn't respond
    setTimeout(() => {
        if (!canMove) {
            canMove = true;
            console.log('Force enabling movement after timeout');
            showPopup("Movement enabled!");

            // Update spell bar buttons
            const spellBarContainer = document.getElementById('spellBarContainer');
            if (spellBarContainer) {
                const buttons = spellBarContainer.getElementsByTagName('button');
                for (let button of buttons) {
                    button.disabled = false;
                    button.style.opacity = '1';
                }
            }
        }
    }, 10000);
});

socket.on('currentPlayers', (serverPlayers) => { });
socket.on('newPlayer', (data) => { });
socket.on('updatePlayer', (data) => { });
socket.on('removePlayer', (id) => { });
socket.on('spellCast', (data) => { });

// Update the countdown event handler
socket.on('countdownUpdate', (data) => {
    console.log('Countdown update:', data);
    countdown = data.countdown;
    canMove = data.canMove;
    updateCountdownUI();

    // Update spell bar buttons based on canMove
    const spellBarContainer = document.getElementById('spellBarContainer');
    if (spellBarContainer) {
        const buttons = spellBarContainer.getElementsByTagName('button');
        for (let button of buttons) {
            button.disabled = !canMove;
            button.style.opacity = canMove ? '1' : '0.5';
        }
    }
});

// Update the game start event handler
socket.on('gameStart', () => {
    console.log('Game started!');
    canMove = true;
    hideCountdownUI();

    // Force a message to ensure the player knows they can move
    showPopup("Game started! You can now move and cast spells!");

    // Update spell bar buttons
    const spellBarContainer = document.getElementById('spellBarContainer');
    if (spellBarContainer) {
        const buttons = spellBarContainer.getElementsByTagName('button');
        for (let button of buttons) {
            button.disabled = false;
            button.style.opacity = '1';
        }
    }
});

// ------------------ HELPER: Initialize Player ------------------
function initializePlayer(className) {
    console.log('Initializing player for class:', className); // Debug log

    // Remove existing player if any
    if (window.currentPlayer) {
        scene.remove(window.currentPlayer.mesh);
    }

    // Create new player based on class
    switch (className) {
        case 'Mage':
            const mageGeometry = new THREE.BoxGeometry(1, 2, 1);
            const mageMaterial = new THREE.MeshStandardMaterial({ color: 0x4a90e2 });
            const mageMesh = new THREE.Mesh(mageGeometry, mageMaterial);
            mageMesh.position.set(0, 1, 0);
            scene.add(mageMesh);
            mageMesh.add(createFrontMarker());
            window.currentPlayer = new Mage(mageMesh);
            window.currentPlayer.class = 'Mage';
            break;
        case 'Hunter':
            const hunterGeometry = new THREE.BoxGeometry(1, 2, 1);
            const hunterMaterial = new THREE.MeshStandardMaterial({ color: 0x50e3c2 });
            const hunterMesh = new THREE.Mesh(hunterGeometry, hunterMaterial);
            hunterMesh.position.set(0, 1, 0);
            scene.add(hunterMesh);
            hunterMesh.add(createFrontMarker());
            window.currentPlayer = new Hunter(hunterMesh);
            window.currentPlayer.class = 'Hunter';
            break;
        case 'Warrior':
            const warriorGeometry = new THREE.BoxGeometry(1, 2, 1);
            const warriorMaterial = new THREE.MeshStandardMaterial({ color: 0xe35050 });
            const warriorMesh = new THREE.Mesh(warriorGeometry, warriorMaterial);
            warriorMesh.position.set(0, 1, 0);
            scene.add(warriorMesh);
            warriorMesh.add(createFrontMarker());
            window.currentPlayer = new Warrior(warriorMesh);
            window.currentPlayer.class = 'Warrior';
            break;
    }

    console.log('Player initialized:', window.currentPlayer); // Debug log
}

// ------------------ HELPER: Linear Interpolation ------------------
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ------------------ ANIMATION LOOP ------------------
function animate() {
    requestAnimationFrame(animate);
    const currentTime = Date.now();

    // Always update player movement, regardless of canMove flag during development
    // Only update player movement if allowed
    if (window.currentPlayer && window.currentPlayer.mesh) {
        // Update player rotation (A/D keys rotate player)
        if (move.left) { playerYaw += 0.03; }
        if (move.right) { playerYaw -= 0.03; }
        window.currentPlayer.mesh.rotation.y = playerYaw;

        // Move player if canMove is true
        if (canMove) {
            const forwardVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
            if (move.forward) { window.currentPlayer.mesh.position.add(forwardVec.clone().multiplyScalar(moveSpeed)); }
            if (move.backward) { window.currentPlayer.mesh.position.add(forwardVec.clone().multiplyScalar(-moveSpeed)); }
        }
    }

    // Cancel cast if moving.
    if (window.currentPlayer && window.currentPlayer.currentlyCasting && (move.forward || move.backward || move.left || move.right)) {
        console.log("Cast canceled due to movement.");
        if (window.currentPlayer.currentlyCasting.spell.name === "Innovation" && window.currentPlayer.innovationAura) {
            window.currentPlayer.mesh.remove(window.currentPlayer.innovationAura);
            window.currentPlayer.innovationAura = null;
        }
        window.currentPlayer.currentlyCasting = null;
    }

    // ------------------ DUMMY ENEMY AUTO-MOVEMENT ------------------
    // Change dummy enemy's velocity randomly every 2 seconds.
    if (!enemyMesh.userData.nextMoveTime || currentTime > enemyMesh.userData.nextMoveTime) {
        enemyMesh.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.05,
            0,
            (Math.random() - 0.5) * 0.05
        );
        enemyMesh.userData.nextMoveTime = currentTime + 2000;
    }
    // If enemy is slowed or frozen, modify its velocity accordingly.
    if (enemyMesh.userData.freezeUntil && currentTime < enemyMesh.userData.freezeUntil) {
        // Frozen: no movement.
        enemyMesh.userData.velocity.set(0, 0, 0);
    } else if (enemyMesh.userData.slowUntil && currentTime < enemyMesh.userData.slowUntil) {
        enemyMesh.position.add(enemyMesh.userData.velocity.clone().multiplyScalar(0.3));
    } else {
        enemyMesh.position.add(enemyMesh.userData.velocity);
    }

    // ------------------ CAMERA CONTROL ------------------
    // If left mouse is held, use manual camera angles.
    // Otherwise, if movement keys are pressed, smoothly interpolate camera to default behind player.
    if (cameraFollowsPlayer && !leftMouseDown && (move.forward || move.backward || move.left || move.right)) {
        cameraYaw = lerp(cameraYaw, playerYaw, 0.1);
        cameraPitch = lerp(cameraPitch, 0, 0.1);
    } else if (leftMouseDown) {
        cameraFollowsPlayer = false;
        cameraYaw = manualCameraYaw;
        cameraPitch = manualCameraPitch;
    }
    // Otherwise, maintain current angles.

    // Position camera behind player
    if (window.currentPlayer && window.currentPlayer.mesh) {
        camera.position.x = window.currentPlayer.mesh.position.x + Math.sin(cameraYaw) * cameraOffsetDistance;
        camera.position.z = window.currentPlayer.mesh.position.z + Math.cos(cameraYaw) * cameraOffsetDistance;
        camera.position.y = window.currentPlayer.mesh.position.y + cameraHeightOffset + Math.sin(cameraPitch) * 2;
        camera.lookAt(
            window.currentPlayer.mesh.position.x,
            window.currentPlayer.mesh.position.y + 1,
            window.currentPlayer.mesh.position.z
        );
    }

    // ------------------ UI UPDATES ------------------
    if (window.currentPlayer) {
        updateUI(window.currentPlayer);
        updateCastBar(window.currentPlayer, currentTime);
        updateSpellBar(window.currentPlayer, currentTime);
        if (window.currentPlayer.currentlyCasting) {
            updateCasting(window.currentPlayer, currentTime);
        }
    }

    // ------------------ ACTIVE SPELLS UPDATE ------------------
    for (let i = spells.length - 1; i >= 0; i--) {
        const spellObj = spells[i];
        // Homing: if projectile has a target, adjust velocity toward it.
        if (spellObj.userData.target) {
            const direction = new THREE.Vector3().subVectors(spellObj.userData.target.position, spellObj.position).normalize();
            spellObj.userData.velocity.copy(direction.multiplyScalar(0.2));
        }
        if (spellObj.userData.velocity) {
            spellObj.position.add(spellObj.userData.velocity);
        }
        // Collision detection for offensive spells.
        if (spellObj.userData.target && spellObj.position.distanceTo(spellObj.userData.target.position) < 0.5) {
            if (spellObj.userData.type === 'fireball') {
                console.log("Fireball hit target!");
                const damage = spellObj.userData.damage;
                spellObj.userData.target.userData.hp -= damage;
                showPopup(`Fireball: -${damage} HP`);

                // Check if target is sheeped
                if (window.checkAndBreakSheepEffect) {
                    window.checkAndBreakSheepEffect(spellObj.userData.target, damage);
                }

                let dotTime = 0;
                const dotInterval = setInterval(() => {
                    dotTime += 1000;
                    const dotDamage = spellObj.userData.dot;
                    spellObj.userData.target.userData.hp -= dotDamage;
                    showPopup(`DOT: -${dotDamage} HP`);

                    // Check if target is sheeped (for DOT ticks)
                    if (window.checkAndBreakSheepEffect) {
                        window.checkAndBreakSheepEffect(spellObj.userData.target, dotDamage);
                    }

                    if (dotTime >= spellObj.userData.dotDuration) clearInterval(dotInterval);
                }, 1000);
                scene.remove(spellObj);
                spells.splice(i, 1);
                continue;
            }
            if (spellObj.userData.type === 'frostbolt') {
                console.log("Frost Bolt hit target!");
                const damage = spellObj.userData.damage;
                spellObj.userData.target.userData.hp -= damage;
                showPopup(`Frost Bolt: -${damage} HP`);

                // Check if target is sheeped
                if (window.checkAndBreakSheepEffect) {
                    window.checkAndBreakSheepEffect(spellObj.userData.target, damage);
                }

                spellObj.userData.target.userData.slowUntil = currentTime + 8000;
                spellObj.userData.target.material.color.set(0xadd8e6);
                setTimeout(() => {
                    spellObj.userData.target.material.color.set(0xff0000);
                    spellObj.userData.target.userData.slowUntil = null;
                }, 8000);
                scene.remove(spellObj);
                spells.splice(i, 1);
                continue;
            }
            if (spellObj.userData.type === 'frostnova') {
                console.log("Frost Nova hit target!");
                const damage = 3; // small damage
                spellObj.userData.target.userData.hp -= damage;

                // Check if target is sheeped
                if (window.checkAndBreakSheepEffect) {
                    window.checkAndBreakSheepEffect(spellObj.userData.target, damage);
                }

                spellObj.userData.target.userData.freezeUntil = currentTime + 8000;
                spellObj.userData.target.material.color.set(0xadd8e6);
                setTimeout(() => {
                    spellObj.userData.target.material.color.set(0xff0000);
                    spellObj.userData.target.userData.freezeUntil = null;
                }, 8000);
                scene.remove(spellObj);
                spells.splice(i, 1);
                continue;
            }
            // Hunter spells
            if (spellObj.userData.type === 'bowshot') {
                console.log("Bow shot hit target!");
                const damage = spellObj.userData.damage;
                spellObj.userData.target.userData.hp -= damage;
                showPopup(`Bow Shot: -${damage} HP`);

                // Check if target is sheeped
                if (window.checkAndBreakSheepEffect) {
                    window.checkAndBreakSheepEffect(spellObj.userData.target, damage);
                }

                scene.remove(spellObj);
                spells.splice(i, 1);
                continue;
            }
            if (spellObj.userData.type === 'slowshot') {
                console.log("Slow Shot hit target!");
                const damage = spellObj.userData.damage;
                spellObj.userData.target.userData.hp -= damage;
                showPopup(`Slow Shot: -${damage} HP`);

                // Check if target is sheeped
                if (window.checkAndBreakSheepEffect) {
                    window.checkAndBreakSheepEffect(spellObj.userData.target, damage);
                }

                spellObj.userData.target.userData.slowUntil = currentTime + spellObj.userData.slowDuration;
                spellObj.userData.target.userData.slowAmount = spellObj.userData.slowAmount;
                spellObj.userData.target.material.color.set(0x00ffff);
                setTimeout(() => {
                    spellObj.userData.target.material.color.set(0xff0000);
                    spellObj.userData.target.userData.slowUntil = null;
                    spellObj.userData.target.userData.slowAmount = 1;
                }, spellObj.userData.slowDuration);
                scene.remove(spellObj);
                spells.splice(i, 1);
                continue;
            }
            if (spellObj.userData.type === 'poisonshot') {
                console.log("Poison Shot hit target!");
                const damage = spellObj.userData.damage;
                spellObj.userData.target.userData.hp -= damage;
                showPopup(`Poison Shot: -${damage} HP`);

                // Check if target is sheeped
                if (window.checkAndBreakSheepEffect) {
                    window.checkAndBreakSheepEffect(spellObj.userData.target, damage);
                }

                let dotTime = 0;
                const dotInterval = setInterval(() => {
                    dotTime += 1000;
                    const dotDamage = spellObj.userData.dot;
                    spellObj.userData.target.userData.hp -= dotDamage;
                    showPopup(`Poison DOT: -${dotDamage} HP`);

                    // Check if target is sheeped (for DOT ticks)
                    if (window.checkAndBreakSheepEffect) {
                        window.checkAndBreakSheepEffect(spellObj.userData.target, dotDamage);
                    }

                    if (dotTime >= spellObj.userData.dotDuration) clearInterval(dotInterval);
                }, 1000);
                spellObj.userData.target.material.color.set(0x00ff00);
                setTimeout(() => {
                    spellObj.userData.target.material.color.set(0xff0000);
                }, spellObj.userData.dotDuration);
                scene.remove(spellObj);
                spells.splice(i, 1);
                continue;
            }
        }
        // Check for trap triggers
        if (spellObj.userData.type === 'icetrap' && spellObj.position.distanceTo(enemyMesh.position) < 1) {
            console.log("Ice Trap triggered!");
            enemyMesh.userData.freezeUntil = currentTime + 8000;
            enemyMesh.material.color.set(0x00ffff);
            setTimeout(() => {
                enemyMesh.material.color.set(0xff0000);
                enemyMesh.userData.freezeUntil = null;
            }, 8000);
            scene.remove(spellObj);
            spells.splice(i, 1);
            continue;
        }
        // Check for Thunderclap AOE
        if (spellObj.userData.type === 'thunderclap' && spellObj.position.distanceTo(enemyMesh.position) < 2) {
            console.log("Thunderclap hit target!");
            const damage = 20;
            enemyMesh.userData.hp -= damage;
            showPopup(`Thunderclap: -${damage} HP`);

            // Check if target is sheeped
            if (window.checkAndBreakSheepEffect) {
                window.checkAndBreakSheepEffect(enemyMesh, damage);
            }

            enemyMesh.userData.slowUntil = currentTime + 5000;
            enemyMesh.userData.slowAmount = 0.7;
            enemyMesh.material.color.set(0xffff00);
            setTimeout(() => {
                enemyMesh.material.color.set(0xff0000);
                enemyMesh.userData.slowUntil = null;
                enemyMesh.userData.slowAmount = 1;
            }, 5000);
            scene.remove(spellObj);
            spells.splice(i, 1);
            continue;
        }
        // Check for Heroic Strike
        if (spellObj.userData.type === 'heroicstrike' && spellObj.position.distanceTo(enemyMesh.position) < 1) {
            console.log("Heroic Strike hit target!");
            const damage = 30;
            enemyMesh.userData.hp -= damage;
            showPopup(`Heroic Strike: -${damage} HP`);

            // Check if target is sheeped
            if (window.checkAndBreakSheepEffect) {
                window.checkAndBreakSheepEffect(enemyMesh, damage);
            }

            scene.remove(spellObj);
            spells.splice(i, 1);
            continue;
        }
        if (spellObj.position.distanceTo(mageMesh.position) > 50) {
            scene.remove(spellObj);
            spells.splice(i, 1);
        }
    }

    // ------------------ TARGET UI UPDATE ------------------
    if (currentTarget) { updateTargetUI(currentTarget); }

    // ------------------ SEND MOVEMENT TO SERVER ------------------
    if (window.currentPlayer && window.currentPlayer.mesh) {
        socket.emit('playerMove', {
            x: window.currentPlayer.mesh.position.x,
            y: window.currentPlayer.mesh.position.y,
            z: window.currentPlayer.mesh.position.z,
            yaw: playerYaw
        });
    }

    renderer.render(scene, camera);
}

// Add these helper functions
function showCountdown() {
    const countdownContainer = document.createElement('div');
    countdownContainer.id = 'countdownContainer';
    countdownContainer.style.position = 'absolute';
    countdownContainer.style.left = '50%';
    countdownContainer.style.top = '50%';
    countdownContainer.style.transform = 'translate(-50%, -50%)';
    countdownContainer.style.color = '#fff';
    countdownContainer.style.fontSize = '48px';
    countdownContainer.style.fontWeight = 'bold';
    countdownContainer.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    countdownContainer.style.zIndex = '2000';
    document.body.appendChild(countdownContainer);
    updateCountdownUI();
}

function updateCountdownUI() {
    const countdownContainer = document.getElementById('countdownContainer');
    if (countdownContainer) {
        if (countdown > 5) {
            countdownContainer.textContent = `Prepare: ${countdown}s`;
        } else {
            countdownContainer.textContent = countdown;
        }
    }
}

function hideCountdownUI() {
    const countdownContainer = document.getElementById('countdownContainer');
    if (countdownContainer) {
        countdownContainer.remove();
    }
}

animate();
