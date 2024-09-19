import GUI from "lil-gui";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import TypeIt from "typeit";

import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

import data from "./data/captions.json";
import pointsData from "./data/points.json";
import pointsDataBackup from "./data/points-backup.json";

const loadingScreen = document.getElementById("loading-screen");
const roomInfo = document.querySelector("#room-info");

const btnContainer = document.querySelector(".btn-container");
const manualBtn = document.querySelector("#manual-btn");
const autonomusBtn = document.querySelector("#autonomus-btn");

const hideLoadingScreen = () => {
  loadingScreen.style.display = "none";
};

let isLoading = true;

let isAutoMoving = null;

let stopAuotnom = false;

const objects = [];
const visitedRooms = [];

const roomsList = {
  serving: false,
  dining: false,
  "upper-vestibule": false,
  "small-drawing-room": false,
  "morning-room": false,
  "great-drawing-room": false,
  "smoking-room": false,
  armoury: false,
  "billiards-room": false,
};

const globalSettings = {
  enableCaptions: false,
  enableBackgroundSpeech: true,
  language: "en",
};

let circled = false;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioContext.createGain();

let audio = new Audio(`voice/${globalSettings.language}/upper-vestibule.mp3`);
const track = audioContext.createMediaElementSource(audio);

track.connect(gainNode).connect(audioContext.destination);

gainNode.gain.value = 1;

let typingInstance = new TypeIt(roomInfo, {
  speed: 50,
  waitUntilVisible: true,
});

let previousRoom = "upper-vestibule";

// Movement flags
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

/**
 * Base
 */
// Debug
const gui = new GUI({
  width: 400,
});
gui.title("Settings");

const visitedRoomsFolder = gui.addFolder("Visited Rooms");

gui.add(globalSettings, "enableCaptions").onChange((value) => {
  if (value) {
    roomInfo.style.display = "block";
    typingInstance.type(data[globalSettings.language][previousRoom]).go();
  } else {
    typingInstance.queue.wipe();
    typingInstance.empty();
    typingInstance.delete();
    typingInstance.reset();
    roomInfo.innerHTML = "";
    roomInfo.style.display = "none";
  }
});

gui.add(globalSettings, "enableBackgroundSpeech");

gui
  .add(globalSettings, "language", ["en", "aze", "fr", "tr"])
  .onChange((value) => {
    // adudi reset
    audio.src = `voice/${value}/${previousRoom}.mp3`;
    audio.currentTime = 0;

    // typing reset
    if (globalSettings.enableCaptions) {
      typingInstance.queue.wipe();

      typingInstance.empty();
      typingInstance.delete();
      typingInstance.reset();
      roomInfo.innerHTML = "";
      typingInstance.type(data[globalSettings.language][previousRoom]).go();
    }
  });

gui.add(gainNode.gain, "value", 0, 10, 0.1).name("Volume");

Object.keys(roomsList).forEach((room) => {
  visitedRoomsFolder.add(roomsList, room).onChange((value) => {
    if (value) {
      visitedRooms.push(room);
    } else {
      visitedRooms.splice(visitedRooms.indexOf(room), 1);
    }
  });
});

// Scene
const scene = new THREE.Scene();

/**
 * Loaders
 */
// Texture loader
const textureLoader = new THREE.TextureLoader();

const museumTextures = {
  serving: "textures/museum/serving.jpg",
  dining: "textures/museum/dining.jpg",
  upperVestibule: "textures/museum/upper-vestibule.jpg",
  smallDrawingRoom: "textures/museum/small-drawing-room.jpg",
  morningRoom: "textures/museum/morning-room.jpg",
  greatDrawingRoom: "textures/museum/great-drawing-room.jpg",
  smokingRoom: "textures/museum/smoking-room.jpg",
  armoury: "textures/museum/armoury.jpg",
  billiardsRoom: "textures/museum/billiards-room.jpg",
};

const brickColorTexture = textureLoader.load(
  "textures/brick/rock_wall_07_diff_1k.jpg"
);

const brickARMTexture = textureLoader.load(
  "textures/brick/rock_wall_07_arm_1k.jpg"
);

const brickNormalTexture = textureLoader.load(
  "textures/brick/rock_wall_07_nor_gl_1k.jpg"
);

const brickDisplacementTexture = textureLoader.load(
  "textures/brick/rock_wall_07_disp_1k.jpg"
);

brickColorTexture.repeat.set(3, 3);
brickARMTexture.repeat.set(3, 3);
brickNormalTexture.repeat.set(3, 3);
brickDisplacementTexture.repeat.set(3, 3);

brickColorTexture.wrapS = THREE.RepeatWrapping;
brickARMTexture.wrapS = THREE.RepeatWrapping;
brickNormalTexture.wrapS = THREE.RepeatWrapping;
brickDisplacementTexture.wrapS = THREE.RepeatWrapping;

brickColorTexture.wrapT = THREE.RepeatWrapping;
brickARMTexture.wrapT = THREE.RepeatWrapping;
brickNormalTexture.wrapT = THREE.RepeatWrapping;
brickDisplacementTexture.wrapT = THREE.RepeatWrapping;

brickColorTexture.colorSpace = THREE.SRGBColorSpace;

// Load textures and set properties
for (const key in museumTextures) {
  const texture = textureLoader.load(museumTextures[key]);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  museumTextures[key] = new THREE.MeshBasicMaterial({
    map: texture,
  });
}

// GLTF loader
const gltfLoader = new GLTFLoader();

const loadMusem = async () => {
  return await new Promise((resolve) => {
    gltfLoader.load("museum.glb", (gltf) => {
      gltf.scene.children.forEach((child) => {
        child.scale.set(0.2, 0.2, 0.2);
        if (child.name === "serving") {
          child.material = museumTextures.serving;
        } else if (child.name === "upper-vestibule") {
          child.material = museumTextures.upperVestibule;
        } else if (child.name === "dining") {
          child.material = museumTextures.dining;
        } else if (child.name === "small-drawing-room") {
          child.material = museumTextures.smallDrawingRoom;
        } else if (child.name === "morning-room") {
          child.material = museumTextures.morningRoom;
        } else if (child.name === "great-drawing-room") {
          child.material = museumTextures.greatDrawingRoom;
        } else if (child.name === "smoking-room") {
          child.material = museumTextures.smokingRoom;
        } else if (child.name === "armoury") {
          child.material = museumTextures.armoury;
        } else if (child.name === "billiards-room") {
          child.material = museumTextures.billiardsRoom;
        }
      });

      scene.add(gltf.scene);
      resolve();
    });
  });
};

const loadInvisibleMuseum = async () => {
  return await new Promise((resolve) => {
    gltfLoader.load("museum-unvisible.glb", (gltf) => {
      gltf.scene.children.forEach((child) => {
        child.scale.set(0.2, 0.2, 0.2);
        objects.push(child);

        child.material = new THREE.MeshBasicMaterial({
          opacity: 0,
          transparent: true,
        });
      });
      scene.add(gltf.scene);
      resolve();
    });
  });
};

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadMusem(), loadInvisibleMuseum()]).then(() => {
    isLoading = false;
  });
});

/**
 * Lights
 */

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Update effect composer
  effectComposer.setSize(sizes.width, sizes.height);
  effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyF") {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
});

/**
 * Objects
 */

// mirror
const geometry = new THREE.PlaneGeometry(1, 1.5);

const mirror = new Reflector(geometry, {
  clipBias: 0.003,
  textureWidth: sizes.width * window.devicePixelRatio,
  textureHeight: sizes.height * window.devicePixelRatio,
  color: 0x889999,
  visible: true,
});
mirror.position.set(2.68, 4.51, 0.86);
mirror.rotateY(Math.PI / 2);
scene.add(mirror);

// barier
const barierMaterial = new THREE.MeshStandardMaterial({
  map: brickColorTexture,
  aoMap: brickARMTexture,
  roughnessMap: brickARMTexture,
  metalnessMap: brickARMTexture,
  normalMap: brickNormalTexture,
  displacementMap: brickDisplacementTexture,
  displacementScale: 0.3,
  displacementBias: -0.2,
});

const barierGeometry = new THREE.PlaneGeometry(1, 3.35, 10, 10);

const barier1 = new THREE.Mesh(barierGeometry, barierMaterial);
const barier2 = new THREE.Mesh(barierGeometry, barierMaterial);

barier1.position.set(2.55, 1.25, -0.58);
barier1.rotation.set(0, 4.38, 0);

barier2.position.set(2.6, 1.6, -1.71);
barier2.rotation.set(0, -1.3, 0);

scene.add(barier1);
scene.add(barier2);

objects.push(barier1);
objects.push(barier2);

// wall
const wallMaterial = new THREE.MeshStandardMaterial({
  color: "##9d573d",
});

const wallGeometry = new THREE.PlaneGeometry(1, 1, 10, 10);

const wall1 = new THREE.Mesh(wallGeometry, wallMaterial);
wall1.position.set(-2.18, 3.93, -8.93);
wall1.rotation.set(0, 0.6, 0);

scene.add(wall1);
objects.push(wall1);

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  45,
  sizes.width / sizes.height,
  0.1,
  100
);

// Controls
const controls = new PointerLockControls(camera, document.body);

const blocker = document.getElementById("blocker");
const instructions = document.getElementById("instructions");

instructions.addEventListener("click", function () {
  if (isAutoMoving !== null) {
    controls.lock();
  }
});

manualBtn.addEventListener("click", function () {
  isAutoMoving = false;
  btnContainer.style.display = "none";
  controls.lock();
});

autonomusBtn.addEventListener("click", function () {
  isAutoMoving = true;
  btnContainer.style.display = "none";

  // reset from loop
  if (pointsData.length === 0) {
    controls.getObject().position.set(0, 0.8, -1.7);

    Object.keys(roomsList).forEach((room) => {
      roomsList[room] = false;
    });

    visitedRoomsFolder.controllers.forEach((controller) => {
      controller.updateDisplay();
    });

    visitedRooms.length = 0;

    previousRoom = "upper-vestibule";

    pointsData.push(...pointsDataBackup);
  }

  audio.src = `voice/${globalSettings.language}/upper-vestibule.mp3`;
  audio.currentTime = 0;
  controls.lock();
});

controls.addEventListener("lock", function () {
  instructions.style.display = "none";
  blocker.style.display = "none";

  if (globalSettings.enableBackgroundSpeech && audio.currentTime !== 0) {
    audioContext.resume();
    audio.play();
  }
});

controls.addEventListener("unlock", function () {
  blocker.style.display = "block";
  instructions.style.display = "";

  audio.pause();
});

controls.getObject().position.set(0, 0.8, -1.7);

scene.add(controls.getObject());

const onKeyDown = function (event) {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = true;
      break;

    case "ArrowLeft":
    case "KeyA":
      moveLeft = true;
      break;

    case "ArrowDown":
    case "KeyS":
      moveBackward = true;
      break;

    case "ArrowRight":
    case "KeyD":
      moveRight = true;
      break;
    case "Space":
      stopAuotnom = !stopAuotnom;
      break;
  }
};

const onKeyUp = function (event) {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = false;
      break;

    case "ArrowLeft":
    case "KeyA":
      moveLeft = false;
      break;

    case "ArrowDown":
    case "KeyS":
      moveBackward = false;
      break;

    case "ArrowRight":
    case "KeyD":
      moveRight = false;
      break;
  }
};

if (!isAutoMoving) {
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
}

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

/**
 * Post processing
 */

const renderTarget = new THREE.WebGLRenderTarget(sizes.width, sizes.height, {
  samples: 2,
});

// Effect composer
const effectComposer = new EffectComposer(renderer, renderTarget);
effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
effectComposer.setSize(sizes.width, sizes.height);

// Render pass
const renderPass = new RenderPass(scene, camera);
effectComposer.addPass(renderPass);

// Shader pass for color correction
const ColorCorrectionShader = {
  uniforms: {
    tDiffuse: { value: null },
    powRGB: { value: new THREE.Vector3(2, 2, 2) },
    mulRGB: { value: new THREE.Vector3(1, 1, 1) },
  },

  vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

  fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 powRGB;
        uniform vec3 mulRGB;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            texel.rgb = pow(texel.rgb, powRGB) * mulRGB;
            gl_FragColor = texel;
        }
    `,
};
const colorCorrectionPass = new ShaderPass(ColorCorrectionShader);
colorCorrectionPass.uniforms["powRGB"].value.set(1.2, 1.2, 1.2);
colorCorrectionPass.uniforms["mulRGB"].value.set(1.1, 1.1, 1.1);
effectComposer.addPass(colorCorrectionPass);

// Shader pass for brightness/contrast adjustment
const BrightnessContrastShader = {
  uniforms: {
    tDiffuse: { value: null },
    brightness: { value: 0 },
    contrast: { value: 0 },
  },

  vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

  fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float brightness;
        uniform float contrast;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            texel.rgb += brightness;
            if (contrast > 0.0) {
                texel.rgb = (texel.rgb - 0.5) / (1.0 - contrast) + 0.5;
            } else {
                texel.rgb = (texel.rgb - 0.5) * (1.0 + contrast) + 0.5;
            }
            gl_FragColor = texel;
        }
    `,
};

const brightnessContrastPass = new ShaderPass(BrightnessContrastShader);
brightnessContrastPass.uniforms["brightness"].value = 0.3;
brightnessContrastPass.uniforms["contrast"].value = 0.5;
effectComposer.addPass(brightnessContrastPass);

/**
 * Animate
 */

const raycaster = new THREE.Raycaster(
  new THREE.Vector3(),
  new THREE.Vector3(0, -1, 0),
  0,
  2
);

const stairSpeed = 0.08;
const collisionDistance = 0.7;

let increased = false;

let sounding = false;

const playAudio = (roomName) => {
  if (roomName !== previousRoom) {
    sounding = false;
    previousRoom = roomName;

    if (globalSettings.enableCaptions) {
      typingInstance.queue.wipe();
      typingInstance.empty();
      typingInstance.delete();
      typingInstance.reset();
      roomInfo.innerHTML = "";
      typingInstance.type(data[globalSettings.language][roomName]).go();
    }
  }

  if (!sounding) {
    audio.src = `voice/${globalSettings.language}/${roomName}.mp3`;
    audio.currentTime = 0;
    if (globalSettings.enableBackgroundSpeech) {
      if (!visitedRooms.includes(roomName)) {
        audioContext.resume();
        audio.play();
      }
    }
    sounding = true;
  }
};

const raycastDown = (cameraPosition) => {
  if (!increased) {
    controls.getObject().position.y += stairSpeed;
    increased = true;
  } else {
    controls.getObject().position.y -= 0.05;
  }

  raycaster.set(cameraPosition, new THREE.Vector3(0, -1, 0));
  const intersections = raycaster.intersectObjects(objects, false);

  if (intersections[0]?.object.name.includes("small-drawing-room")) {
    mirror.visible = true;
  } else {
    mirror.visible = false;
  }

  if (intersections.length !== 0) {
    increased = false;
  }

  if (intersections[0]?.distance > 0.78) {
    const distanceDiff = intersections[0].distance - 0.78;
    controls.getObject().position.y -= distanceDiff;
  }

  if (intersections[0]) {
    playAudio(intersections[0].object.name.split("0")[0]);
  }

  if (!visitedRooms.includes(intersections[0]?.object.name.split("0")[0])) {
    visitedRooms.push(intersections[0]?.object.name.split("0")[0]);
    roomsList[intersections[0]?.object.name.split("0")[0]] = true;

    visitedRoomsFolder.controllers
      .find((c) => c.property === intersections[0]?.object.name.split("0")[0])
      ?.updateDisplay();
  }
};

let prevDuration = performance.now();

const tick = () => {
  const time = performance.now();

  if (!circled && !isLoading) {
    camera.rotation.y += 0.01 * Math.PI;

    if (camera.rotation.y >= 2 * Math.PI) {
      camera.rotation.y = Math.PI * 0.5;
      circled = true;
      hideLoadingScreen();
    }
  }

  if (controls.isLocked === true && !isLoading && !isAutoMoving) {
    const cameraPosition = controls.getObject().position;

    const forwardDirection = new THREE.Vector3();
    controls.getDirection(forwardDirection);
    forwardDirection.y = 0;
    forwardDirection.normalize(); //? For moving forward

    const backwardDirection = forwardDirection.clone().negate(); //? For moving backward
    const rightDirection = new THREE.Vector3().crossVectors(
      forwardDirection,
      new THREE.Vector3(0, 1, 0)
    ); //? For moving right
    const leftDirection = rightDirection.clone().negate(); //? For moving left

    if (moveForward) {
      raycaster.set(
        {
          x: cameraPosition.x,
          y: cameraPosition.y - 0.37,
          z: cameraPosition.z,
        },
        forwardDirection
      );
      const intersections = raycaster.intersectObjects(objects, false);

      if (
        intersections.length > 0 &&
        intersections[0].distance < collisionDistance
      ) {
        moveForward = false;
      }
    }

    if (moveBackward) {
      raycaster.set(
        {
          x: cameraPosition.x,
          y: cameraPosition.y - 0.37,
          z: cameraPosition.z,
        },
        backwardDirection
      );
      const intersections = raycaster.intersectObjects(objects, false);

      if (
        intersections.length > 0 &&
        intersections[0].distance < collisionDistance
      ) {
        moveBackward = false;
      }
    }

    if (moveLeft) {
      raycaster.set(
        {
          x: cameraPosition.x,
          y: cameraPosition.y - 0.37,
          z: cameraPosition.z,
        },
        leftDirection
      );
      const intersections = raycaster.intersectObjects(objects, false);

      if (
        intersections.length > 0 &&
        intersections[0].distance < collisionDistance
      ) {
        moveLeft = false;
      }
    }

    if (moveRight) {
      raycaster.set(
        {
          x: cameraPosition.x,
          y: cameraPosition.y - 0.37,
          z: cameraPosition.z,
        },
        rightDirection
      );
      const intersections = raycaster.intersectObjects(objects, false);

      if (
        intersections.length > 0 &&
        intersections[0].distance < collisionDistance
      ) {
        moveRight = false;
      }
    }

    const delta = (time - prevTime) / 1000;

    velocity.x -= velocity.x * 5.0 * delta;
    velocity.z -= velocity.z * 5.0 * delta;

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * 10.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 10.0 * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    raycastDown(cameraPosition);
  }

  if (isAutoMoving && !isLoading && controls.isLocked) {
    let isCorrectPosition = false;
    const cameraPosition = controls.getObject().position;
    const nextPoint = pointsData[0];

    const cameraX = parseFloat(cameraPosition.x.toFixed(2));
    const cameraZ = parseFloat(cameraPosition.z.toFixed(2));

    if (nextPoint === undefined) {
      isAutoMoving = false;
      controls.unlock();
      btnContainer.style.display = "block";
      effectComposer.render();
      window.requestAnimationFrame(tick);
      return;
    }

    const xDiff = nextPoint.x - cameraX;
    const zDiff = nextPoint.z - cameraZ;

    const distance = Math.sqrt(xDiff * xDiff + zDiff * zDiff);

    if (distance <= 0.1 && !stopAuotnom) {
      let duration = performance.now();

      isCorrectPosition = true;

      if (
        nextPoint.duration <= 0 ||
        duration - prevDuration >= nextPoint.duration * 1000
      ) {
        prevDuration;
        pointsData.shift();
      }
      // else {
      //   pointsData[0].duration -= 0.05;
      // }
    }

    if (!isCorrectPosition && !stopAuotnom) {
      const directionX = xDiff / distance;
      const directionZ = zDiff / distance;

      const speed = 0.02; // Your desired constant speed

      cameraPosition.x += directionX * speed;
      cameraPosition.z += directionZ * speed;

      controls
        .getObject()
        .position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

      raycastDown(cameraPosition);
      prevDuration = performance.now();
    }
  }

  prevTime = time;

  effectComposer.render();
  window.requestAnimationFrame(tick);
};

tick();
