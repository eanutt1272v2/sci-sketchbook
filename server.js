const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

const hiddenFiles = [
    'node_modules',
    'server.js',
    'package.json',
    'package-lock.json',
    '.gitignore',
    '.env',
    '.git'
];

const sendForbidden = (res, message) => {
    res.status(403).send(`
        <body style="background:#1a1a1a;color:#ff5555;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
            <h1 style="border-bottom:1px solid #333;padding-bottom:10px;">403 | Forbidden</h1>
            <p style="color:#888;">${message}</p>
            <a href="/" style="color:#ccc;text-decoration:none;border:1px solid #444;padding:5px 15px;border-radius:3px;">Return to Root</a>
        </body>
    `);
};

function formatBytes(bytes) {
    if (bytes === -1) return '--';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getDetailedType(item, ext) {
    if (item.isDirectory()) return 'Folder';
    if (!ext) return 'File';
    const e = ext.toLowerCase();
    const types = {
        '.jpg': 'JPEG Image', '.jpeg': 'JPEG Image', '.png': 'PNG Image', '.gif': 'GIF Image',
        '.svg': 'SVG Vector', '.webp': 'WebP Image', '.ico': 'Icon Resource', '.bmp': 'Bitmap Image',
        '.tiff': 'TIFF Image', '.tif': 'TIFF Image', '.psd': 'Adobe Photoshop', '.ai': 'Adobe Illustrator',
        '.raw': 'RAW Image', '.cr2': 'Canon RAW', '.nef': 'Nikon RAW', '.heic': 'High Efficiency Image',
        '.eps': 'Encapsulated PostScript', '.indd': 'Adobe InDesign',

        '.pdf': 'PDF Document', '.doc': 'Word Document', '.docx': 'Word Document', '.dotx': 'Word Template',
        '.txt': 'Plain Text', '.md': 'Markdown Document', '.rtf': 'Rich Text', '.csv': 'CSV Data',
        '.xls': 'Excel Spreadsheet', '.xlsx': 'Excel Spreadsheet', '.xlsm': 'Excel Macro-Enabled',
        '.ppt': 'PowerPoint Presentation', '.pptx': 'PowerPoint Presentation', '.ppsx': 'PowerPoint Show',
        '.odt': 'OpenDocument Text', '.ods': 'OpenDocument Spreadsheet', '.odp': 'OpenDocument Presentation',
        '.pages': 'Apple Pages', '.numbers': 'Apple Numbers', '.key': 'Apple Keynote', '.epub': 'E-Book',

        '.js': 'JavaScript Source', '.mjs': 'ES Module JS', '.ts': 'TypeScript Source', '.tsx': 'React TypeScript',
        '.jsx': 'React JavaScript', '.html': 'HTML Document', '.htm': 'HTML Document', '.css': 'CSS Stylesheet',
        '.scss': 'Sass Stylesheet', '.less': 'Less Stylesheet', '.json': 'JSON Data', '.jsonl': 'JSON Lines',
        '.py': 'Python Script', '.pyc': 'Compiled Python', '.cpp': 'C++ Source', '.hpp': 'C++ Header',
        '.c': 'C Source', '.h': 'C Header', '.cs': 'C# Source', '.java': 'Java Source', '.class': 'Java Bytecode',
        '.php': 'PHP Script', '.rb': 'Ruby Script', '.go': 'Go Source', '.rs': 'Rust Source', '.sh': 'Shell Script',
        '.zsh': 'Zsh Script', '.bat': 'Windows Batch', '.ps1': 'PowerShell Script', '.yaml': 'YAML Config',
        '.yml': 'YAML Config', '.xml': 'XML Document', '.sql': 'SQL Database Script', '.dart': 'Dart Source',
        '.swift': 'Swift Source', '.kt': 'Kotlin Source', '.lua': 'Lua Script', '.pl': 'Perl Script',
        '.dockerfile': 'Docker Configuration', '.makefile': 'Make Build Script', '.ini': 'Configuration File',
        '.env': 'Environment Variables', '.toml': 'TOML Config', '.vbs': 'VBScript',

        '.mp3': 'MP3 Audio', '.wav': 'WAV Audio', '.flac': 'FLAC Audio', '.ogg': 'Ogg Vorbis Audio',
        '.m4a': 'MPEG-4 Audio', '.aac': 'AAC Audio', '.wma': 'Windows Media Audio', '.mid': 'MIDI Audio',
        '.midi': 'MIDI Audio', '.aif': 'AIFF Audio', '.opus': 'Opus Audio',

        '.mp4': 'MP4 Video', '.mkv': 'Matroska Video', '.mov': 'QuickTime Video', '.avi': 'AVI Video',
        '.wmv': 'Windows Media Video', '.flv': 'Flash Video', '.webm': 'WebM Video', '.m4v': 'M4V Video',
        '.mpeg': 'MPEG Video', '.mpg': 'MPEG Video', '.3gp': '3GP Mobile Video',

        '.zip': 'ZIP Archive', '.rar': 'RAR Archive', '.tar': 'Tarball Archive', '.gz': 'Gzip Compressed',
        '.7z': '7-Zip Archive', '.bz2': 'Bzip2 Compressed', '.xz': 'XZ Compressed', '.iso': 'Disc Image',
        '.pkg': 'macOS Installer Package', '.deb': 'Debian Package', '.rpm': 'RedHat Package',

        '.exe': 'Windows Executable', '.msi': 'Windows Installer', '.bin': 'Binary File', '.dll': 'Dynamic Link Library',
        '.so': 'Shared Object', '.dmg': 'Apple Disk Image', '.app': 'macOS Application', '.sys': 'System File',
        '.cur': 'Windows Cursor', '.lnk': 'Windows Shortcut', '.reg': 'Windows Registry File',

        '.obj': '3D Object', '.stl': 'Stereolithography 3D', '.fbx': 'Filmbox 3D', '.blend': 'Blender Project',
        '.dae': 'Collada 3D', '.gltf': 'GL Transmission Format', '.glb': 'Binary glTF', '.step': 'STEP 3D Model',
        '.dwg': 'AutoCAD Drawing', '.dxf': 'Drawing Exchange Format',

        '.ttf': 'TrueType Font', '.otf': 'OpenType Font', '.woff': 'Web Font', '.woff2': 'Web Font 2.0',
        '.eot': 'Embedded OpenType'
    };
    return types[e] || e.slice(1).toUpperCase();
}

app.get(/^(.*)$/, (req, res) => {
    const relativePath = decodeURIComponent(req.params[0] || '/');
    const absolutePath = path.join(__dirname, relativePath);

    if (!absolutePath.startsWith(__dirname)) return res.status(403).send("Forbidden");

    const pathParts = relativePath.split('/').filter(p => p);
    const isRestricted = pathParts.some(part =>
        part.startsWith('.') || hiddenFiles.includes(part.toLowerCase())
    );

    if (isRestricted) {
        console.error(`[SECURITY] Blocked access attempt to: ${relativePath}`);
        return sendForbidden(res, "Access to system or hidden files is restricted.");
    }

    try {
        if (!fs.existsSync(absolutePath)) return res.status(404).send("Not Found");
        const stats = fs.statSync(absolutePath);

        if (stats.isDirectory()) {
            const items = fs.readdirSync(absolutePath, { withFileTypes: true });

            let breadcrumbHtml = `<a href="/">root</a>`;
            let currentLink = '';
            pathParts.forEach(part => {
                currentLink += `/${part}`;
                breadcrumbHtml += ` / <a href="${currentLink}">${part}</a>`;
            });

            const rows = items
                .filter(item => !item.name.startsWith('.') && !hiddenFiles.includes(item.name.toLowerCase()))
                .map(item => {
                    const s = fs.statSync(path.join(absolutePath, item.name));
                    const ext = path.extname(item.name);
                    const detailedType = getDetailedType(item, ext);
                    const link = path.join(relativePath, item.name);
                    const isNew = (Date.now() - s.mtime.getTime()) < 86400000;

                    return `
                        <tr data-name="${item.name.toLowerCase()}" data-size="${s.size}" 
                            data-mtime="${s.mtime.getTime()}" data-atime="${s.atime.getTime()}" 
                            data-ctime="${s.birthtime.getTime()}" data-type="${detailedType}">
                            <td class="col-name">${item.isDirectory() ? '📂' : '📄'} <a href="${link}${item.isDirectory() ? '/' : ''}">${item.name}</a></td>
                            <td class="col-size mono">${item.isDirectory() ? (items.length + ' items') : formatBytes(s.size)}</td>
                            <td class="col-kind">${item.isDirectory() ? 'Folder' : 'File'}</td>
                            <td class="col-modified mono">${s.mtime.toISOString().split('T')[0]}</td>
                            <td class="col-accessed mono">${s.atime.toISOString().split('T')[0]}</td>
                            <td class="col-created mono">${s.birthtime.toISOString().split('T')[0]}</td>
                            <td class="col-recency">${isNew ? '⭐' : ''}</td>
                            <td class="col-detailed-type">${detailedType}</td>
                        </tr>`;
                }).join('');

            res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Glacier - ${relativePath}</title>
    <style>
        :root { --bg: #1a1a1a; --text: #cccccc; --border: #333333; --hover: #2a2a2a; --row-alt: #1f1f1f; --subtle: #888888; }
        body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; font-size: 11px; }
        .nav-bar { padding: 6px 15px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
        .breadcrumbs { color: var(--subtle); }
        .breadcrumbs a { color: var(--text); text-decoration: none; }
        .controls { display: flex; align-items: center; gap: 8px; }
        input#search { background: #111; border: 1px solid var(--border); padding: 3px 6px; width: 150px; color: var(--text); font-size: 11px; outline: none; border-radius: 2px; }
        .settings-btn { background: none; border: 1px solid var(--border); color: var(--text); padding: 2px 5px; cursor: pointer; border-radius: 2px; }
        .dropdown { position: absolute; right: 15px; top: 35px; background: var(--bg); border: 1px solid var(--border); padding: 10px; display: none; width: 160px; z-index: 200; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        .dropdown.show { display: block; }
        .dropdown label { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer; color: var(--subtle); }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); color: var(--subtle); font-weight: normal; cursor: pointer; white-space: nowrap; background: var(--bg); position: sticky; top: 32px; }
        th:hover { background: var(--hover); }
        .sort-icon { font-size: 9px; margin-left: 4px; color: #fff; }
        td { padding: 5px 12px; border-bottom: 1px solid transparent; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        tr:nth-child(even) { background: var(--row-alt); }
        tr:hover td { background: var(--hover); }
        a { color: var(--text); text-decoration: none; }
        .mono { font-family: ui-monospace, monospace; color: var(--subtle); }
        .col-name { width: 30%; } .col-size { width: 85px; } .col-kind { width: 60px; }
        .col-modified { width: 90px; } .col-accessed { width: 90px; } .col-created { width: 90px; }
        .col-recency { width: 50px; text-align: center; } .col-detailed-type { width: 130px; }
        .hidden { display: none !important; }
    </style>
</head>
<body>
    <div class="nav-bar">
        <div class="breadcrumbs">${breadcrumbHtml}</div>
        <div class="controls">
            <input type="text" id="search" placeholder="Filter..." autocomplete="off">
            <button class="settings-btn" id="settingsToggle">⚙</button>
            <div class="dropdown" id="settingsDropdown">
                <label><input type="checkbox" checked data-col="col-size"> Size</label>
                <label><input type="checkbox" checked data-col="col-kind"> Type</label>
                <label><input type="checkbox" checked data-col="col-modified"> Modified</label>
                <label><input type="checkbox" data-col="col-accessed"> Accessed</label>
                <label><input type="checkbox" data-col="col-created"> Created</label>
                <label><input type="checkbox" data-col="col-recency"> Recency</label>
                <label><input type="checkbox" checked data-col="col-detailed-type"> Detailed Type</label>
            </div>
        </div>
    </div>
    <table>
        <thead>
            <tr>
                <th class="col-name" onclick="resort(0)">Name<span class="sort-icon"></span></th>
                <th class="col-size" onclick="resort(1)">Size<span class="sort-icon"></span></th>
                <th class="col-kind" onclick="resort(2)">Type<span class="sort-icon"></span></th>
                <th class="col-modified" onclick="resort(3)">Modified<span class="sort-icon"></span></th>
                <th class="col-accessed hidden" onclick="resort(4)">Accessed<span class="sort-icon"></span></th>
                <th class="col-created hidden" onclick="resort(5)">Created<span class="sort-icon"></span></th>
                <th class="col-recency hidden" onclick="resort(6)">Recency<span class="sort-icon"></span></th>
                <th class="col-detailed-type" onclick="resort(7)">Detailed Type<span class="sort-icon"></span></th>
            </tr>
        </thead>
        <tbody id="file-list">${rows}</tbody>
    </table>
    <script>
        const search = document.getElementById('search');
        const list = document.getElementById('file-list');
        const headers = Array.from(document.querySelectorAll('th'));

        search.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            Array.from(list.children).forEach(row => { 
                row.style.display = row.dataset.name.includes(term) ? '' : 'none'; 
            });
        });

        function resort(idx) {
            const rows = Array.from(list.children);
            const dir = list.dataset.order === 'asc' ? -1 : 1;
            list.dataset.order = dir === 1 ? 'asc' : 'desc';
            headers.forEach((h, i) => {
                const icon = h.querySelector('.sort-icon');
                if(icon) icon.innerText = i === idx ? (dir === 1 ? ' ▲' : ' ▼') : '';
            });
            const sorted = rows.sort((a, b) => {
                let vA, vB;
                if (idx === 1) [vA, vB] = [parseInt(a.dataset.size), parseInt(b.dataset.size)];
                else if (idx === 3) [vA, vB] = [parseInt(a.dataset.mtime), parseInt(b.dataset.mtime)];
                else if (idx === 4) [vA, vB] = [parseInt(a.dataset.atime), parseInt(b.dataset.atime)];
                else if (idx === 5) [vA, vB] = [parseInt(a.dataset.ctime), parseInt(b.dataset.ctime)];
                else [vA, vB] = [a.children[idx].innerText.toLowerCase(), b.children[idx].innerText.toLowerCase()];
                return vA > vB ? (1 * dir) : (-1 * dir);
            });
            sorted.forEach(r => list.appendChild(r));
        }

        document.getElementById('settingsToggle').onclick = (e) => {
            e.stopPropagation();
            document.getElementById('settingsDropdown').classList.toggle('show');
        };
        
        document.querySelectorAll('#settingsDropdown input').forEach(cb => {
            cb.onchange = () => {
                const colClass = cb.dataset.col;
                document.querySelectorAll('.' + colClass).forEach(el => el.classList.toggle('hidden', !cb.checked));
            };
        });

        document.onclick = () => document.getElementById('settingsDropdown').classList.remove('show');
    </script>
</body>
</html>`);
        } else {
            res.sendFile(absolutePath);
        }
    } catch (e) {
        console.error(e);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INFO] Server running on port ${PORT}`);
});