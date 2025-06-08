let scene, camera, renderer;
let cubelets = [];
let isRotating = false;
let rotationSpeed = 0.15;
let moves = [];
let moveCount = 0;
let scrambleHistory = [];
let helpVisible = true;

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    
    // Camera setup with better positioning
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);

    // Renderer setup with better quality
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Add some rim lighting for better visual appeal
    const rimLight1 = new THREE.DirectionalLight(0x4444ff, 0.3);
    rimLight1.position.set(-10, -10, -5);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0xff4444, 0.2);
    rimLight2.position.set(5, -10, 10);
    scene.add(rimLight2);

    createCube();
    setupControls();
    animate();
    updateStatus('Ready');
}

function createCube() {
    cubelets.forEach(cubelet => scene.remove(cubelet));
    cubelets = [];

    const colors = [
        0xff4444, // Red - Right (R)
        0xff8800, // Orange - Left (L)  
        0xffffff, // White - Up (U)
        0xffff00, // Yellow - Down (D)
        0x00ff00, // Green - Front (F)
        0x0066ff  // Blue - Back (B)
    ];

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                if (x === 0 && y === 0 && z === 0) continue;

                const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
                
                // Create materials for each face
                const materials = [
                    new THREE.MeshLambertMaterial({ 
                        color: x === 1 ? colors[0] : 0x000000 
                    }), // Right
                    new THREE.MeshLambertMaterial({ 
                        color: x === -1 ? colors[1] : 0x000000 
                    }), // Left
                    new THREE.MeshLambertMaterial({ 
                        color: y === 1 ? colors[2] : 0x000000 
                    }), // Up
                    new THREE.MeshLambertMaterial({ 
                        color: y === -1 ? colors[3] : 0x000000 
                    }), // Down
                    new THREE.MeshLambertMaterial({ 
                        color: z === 1 ? colors[4] : 0x000000 
                    }), // Front
                    new THREE.MeshLambertMaterial({ 
                        color: z === -1 ? colors[5] : 0x000000 
                    }) // Back
                ];

                const cubelet = new THREE.Mesh(geometry, materials);
                cubelet.position.set(x, y, z);
                cubelet.castShadow = true;
                cubelet.receiveShadow = true;
                
                // Add black edges
                const edges = new THREE.EdgesGeometry(geometry);
                const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
                const wireframe = new THREE.LineSegments(edges, edgeMaterial);
                cubelet.add(wireframe);
                
                scene.add(cubelet);
                cubelets.push(cubelet);
            }
        }
    }
}

function setupControls() {
    // Keyboard controls
    window.addEventListener('keydown', (event) => {
        if (isRotating) return;

        let axis, angle, face;
        const shift = event.shiftKey;
        const clockwise = !shift;

        switch (event.key.toUpperCase()) {
            case 'R':
                axis = new THREE.Vector3(1, 0, 0);
                angle = clockwise ? Math.PI / 2 : -Math.PI / 2;
                face = cubelets.filter(c => Math.abs(c.position.x - 1) < 0.1);
                break;
            case 'L':
                axis = new THREE.Vector3(1, 0, 0);
                angle = clockwise ? -Math.PI / 2 : Math.PI / 2;
                face = cubelets.filter(c => Math.abs(c.position.x + 1) < 0.1);
                break;
            case 'U':
                axis = new THREE.Vector3(0, 1, 0);
                angle = clockwise ? Math.PI / 2 : -Math.PI / 2;
                face = cubelets.filter(c => Math.abs(c.position.y - 1) < 0.1);
                break;
            case 'D':
                axis = new THREE.Vector3(0, 1, 0);
                angle = clockwise ? -Math.PI / 2 : Math.PI / 2;
                face = cubelets.filter(c => Math.abs(c.position.y + 1) < 0.1);
                break;
            case 'F':
                axis = new THREE.Vector3(0, 0, 1);
                angle = clockwise ? Math.PI / 2 : -Math.PI / 2;
                face = cubelets.filter(c => Math.abs(c.position.z - 1) < 0.1);
                break;
            case 'B':
                axis = new THREE.Vector3(0, 0, 1);
                angle = clockwise ? -Math.PI / 2 : Math.PI / 2;
                face = cubelets.filter(c => Math.abs(c.position.z + 1) < 0.1);
                break;
            default:
                return;
        }

        if (face && face.length > 0) {
            startRotation(face, axis, angle);
            updateMoveCount();
        }
    });

    // Mouse controls for camera rotation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    renderer.domElement.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging && !isRotating) {
            const deltaMove = {
                x: e.clientX - previousMousePosition.x,
                y: e.clientY - previousMousePosition.y
            };

            const spherical = new THREE.Spherical();
            spherical.setFromVector3(camera.position);
            spherical.theta -= deltaMove.x * 0.01;
            spherical.phi += deltaMove.y * 0.01;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

            camera.position.setFromSpherical(spherical);
            camera.lookAt(0, 0, 0);
            previousMousePosition = { x: e.clientX, y: e.clientY };
        }
    });

    renderer.domElement.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Prevent context menu on right click
    renderer.domElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function startRotation(face, axis, targetAngle) {
    if (isRotating || face.length === 0) return;
    
    isRotating = true;
    updateStatus('Rotating...');
    toggleButtons(true);
    
    const rotationGroup = new THREE.Group();
    
    // Remove cubelets from scene and add to rotation group
    face.forEach(cubelet => {
        scene.remove(cubelet);
        cubelet.userData.originalPosition = cubelet.position.clone();
        rotationGroup.add(cubelet);
    });
    
    scene.add(rotationGroup);
    
    moves.push({ 
        group: rotationGroup, 
        axis: axis.clone(), 
        targetAngle: targetAngle,
        currentAngle: 0,
        cubelets: face
    });
}

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
    let scrambleMoves = 25;
    updateStatus('Scrambling...');
    
    function performScramble() {
        if (scrambleMoves <= 0 || isRotating) {
            if (scrambleMoves > 0) {
                setTimeout(performScramble, 100);
            } else {
                updateStatus('Scrambled! Ready to solve');
            }
            return;
        }
        
        const faceAction = faceActions[Math.floor(Math.random() * faceActions.length)];
        const clockwise = Math.random() > 0.5;
        const angle = clockwise ? Math.PI / 2 : -Math.PI / 2;
        const face = cubelets.filter(faceAction.selector);
        
        if (face.length > 0) {
            scrambleHistory.push({ face: faceAction.key, clockwise });
            startRotation(face, faceAction.axis, angle);
            scrambleMoves--;
        }
        
        setTimeout(performScramble, 200);
    }
    
    moveCount = 0;
    updateMoveCount();
    performScramble();
}

function resetCube() {
    if (isRotating) return;
    
    // Clear any pending moves
    moves.forEach(move => {
        move.group.children.forEach(cubelet => {
            scene.remove(cubelet);
        });
        scene.remove(move.group);
    });
    moves = [];
    isRotating = false;
    
    // Reset move count and history
    moveCount = 0;
    scrambleHistory = [];
    updateMoveCount();
    updateStatus('Reset complete');
    toggleButtons(false);
    
    // Recreate the cube
    createCube();
}

function solveCube() {
    if (isRotating || scrambleHistory.length === 0) {
        updateStatus('Nothing to solve!');
        return;
    }
    
    updateStatus('Auto-solving...');
    
    // Reverse the scramble moves
    const solveMoves = scrambleHistory.slice().reverse();
    let solveIndex = 0;
    
    function performSolve() {
        if (solveIndex >= solveMoves.length || isRotating) {
            if (solveIndex < solveMoves.length) {
                setTimeout(performSolve, 100);
            } else {
                updateStatus('Solved! 🎉');
                scrambleHistory = [];
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
        const angle = move.clockwise ? -Math.PI / 2 : Math.PI / 2; // Reverse direction
        const face = cubelets.filter(faceAction.selector);
        
        if (face.length > 0) {
            startRotation(face, faceAction.axis, angle);
            solveIndex++;
            updateMoveCount();
        }
        
        setTimeout(performSolve, 300);
    }
    
    performSolve();
}

function updateMoveCount() {
    moveCount++;
    document.getElementById('moveCount').textContent = `Moves: ${moveCount}`;
}

function updateStatus(status) {
    document.getElementById('status').textContent = status;
}

function toggleButtons(disabled) {
    const buttons = ['scrambleBtn', 'solveBtn', 'resetBtn'];
    buttons.forEach(id => {
        document.getElementById(id).disabled = disabled;
    });
}

function toggleHelp() {
    const instructions = document.getElementById('instructions');
    helpVisible = !helpVisible;
    
    if (helpVisible) {
        instructions.classList.remove('hidden');
    } else {
        instructions.classList.add('hidden');
    }
}

function animate() {
    requestAnimationFrame(animate);

    // Process moves
    if (moves.length > 0) {
        const move = moves[0];
        
        // Calculate rotation step
        const rotationStep = rotationSpeed;
        const remainingAngle = move.targetAngle - move.currentAngle;
        const actualStep = Math.sign(remainingAngle) * Math.min(Math.abs(remainingAngle), rotationStep);
        
        // Apply rotation
        move.group.rotateOnAxis(move.axis, actualStep);
        move.currentAngle += actualStep;
        
        // Check if rotation is complete
        if (Math.abs(move.currentAngle - move.targetAngle) < 0.001) {
            // Finalize rotation
            move.group.rotateOnAxis(move.axis, move.targetAngle - move.currentAngle);
            
            // Update cubelet positions
            move.cubelets.forEach(cubelet => {
                // Apply the group's transform to get new world position
                const worldPosition = new THREE.Vector3();
                cubelet.getWorldPosition(worldPosition);
                
                // Remove from group and add back to scene
                move.group.remove(cubelet);
                scene.add(cubelet);
                
                // Round position to avoid floating point errors
                cubelet.position.x = Math.round(worldPosition.x);
                cubelet.position.y = Math.round(worldPosition.y);
                cubelet.position.z = Math.round(worldPosition.z);
                
                // Apply rotation from group to cubelet
                cubelet.quaternion.multiplyQuaternions(move.group.quaternion, cubelet.quaternion);
            });
            
            // Clean up
            scene.remove(move.group);
            moves.shift();
            
            if (moves.length === 0) {
                isRotating = false;
                updateStatus('Ready');
                toggleButtons(false);
            }
        }
    }

    renderer.render(scene, camera);
}