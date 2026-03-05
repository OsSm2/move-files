let fileList = [], currentIndex = 0, destinations = [], currentSourceDir = "", lastMove = null;
const SHORTCUT_KEYS = "123456789abcdefghijklmnopqrstuvwxyz".split("");
const container = document.getElementById('mediaContainer'), destListEl = document.getElementById('destList');
const stats = document.getElementById('stats'), btnUndo = document.getElementById('btnUndo');

window.addEventListener('DOMContentLoaded', async () => {
    const saved = await window.api.loadSettings();
    if (saved) {
        destinations = saved.destinations || [];
        currentSourceDir = saved.sourceDir || "";
        renderSidebar();
        if (currentSourceDir) loadSource(currentSourceDir);
    }
});

async function saveCurrentState() {
    await window.api.saveSettings({ sourceDir: currentSourceDir, destinations: destinations.map(d => ({path: d.path, name: d.name})) });
}

async function loadSource(path) {
    currentSourceDir = path;
    fileList = await window.api.getFiles(path);
    currentIndex = 0;
    showFile();
    saveCurrentState();
}

function showFile() {
    if (!fileList.length) { container.innerHTML = "<p>Empty</p>"; stats.innerText = "0/0"; return; }
    const filePath = fileList[currentIndex];
    stats.innerText = `${currentIndex + 1} / ${fileList.length}`;
    const isVideo = /\.(mp4|webm|mov)$/i.test(filePath);
    const mediaUrl = `media://${encodeURIComponent(filePath)}`;
    container.innerHTML = isVideo ? `<video id="viewer" src="${mediaUrl}" controls autoplay loop></video>` : `<img id="viewer" src="${mediaUrl}" />`;
}

async function moveFile(targetDir) {
    if (!fileList.length) return;
    const oldPath = fileList[currentIndex];
    try {
        await window.api.moveFile({ oldPath, newDir: targetDir });
        lastMove = { source: oldPath, dest: `${targetDir}/${oldPath.split(/[\\/]/).pop()}` };
        btnUndo.disabled = false;
        fileList.splice(currentIndex, 1);
        if (currentIndex >= fileList.length) currentIndex = Math.max(0, fileList.length - 1);
        showFile();
    } catch (e) { alert("Error moving file."); }
}

btnUndo.onclick = async () => {
    if (!lastMove) return;
    const originalDir = lastMove.source.split(/[\\/]/).slice(0, -1).join('/');
    await window.api.moveFile({ oldPath: lastMove.dest, newDir: originalDir });
    fileList.splice(currentIndex, 0, lastMove.source);
    lastMove = null; btnUndo.disabled = true;
    showFile();
};

function renderSidebar() {
    destListEl.innerHTML = '';
    destinations.forEach((d, i) => {
        d.key = SHORTCUT_KEYS[i];
        const el = document.createElement('div');
        el.className = 'dest-item';
        el.onclick = (e) => { if(e.target.className !== 'remove-btn') moveFile(d.path); };
        el.innerHTML = `<span class="shortcut-key">[${d.key.toUpperCase()}]</span><div class="dest-info">${d.name}</div><span class="remove-btn" onclick="removeDest(${i})">×</span>`;
        destListEl.appendChild(el);
    });
}

window.removeDest = (i) => { destinations.splice(i, 1); renderSidebar(); saveCurrentState(); };
document.getElementById('btnSource').onclick = async () => { const p = await window.api.selectSource(); if(p) loadSource(p); };
document.getElementById('btnAddDest').onclick = async () => {
    const ps = await window.api.selectDest();
    if(ps) { ps.forEach(p => { if(!destinations.find(d=>d.path===p)) destinations.push({path:p, name:p.split(/[\\/]/).pop()}); }); renderSidebar(); saveCurrentState(); }
};

window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if(k === 'arrowdown' && currentIndex < fileList.length-1) { currentIndex++; showFile(); }
    else if(k === 'arrowup' && currentIndex > 0) { currentIndex--; showFile(); }
    else { const d = destinations.find(x => x.key === k); if(d) moveFile(d.path); }
});