let fileList = [], currentIndex = 0, destinations = [], currentSourceDir = "", lastMove = null;
const SHORTCUT_KEYS = "123456789abcdefghijklmnopqrstuvwxyz".split("");

const container = document.getElementById('mediaContainer');
const destListEl = document.getElementById('destList');
const stats = document.getElementById('stats');
const btnUndo = document.getElementById('btnUndo');
const remainingCountEl = document.getElementById('remaining-count');
const sourcePathDisplay = document.getElementById('source-path-display');
const filenameDisplay = document.getElementById('current-filename');

// --- STARTUP ---
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
    await window.api.saveSettings({ 
        sourceDir: currentSourceDir, 
        destinations: destinations.map(d => ({path: d.path, name: d.name})) 
    });
}

function updateStatusBar() {
    remainingCountEl.innerText = `Files remaining: ${fileList.length}`;
    sourcePathDisplay.innerText = currentSourceDir || "No source selected";
    
    if (fileList.length > 0 && fileList[currentIndex]) {
        filenameDisplay.innerText = fileList[currentIndex].split(/[\\/]/).pop();
    } else {
        filenameDisplay.innerText = "-";
    }
}

async function loadSource(path) {
    currentSourceDir = path;
    const files = await window.api.getFiles(path);
    
    // Alphabetical sort
    fileList = files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    
    currentIndex = 0;
    showFile();
    updateStatusBar();
    saveCurrentState();
}

function showFile() {
    if (!fileList.length) { 
        container.innerHTML = "<p>Empty folder or all files moved.</p>"; 
        stats.innerText = "0/0"; 
        updateStatusBar();
        return; 
    }
    const filePath = fileList[currentIndex];
    stats.innerText = `${currentIndex + 1} / ${fileList.length}`;
    
    const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(filePath);
    
    // Using standard file:// protocol for full seeking support
    const mediaUrl = `file://${filePath}`;
    
    if (isVideo) {
        container.innerHTML = `<video id="viewer" src="${mediaUrl}" controls autoplay loop></video>`;
        const video = document.getElementById('viewer');
        
        // Use 'oncanplay' to ensure the video engine is ready to seek
        video.oncanplay = () => {
            // Only jump if we are still at the beginning (prevents looping back to 5s)
            if (video.currentTime < 1) {
                video.currentTime = Math.min(5, video.duration);
            }
        };
    } else {
        container.innerHTML = `<img id="viewer" src="${mediaUrl}" />`;
    }
    updateStatusBar();
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
    try {
        await window.api.moveFile({ oldPath: lastMove.dest, newDir: originalDir });
        fileList.splice(currentIndex, 0, lastMove.source);
        lastMove = null; 
        btnUndo.disabled = true;
        showFile();
    } catch (e) { alert("Could not undo move."); }
};

function renderSidebar() {
    destListEl.innerHTML = '';
    destinations.forEach((d, i) => {
        d.key = SHORTCUT_KEYS[i];
        const el = document.createElement('div');
        el.className = 'dest-item';
        el.onclick = (e) => { 
            if(e.target.className !== 'remove-btn') moveFile(d.path); 
        };
        el.innerHTML = `
            <span class="shortcut-key">[${d.key.toUpperCase()}]</span>
            <div class="dest-info" title="${d.path}">${d.name}</div>
            <span class="remove-btn" onclick="removeDest(${i})">×</span>
        `;
        destListEl.appendChild(el);
    });
}

window.removeDest = (i) => { 
    destinations.splice(i, 1); 
    renderSidebar(); 
    saveCurrentState(); 
};

document.getElementById('btnSource').onclick = async () => { 
    const p = await window.api.selectSource(); 
    if(p) loadSource(p); 
};

document.getElementById('btnAddDest').onclick = async () => {
    const ps = await window.api.selectDest();
    if(ps) { 
        ps.forEach(p => { 
            if(!destinations.find(d => d.path === p)) {
                destinations.push({path: p, name: p.split(/[\\/]/).pop()});
            }
        }); 
        renderSidebar(); 
        saveCurrentState(); 
    }
};

window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if(k === 'arrowdown') {
        if (currentIndex < fileList.length - 1) { currentIndex++; showFile(); }
    } else if(k === 'arrowup') {
        if (currentIndex > 0) { currentIndex--; showFile(); }
    } else {
        const d = destinations.find(x => x.key === k);
        if(d) moveFile(d.path);
    }
});