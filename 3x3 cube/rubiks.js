// Constants for configuration
const CONFIG = {
    CUBE_SIZE: 0.95,
    ROTATION_SPEED: 0.15,
    COLORS: {
        RIGHT: 0xff4444, // Red
        LEFT: 0xff8800, // Orange
        UP: 0xffffff, // White
        DOWN: 0xffff00, // Yellow
        FRONT: 0x00ff00, // Green
        BACK: 0x0066ff // Blue
    },
    CAMERA: {
        FOV: 75,
        NEAR: 0.1,
        FAR: 1000,
        POSITION: [4, 4, 4]
    },
    LIGHTING: {
        AMBIENT: 0x404040,
        DIRECTIONAL: 0xffffff,
        RIM1: 0x4444ff,
        RIM2: 0xff4444
    }
};

// Global variables
let scene, camera, renderer;
let cubelets = [];
let isRotating = false;
let moves = [];
let moveCount = 0;
let scrambleHistory = [];
let moveHistory = [];
let solveStartTime = null;
let timerInterval = null;
let controls;

// Initialize the scene
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(
        CONFIG.CAMERA.FOV,
        window.innerWidth / window.innerHeight,
        CONFIG.CAMERA.NEAR,
        CONFIG.CAMERA.FAR
    );
    camera.position.set(...CONFIG.CAMERA.POSITION);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    setupLighting();
    createGroundPlane();
    createCube();
    setupControls();
    setupUI();
    animate();
    updateStatus('Ready');
}

// Setup lighting
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(CONFIG.LIGHTING.AMBIENT, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(CONFIG.LIGHTING.DIRECTIONAL, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(2048, 2048);
    scene.add(directionalLight);

    const rimLight1 = new THREE.DirectionalLight(CONFIG.LIGHTING.RIM1, 0.3);
    rimLight1.position.set(-10, -10, -5);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(CONFIG.LIGHTING.RIM2, 0.2);
    rimLight2.position.set(5, -10, 10);
    scene.add(rimLight2);
}

// Create a ground plane for shadows
function createGroundPlane() {
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -3;
    plane.receiveShadow = true;
    scene.add(plane);
}

// Create the Rubik's Cube
function createCube() {
    cubelets.forEach(cubelet => scene.remove(cubelet));
    cubelets = [];

    const geometry = new THREE.BoxGeometry(CONFIG.CUBE_SIZE, CONFIG.CUBE_SIZE, CONFIG.CUBE_SIZE);
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                if (x === 0 && y === 0 && z === 0) continue;

                const materials = [
                    new THREE.MeshLambertMaterial({ color: x === 1 ? CONFIG.COLORS.RIGHT : 0x000000 }),
                    new THREE.MeshLambertMaterial({ color: x === -1 ? CONFIG.COLORS.LEFT : 0x000000 }),
                    new THREE.MeshLambertMaterial({ color: y === 1 ? CONFIG.COLORS.UP : 0x000000 }),
                    new THREE.MeshLambertMaterial({ color: y === -1 ? CONFIG.COLORS.DOWN : 0x000000 }),
                    new THREE.MeshLambertMaterial({ color: z === 1 ? CONFIG.COLORS.FRONT : 0x000000 }),
                    new THREE.MeshLambertMaterial({ color: z === -1 ? CONFIG.COLORS.BACK : 0x000000 })
                ];

                const cubelet = new THREE.Mesh(geometry, materials);
                cubelet.position.set(x, y, z);
                cubelet.castShadow = true;
                cubelet.receiveShadow = true;

                const wireframe = new THREE.LineSegments(edgeGeometry, edgeMaterial);
                cubelet.add(wireframe);

                scene.add(cubelet);
                cubelets.push(cubelet);
            }
        }
    }
}

// Setup controls (keyboard, mouse, touch)
function setupControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 10;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', handleResize);
}

function handleKeydown(event) {
    if (isRotating) return;

    const movesMap = {
        'R': { axis: new THREE.Vector3(1, 0, 0), selector: c => Math.abs(c.position.x - 1) < 0.1 },
        'L': { axis: new THREE.Vector3(1, 0, 0), selector: c => Math.abs(c.position.x + 1) < 0.1 },
        'U': { axis: new THREE.Vector3(0, 1, 0), selector: c => Math.abs(c.position.y - 1) < 0.1 },
        'D': { axis: new THREE.Vector3(0, 1, 0), selector: c => Math.abs(c.position.y + 1) < 0.1 },
        'F': { axis: new THREE.Vector3(0, 0, 1), selector: c => Math.abs(c.position.z - 1) < 0.1 },
        'B': { axis: new THREE.Vector3(0, 0, 1), selector: c => Math.abs(c.position.z + 1) < 0.1 },
        'U': { key: 'undo', action: undoMove }
    };

    const move = movesMap[event.key.toUpperCase()];
    if (!move) return;

    if (move.key === 'undo') {
        move.action();
        return;
    }

    const clockwise = !event.shiftKey;
    const angle = clockwise ? Math.PI / 2 : -Math.PI / 2;
    const face = cubelets.filter(move.selector);

    if (face.length > 0) {
        startRotation(face, move.axis, angle, event.key.toUpperCase(), clockwise);
        moveHistory.push({ face: event.key.toUpperCase(), clockwise });
        updateMoveCount();
        playSound('rotate'); // Placeholder for sound effect
    }
}

function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start a face rotation
function startRotation(face, axis, targetAngle, faceKey, clockwise) {
    if (isRotating || face.length === 0) return;

    isRotating = true;
    updateStatus(`Rotating ${faceKey}${clockwise ? '' : "'"}...`);
    toggleButtons(true);

    const rotationGroup = new THREE.Group();
    face.forEach(cubelet => {
        scene.remove(cubelet);
        cubelet.userData.originalPosition = cubelet.position.clone();
        rotationGroup.add(cubelet);
    });

    scene.add(rotationGroup);
    moves.push({
        group: rotationGroup,
        axis: axis.clone(),
        targetAngle,
        currentAngle: 0,
        cubelets: face,
        faceKey,
        clockwise
    });
}

// Scramble the cube
function scrambleCube() {
    if (isRotating) return;

    const faceActions = [
        { key: 'R', axis: new THREE.Vector3(1, 0, 0), selector: c => Math.abs(c.position.x - 1) < 0.1 },
        { key: 'L', axis: new THREE.Vector3(1, 0, 0), selector: c => Math.abs(c.position.x + 1) < 0.1 },
        { key: 'U', axis: new THREE.Vector3(0, 1, 0), selector: c => Math.abs(c.position.y - 1) < 0.1 },
        { key: 'D', axis: new THREE.Vector3(0, 1, 0), selector: c => Math.abs(c.position.y + 1) < 0.1 },
        { key: 'F', axis: new THREE.Vector3(0, 0, 1), selector: c => Math.abs(c.position.z - 1) < 0.1 },
        { key: 'B', axis: new THREE.Vector3(0, 0, 1), selector: c => Math.abs(c.position.z + 1) < 0.1 }
    ];

    scrambleHistory = [];
    moveHistory = [];
    let scrambleMoves = 25;
    updateStatus('Scrambling...');
    startTimer();

    function performScramble() {
        if (scrambleMoves <= 0 || isRotating) {
            if (scrambleMoves > 0) {
                setTimeout(performScramble, 100);
            } else {
                updateStatus('Scrambled! Ready to solve');
                stopTimer();
            }
            return;
        }

        const faceAction = faceActions[Math.floor(Math.random() * faceActions.length)];
        const clockwise = Math.random() > 0.5;
        const angle = clockwise ? Math.PI / 2 : -Math.PI / 2;
        const face = cubelets.filter(faceAction.selector);

        if (face.length > 0) {
            scrambleHistory.push({ face: faceAction.key, clockwise });
            startRotation(face, faceAction.axis, angle, faceAction.key, clockwise);
            scrambleMoves--;
        }

        setTimeout(performScramble, 200);
    }

    moveCount = 0;
    updateMoveCount();
    performScramble();
}

// Reset the cube
function resetCube() {
    if (isRotating) return;

    moves.forEach(move => {
        move.group.children.forEach(cubelet => scene.remove(cubelet));
        scene.remove(move.group);
    });
    moves = [];
    isRotating = false;
    moveCount = 0;
    scrambleHistory = [];
    moveHistory = [];
    updateMoveCount();
    updateStatus('Reset complete');
    toggleButtons(false);
    stopTimer();
    createCube();
}

// Solve the cube (simple layer-by-layer placeholder)
function solveCube() {
    if (isRotating || scrambleHistory.length === 0) {
        updateStatus('Nothing to solve!');
        return;
    }

    updateStatus('Auto-solving...');
    startTimer();

    const solveMoves = scrambleHistory.slice().reverse();
    let solveIndex = 0;

    function performSolve() {
        if (solveIndex >= solveMoves.length || isRotating) {
            if (solveIndex < solveMoves.length) {
                setTimeout(performSolve, 100);
            } else {
                updateStatus('Solved! 🎉');
                scrambleHistory = [];
                moveHistory = [];
                stopTimer();
            }
            return;
        }

        const move = solveMoves[solveIndex];
        const faceActions = {
            'R': { axis: new THREE.Vector3(1, 0, 0), selector: c => Math.abs(c.position.x - 1) < 0.1 },
            'L': { axis: new THREE.Vector3(1, 0, 0), selector: c => Math.abs(c.position.x + 1) < 0.1 },
            'U': { axis: new THREE.Vector3(0, 1, 0), selector: c => Math.abs(c.position.y - 1) < 0.1 },
            'D': { axis: new THREE.Vector3(0, 1, 0), selector: c => Math.abs(c.position.y + 1) < 0.1 },
            'F': { axis: new THREE.Vector3(0, 0, 1), selector: c => Math.abs(c.position.z - 1) < 0.1 },
            'B': { axis: new THREE.Vector3(0, 0, 1), selector: c => Math.abs(c.position.z + 1) < 0.1 }
        };

        const faceAction = faceActions[move.face];
        const angle = move.clockwise ? -Math.PI / 2 : Math.PI / 2;
        const face = cubelets.filter(faceAction.selector);

        if (face.length > 0) {
            startRotation(face, faceAction.axis, angle, move.face, !move.clockwise);
            solveIndex++;
            updateMoveCount();
        }

        setTimeout(performSolve, 300);
    }

    performSolve();
}

// Undo the last move
function undoMove() {
    if (isRotating || moveHistory.length === 0) return;

    const lastMove = moveHistory.pop();
    const faceActions = {
        'R': { axis: new THREE.Vector3(1, 0, 0), selector: c => Math.abs(c.position.x - 1) < 0.1 },
        'L': { axis: new THREE.Vector3(1, 0, 0), selector: c => Math.abs(c.position.x + 1) < 0.1 },
        'U': { axis: new THREE.Vector3(0, 1, 0), selector: c => Math.abs(c.position.y - 1) < 0.1 },
        'D': { axis: new THREE.Vector3(0, 1, 0), selector: c => Math.abs(c.position.y + 1) < 0.1 },
        'F': { axis: new THREE.Vector3(0, 0, 1), selector: c => Math.abs(c.position.z - 1) < 0.1 },
        'B': { axis: new THREE.Vector3(0, 0, 1), selector: c => Math.abs(c.position.z + 1) < 0.1 }
    };

    const faceAction = faceActions[lastMove.face];
    const angle = lastMove.clockwise ? -Math.PI / 2 : Math.PI / 2;
    const face = cubelets.filter(faceAction.selector);

    if (face.length > 0) {
        startRotation(face, faceAction.axis, angle, lastMove.face, !lastMove.clockwise);
        moveCount--;
        updateMoveCount();
        updateStatus('Move undone');
    }
}

// Save cube state
function saveCubeState() {
    const state = cubelets.map(cubelet => ({
        position: cubelet.position.clone(),
        quaternion: cubelet.quaternion.clone()
    }));
    localStorage.setItem('cubeState', JSON.stringify(state));
    updateStatus('Cube state saved');
}

// Load cube state
function loadCubeState() {
    const state = JSON.parse(localStorage.getItem('cubeState'));
    if (!state) {
        updateStatus('No saved state found');
        return;
    }

    resetCube();
    cubelets.forEach((cubelet, index) => {
        cubelet.position.copy(state[index].position);
        cubelet.quaternion.copy(state[index].quaternion);
    });
    updateStatus('Cube state loaded');
}

// UI setup
function setupUI() {
    document.getElementById('scrambleBtn').addEventListener('click', scrambleCube);
    document.getElementById('solveBtn').addEventListener('click', solveCube);
    document.getElementById('resetBtn').addEventListener('click', resetCube);
    document.getElementById('saveBtn').addEventListener('click', saveCubeState);
    document.getElementById('loadBtn').addEventListener('click', loadCubeState);
    document.getElementById('helpBtn').addEventListener('click', toggleHelp);
}

// Timer functions
function startTimer() {
    solveStartTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
    solveStartTime = null;
    document.getElementById('timer').textContent = 'Time: 0.0s';
}

function updateTimer() {
    if (solveStartTime) {
        const elapsed = (Date.now() - solveStartTime) / 1000;
        document.getElementById('timer').textContent = `Time: ${elapsed.toFixed(1)}s`;
    }
}

// Update move count and history
function updateMoveCount() {
    document.getElementById('moveCount').textContent = `Moves: ${moveCount}`;
    document.getElementById('moveHistory').textContent = `History: ${moveHistory.map(m => m.face + (m.clockwise ? '' : "'")).join(' ')}`;
}

// Update status message
function updateStatus(status) {
    document.getElementById('status').textContent = status;
}

// Toggle UI buttons
function toggleButtons(disabled) {
    ['scrambleBtn', 'solveBtn', 'resetBtn', 'saveBtn', 'loadBtn'].forEach(id => {
        document.getElementById(id).disabled = disabled;
    });
}

// Toggle help instructions
function toggleHelp() {
    const instructions = document.getElementById('instructions');
    instructions.classList.toggle('hidden');
}

// Placeholder for sound effects
function playSound(type) {
    // Implement sound effects using Howler.js or similar
    console.log(`Playing sound: ${type}`);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (moves.length > 0) {
        const move = moves[0];
        const rotationStep = CONFIG.ROTATION_SPEED;
        const remainingAngle = move.targetAngle - move.currentAngle;
        const actualStep = Math.sign(remainingAngle) * Math.min(Math.abs(remainingAngle), rotationStep);

        move.group.rotateOnAxis(move.axis, actualStep);
        move.currentAngle += actualStep;

        if (Math.abs(move.currentAngle - move.targetAngle) < 0.001) {
            move.group.rotateOnAxis(move.axis, move.targetAngle - move.currentAngle);
            move.cubelets.forEach(cubelet => {
                const worldPosition = new THREE.Vector3();
                cubelet.getWorldPosition(worldPosition);
                move.group.remove(cubelet);
                scene.add(cubelet);
                cubelet.position.set(
                    Math.round(worldPosition.x * 100) / 100,
                    Math.round(worldPosition.y * 100) / 100,
                    Math.round(worldPosition.z * 100) / 100
                );
                cubelet.quaternion.multiplyQuaternions(move.group.quaternion, cubelet.quaternion);
            });

            scene.remove(move.group);
            moves.shift();

            if (moves.length === 0) {
                isRotating = false;
                updateStatus('Ready');
                toggleButtons(false);
            }
        }
    }

    controls.update();
    renderer.render(scene, camera);
}

// Start the application
init();
