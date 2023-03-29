import { initScene } from './scene';
import './style/main.css'

const grid = document.querySelector("#grid")
const webgl = document.querySelector(".webgl")

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const sceneName = urlParams.get("scene");

const sceneNames = ["gym", "backrooms", "desert"];

if (sceneNames.includes(sceneName)) {
    grid.remove();

    webgl.style.display = "block";

    initScene(sceneName);
} else {
    grid.style.display = "grid";
}