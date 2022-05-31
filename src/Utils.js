import { enhanceShaderLighting } from "./enhanceShaderLighting";

export const detectSupport = () => {
    const promises = [];
    // from https://github.com/leechy/imgsupport
    var AVIF = new Image();
    promises.push(new Promise(resolve => {
        AVIF.onload = AVIF.onerror = () => {
            resolve({ "avif": AVIF.height === 2 });
        };
    }));
    AVIF.src = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=";

    var WebP = new Image();
    promises.push(new Promise(resolve => {
        WebP.onload = WebP.onerror = () => {
            resolve({ "webp": WebP.height === 2 });
        };
    }));
    WebP.src = "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA";

    return Promise.all(promises).then(result => {
        let data = {};
        for (let type of result) data = { ...type, ...data };
        return data;
    })
};

export const initLowResMaterial = mesh => {
    let lowResMaterial = new THREE.MeshBasicMaterial({
        map: mesh.material.map,
        lightMap: mesh.material.lightMap,
        color: new THREE.Color(0xab9e6c).multiplyScalar(4.25)
    })

    mesh.userData.material = mesh.material
    mesh.userData.lowResMaterial = lowResMaterial

    const { onBeforeCompile } = lowResMaterial;

    lowResMaterial.onBeforeCompile = (shader, ...args) => {
        enhanceShaderLighting(shader, { lightMapContrast: 0.875, mapContrast: 0.875 })

        onBeforeCompile(shader, ...args);
    }
}