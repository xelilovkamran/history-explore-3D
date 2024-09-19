import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

self.onmessage = function (e) {
  const { url, dracoPath } = e.data;
  console.log("url", url);

  // Draco loader
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(dracoPath);

  // GLTF loader
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  // Load the model
  gltfLoader.load("../../static/museum.glb", (gltf) => {
    // self.postMessage({
    //   type: "modelLoaded",
    //   gltf: gltf,
    // });
  });
};
