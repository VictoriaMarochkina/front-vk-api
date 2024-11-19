import * as THREE from 'three';
import { OrbitControls } from 'three-orbitcontrols-ts';

const API_URL = import.meta.env.VITE_API_URL;
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 25;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

const nodeColors = {
    user: 0xff0000,
    group: 0x0000ff
};

const nodes = [];
let lines = [];

async function logFetch(url, options) {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        console.log("Запрос к API:", url, options, "Ответные данные:", data);
        return data;
    } catch (error) {
        console.error("Ошибка запроса:", error);
        return null;
    }
}

async function fetchNodes() {
    const [usersResponse, groupsResponse] = await Promise.all([
        logFetch(`${API_URL}/users/`, { headers: { 'token': API_TOKEN } }),
        logFetch(`${API_URL}/groups/`, { headers: { 'token': API_TOKEN } })
    ]);

    return { users: usersResponse || [], groups: groupsResponse || [] };
}

// Получение связей для узла
async function fetchNodeRelationships(nodeId, nodeType) {
    return logFetch(`${API_URL}/${nodeType}s/${nodeId}/relationships/`, { headers: { 'token': API_TOKEN } });
}

async function createGraph() {
    const { users, groups } = await fetchNodes();

    if (users.length === 0 && groups.length === 0) {
        console.warn("Не найдено узлов для создания графа.");
        return;
    }

    users.forEach(user => {
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: nodeColors['user'] });
        const sphere = new THREE.Mesh(geometry, material);

        const distance = 15 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);

        sphere.position.set(
            distance * Math.sin(phi) * Math.cos(theta),
            distance * Math.sin(phi) * Math.sin(theta),
            distance * Math.cos(phi)
        );

        sphere.userData = {
            ...user,
            type: 'user',
            user_id: user.user_id || user.id,
            sex: user.sex,
            home_town: user.home_town,
            city: user.city,
        };
        nodes.push(sphere);
        scene.add(sphere);
    });

    groups.forEach(group => {
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: nodeColors['group'] });
        const sphere = new THREE.Mesh(geometry, material);

        const distance = 15 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);

        sphere.position.set(
            distance * Math.sin(phi) * Math.cos(theta),
            distance * Math.sin(phi) * Math.sin(theta),
            distance * Math.cos(phi)
        );

        sphere.userData = { ...group, type: 'group', group_id: group.group_id || group.id };
        nodes.push(sphere);
        scene.add(sphere);
    });
}

function clearConnections() {
    lines.forEach(line => scene.remove(line));
    lines = [];
}

let selectedNode = null;
async function displayNodeInfo(node) {
    clearConnections();

    const data = node.userData;
    const relationshipsData = await fetchNodeRelationships(data.user_id || data.group_id, data.type);
    const relationships = relationshipsData ? relationshipsData.relationships : [];

    relationships.forEach(rel => {
        const targetNode = nodes.find(n =>
            (n.userData.user_id && n.userData.user_id === rel.user_id) ||
            (n.userData.group_id && n.userData.group_id === rel.group_id)
        );

        if (targetNode) {
            const geometry = new THREE.BufferGeometry().setFromPoints([node.position, targetNode.position]);
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            const line = new THREE.Line(geometry, material);
            scene.add(line);
            lines.push(line);
        } else {
            console.warn("Связь не найдена для узла:", rel);
        }
    });

    updateNodeInfoDisplay(data);
}

function updateNodeInfoDisplay(data) {
    const infoContainer = document.getElementById('node-info') || document.createElement('div');
    infoContainer.id = 'node-info';
    infoContainer.style.position = 'absolute';
    infoContainer.style.top = '10px';
    infoContainer.style.left = '10px';
    infoContainer.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
    infoContainer.style.padding = '10px';
    infoContainer.style.borderRadius = '5px';
    infoContainer.style.maxHeight = '90%';
    infoContainer.style.overflowY = 'auto';


    let infoContent = `<strong>Node Details</strong><br>Type: ${data.type}<br>`;
    if (data.type === 'user') {
        infoContent += `ID: ${data.user_id || '-'}<br>Name: ${data.name || '-'}<br>Sex: ${data.sex || '-'}<br>Home Town: ${data.home_town || '-'}<br>City: ${data.city || '-'}<br>`;
    } else if (data.type === 'group') {
        infoContent += `ID: ${data.group_id || '-'}<br>Name: ${data.name || '-'}<br>Subscribers Count: ${data.subscribers_count || '0'}<br>`;
    }
    infoContainer.innerHTML = infoContent;
    document.body.appendChild(infoContainer);
}

function clearSelection() {
    if (selectedNode) {
        const infoContainer = document.getElementById('node-info');
        if (infoContainer) infoContainer.remove();

        clearConnections();
        selectedNode = null;
    }
}

function onDocumentClick(event) {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(nodes);
    if (intersects.length > 0) {
        clearSelection();
        selectedNode = intersects[0].object;
        displayNodeInfo(selectedNode);
    } else {
        clearSelection();
    }
}

window.addEventListener('click', onDocumentClick, false);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

document.addEventListener("DOMContentLoaded", () => {
    createGraph();
    animate();
});
