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

// ─── Shared HTML Shell ───────────────────────────────────────────────────────

const sharedStyles = `
    :root {
        --bg:       #111111;
        --surface:  #171717;
        --border:   #2a2a2a;
        --hover:    #1e1e1e;
        --row-alt:  #141414;
        --text:     #c8c8c8;
        --subtle:   #555555;
        --accent:   #4a7eba;
        --danger:   #c0392b;
        --warning:  #e67e22;
        --success:  #27ae60;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
        font-size: 12px;
        min-height: 100vh;
    }
    a { color: var(--text); text-decoration: none; }
    a:hover { color: #ffffff; }
    .mono { font-family: ui-monospace, "SF Mono", "Cascadia Code", "Fira Mono", monospace; }
`;

function errorPage({ status, title, message, suggestion = null, showHome = true }) {
    const statusColour = status >= 500 ? 'var(--danger)' : status === 403 ? 'var(--warning)' : 'var(--subtle)';
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${status} — Glacier</title>
    <style>
        ${sharedStyles}
        .error-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            gap: 12px;
            text-align: center;
            padding: 40px 20px;
        }
        .status-code {
            font-size: 72px;
            font-weight: 700;
            letter-spacing: -4px;
            color: ${statusColour};
            line-height: 1;
            font-variant-numeric: tabular-nums;
        }
        .divider {
            width: 40px;
            height: 1px;
            background: var(--border);
        }
        .error-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text);
            letter-spacing: 0.02em;
        }
        .error-message {
            font-size: 12px;
            color: var(--subtle);
            max-width: 360px;
            line-height: 1.6;
        }
        .error-suggestion {
            font-size: 11px;
            color: var(--subtle);
            font-family: ui-monospace, monospace;
            background: var(--surface);
            border: 1px solid var(--border);
            padding: 6px 12px;
            border-radius: 3px;
        }
        .btn-home {
            margin-top: 8px;
            display: inline-block;
            padding: 6px 18px;
            border: 1px solid var(--border);
            border-radius: 3px;
            color: var(--text);
            font-size: 11px;
            font-family: system-ui, sans-serif;
            background: var(--surface);
            cursor: pointer;
            transition: border-color 0.15s, background 0.15s;
        }
        .btn-home:hover {
            border-color: #444;
            background: var(--hover);
            color: #fff;
        }
    </style>
</head>
<body>
    <div class="error-wrap">
        <div class="status-code">${status}</div>
        <div class="divider"></div>
        <div class="error-title">${title}</div>
        <p class="error-message">${message}</p>
        ${suggestion ? `<div class="error-suggestion">${suggestion}</div>` : ''}
        ${showHome ? `<a class="btn-home" href="/">Return to root</a>` : ''}
    </div>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
        '.yml': 'YAML Config', '.xml': 'XML Document', '.sql': 'SQL Script', '.dart': 'Dart Source',
        '.swift': 'Swift Source', '.kt': 'Kotlin Source', '.lua': 'Lua Script', '.pl': 'Perl Script',
        '.ini': 'INI Config', '.env': 'Environment Variables', '.toml': 'TOML Config', '.vbs': 'VBScript',
        '.dockerfile': 'Docker Config', '.makefile': 'Make Script',

        '.mp3': 'MP3 Audio', '.wav': 'WAV Audio', '.flac': 'FLAC Audio', '.ogg': 'Ogg Vorbis',
        '.m4a': 'MPEG-4 Audio', '.aac': 'AAC Audio', '.wma': 'Windows Media Audio', '.mid': 'MIDI',
        '.midi': 'MIDI', '.aif': 'AIFF Audio', '.opus': 'Opus Audio',

        '.mp4': 'MP4 Video', '.mkv': 'Matroska Video', '.mov': 'QuickTime Video', '.avi': 'AVI Video',
        '.wmv': 'Windows Media Video', '.flv': 'Flash Video', '.webm': 'WebM Video', '.m4v': 'M4V Video',
        '.mpeg': 'MPEG Video', '.mpg': 'MPEG Video', '.3gp': '3GP Video',

        '.zip': 'ZIP Archive', '.rar': 'RAR Archive', '.tar': 'Tarball', '.gz': 'Gzip Archive',
        '.7z': '7-Zip Archive', '.bz2': 'Bzip2 Archive', '.xz': 'XZ Archive', '.iso': 'Disc Image',
        '.pkg': 'macOS Package', '.deb': 'Debian Package', '.rpm': 'RPM Package',

        '.exe': 'Windows Executable', '.msi': 'Windows Installer', '.bin': 'Binary', '.dll': 'Dynamic Library',
        '.so': 'Shared Object', '.dmg': 'Apple Disk Image', '.app': 'macOS Application',
        '.sys': 'System File', '.lnk': 'Windows Shortcut', '.reg': 'Registry File',

        '.obj': '3D Object', '.stl': 'STL 3D Model', '.fbx': 'Filmbox 3D', '.blend': 'Blender Project',
        '.dae': 'Collada 3D', '.gltf': 'glTF 3D', '.glb': 'Binary glTF',
        '.dwg': 'AutoCAD Drawing', '.dxf': 'Drawing Exchange',

        '.ttf': 'TrueType Font', '.otf': 'OpenType Font', '.woff': 'Web Font', '.woff2': 'Web Font 2.0',
    };
    return types[e] || (e.slice(1).toUpperCase() + ' File');
}

// ─── Route ───────────────────────────────────────────────────────────────────

app.get(/^(.*)$/, (req, res) => {
    let relativePath;
    try {
        relativePath = decodeURIComponent(req.params[0] || '/');
    } catch {
        return res.status(400).send(errorPage({
            status: 400,
            title: 'Bad Request',
            message: 'The URL could not be decoded. It may contain invalid percent-encoded characters.',
        }));
    }

    const absolutePath = path.join(__dirname, relativePath);

    // Path traversal guard
    if (!absolutePath.startsWith(__dirname + path.sep) && absolutePath !== __dirname) {
        console.warn(`[SECURITY] Path traversal attempt: ${relativePath}`);
        return res.status(403).send(errorPage({
            status: 403,
            title: 'Forbidden',
            message: 'Access outside the server root is not permitted.',
        }));
    }

    const pathParts = relativePath.split('/').filter(Boolean);
    const isRestricted = pathParts.some(part =>
        part.startsWith('.') || hiddenFiles.includes(part.toLowerCase())
    );

    if (isRestricted) {
        console.warn(`[SECURITY] Blocked restricted path: ${relativePath}`);
        return res.status(403).send(errorPage({
            status: 403,
            title: 'Forbidden',
            message: 'Access to system files, hidden files, and server internals is restricted.',
            suggestion: relativePath,
        }));
    }

    try {
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).send(errorPage({
                status: 404,
                title: 'Not Found',
                message: 'The file or directory you requested does not exist on this server.',
                suggestion: relativePath,
            }));
        }

        const stats = fs.statSync(absolutePath);

        // ── Directory listing ──────────────────────────────────────────────
        if (stats.isDirectory()) {
            let items;
            try {
                items = fs.readdirSync(absolutePath, { withFileTypes: true });
            } catch {
                return res.status(500).send(errorPage({
                    status: 500,
                    title: 'Internal Server Error',
                    message: 'The directory could not be read. Check server permissions.',
                }));
            }

            // Breadcrumbs
            let breadcrumbHtml = `<a href="/">root</a>`;
            let currentLink = '';
            pathParts.forEach(part => {
                currentLink += `/${part}`;
                breadcrumbHtml += ` <span class="sep">/</span> <a href="${currentLink}">${part}</a>`;
            });

            const visibleItems = items.filter(
                item => !item.name.startsWith('.') && !hiddenFiles.includes(item.name.toLowerCase())
            );

            const rows = visibleItems.map(item => {
                let s;
                try {
                    s = fs.statSync(path.join(absolutePath, item.name));
                } catch {
                    return '';
                }
                const ext = path.extname(item.name);
                const detailedType = getDetailedType(item, ext);
                const link = path.join(relativePath, item.name);
                const isNew = (Date.now() - s.mtime.getTime()) < 86400000;
                const icon = item.isDirectory() ? '▸' : '·';
                const sizeDisplay = item.isDirectory()
                    ? `${visibleItems.filter(i => i.name !== item.name || true).length > 0 ? '—' : '—'}`
                    : formatBytes(s.size);

                return `<tr
                    data-name="${item.name.toLowerCase()}"
                    data-size="${item.isDirectory() ? -1 : s.size}"
                    data-mtime="${s.mtime.getTime()}"
                    data-atime="${s.atime.getTime()}"
                    data-ctime="${s.birthtime.getTime()}"
                    data-type="${detailedType}">
                    <td class="col-name">
                        <span class="icon ${item.isDirectory() ? 'icon-dir' : 'icon-file'}">${icon}</span>
                        <a href="${link}${item.isDirectory() ? '/' : ''}">${item.name}</a>
                    </td>
                    <td class="col-size mono">${item.isDirectory() ? '—' : formatBytes(s.size)}</td>
                    <td class="col-kind">${item.isDirectory() ? 'Folder' : 'File'}</td>
                    <td class="col-modified mono">${s.mtime.toISOString().split('T')[0]}</td>
                    <td class="col-accessed mono hidden">${s.atime.toISOString().split('T')[0]}</td>
                    <td class="col-created mono hidden">${s.birthtime.toISOString().split('T')[0]}</td>
                    <td class="col-recency hidden">${isNew ? '●' : ''}</td>
                    <td class="col-detailed-type">${detailedType}</td>
                </tr>`;
            }).join('');

            const emptyState = visibleItems.length === 0
                ? `<tr><td colspan="8" class="empty">This directory is empty.</td></tr>`
                : '';

            return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Glacier — ${relativePath}</title>
    <style>
        ${sharedStyles}

        /* Layout */
        .nav-bar {
            padding: 0 16px;
            height: 36px;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .breadcrumbs {
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--subtle);
            font-size: 11px;
        }
        .breadcrumbs a {
            color: var(--text);
            padding: 2px 4px;
            border-radius: 2px;
        }
        .breadcrumbs a:hover { background: var(--hover); color: #fff; }
        .sep { color: var(--border); user-select: none; }

        /* Controls */
        .controls { display: flex; align-items: center; gap: 6px; }
        #search {
            background: var(--bg);
            border: 1px solid var(--border);
            padding: 3px 8px;
            width: 160px;
            color: var(--text);
            font-size: 11px;
            font-family: system-ui, sans-serif;
            outline: none;
            border-radius: 2px;
            transition: border-color 0.15s;
        }
        #search:focus { border-color: var(--accent); }
        #search::placeholder { color: var(--subtle); }
        .settings-btn {
            background: none;
            border: 1px solid var(--border);
            color: var(--subtle);
            width: 26px;
            height: 22px;
            font-size: 13px;
            cursor: pointer;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: border-color 0.15s, color 0.15s;
            font-family: system-ui, sans-serif;
        }
        .settings-btn:hover { border-color: #444; color: var(--text); }

        /* Dropdown */
        .dropdown {
            position: absolute;
            right: 16px;
            top: 40px;
            background: var(--surface);
            border: 1px solid var(--border);
            padding: 8px 0;
            display: none;
            width: 180px;
            z-index: 200;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            border-radius: 3px;
        }
        .dropdown.show { display: block; }
        .dropdown-section {
            padding: 4px 12px 2px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--subtle);
        }
        .dropdown label {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 5px 12px;
            cursor: pointer;
            color: var(--text);
            font-size: 11px;
            font-family: system-ui, sans-serif;
            transition: background 0.1s;
        }
        .dropdown label:hover { background: var(--hover); }
        .dropdown input[type="checkbox"] { accent-color: var(--accent); }

        /* Table */
        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        thead { position: sticky; top: 36px; z-index: 50; }
        th {
            text-align: left;
            padding: 7px 12px;
            border-bottom: 1px solid var(--border);
            color: var(--subtle);
            font-weight: 500;
            font-size: 10.5px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            cursor: pointer;
            white-space: nowrap;
            background: var(--surface);
            user-select: none;
            transition: background 0.1s, color 0.1s;
        }
        th:hover { background: var(--hover); color: var(--text); }
        th.sorted { color: var(--accent); }
        .sort-icon { font-size: 8px; margin-left: 4px; opacity: 0.8; }
        td {
            padding: 5px 12px;
            border-bottom: 1px solid transparent;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            line-height: 1.4;
        }
        tr:nth-child(even) td { background: var(--row-alt); }
        tr:hover td { background: var(--hover) !important; }
        tr:hover .col-name a { color: #ffffff; }

        /* Icons */
        .icon {
            display: inline-block;
            width: 14px;
            text-align: center;
            margin-right: 4px;
            font-size: 11px;
        }
        .icon-dir { color: var(--accent); }
        .icon-file { color: var(--subtle); }

        /* Column widths */
        .col-name         { width: 35%; }
        .col-size         { width: 80px;  color: var(--subtle); }
        .col-kind         { width: 64px;  color: var(--subtle); }
        .col-modified     { width: 96px;  }
        .col-accessed     { width: 96px;  }
        .col-created      { width: 96px;  }
        .col-recency      { width: 52px;  text-align: center; color: var(--accent); }
        .col-detailed-type { width: 140px; color: var(--subtle); }

        .hidden { display: none !important; }

        /* Empty state */
        .empty {
            text-align: center;
            color: var(--subtle);
            padding: 48px 0;
        }

        /* Status bar */
        .status-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 22px;
            background: var(--surface);
            border-top: 1px solid var(--border);
            display: flex;
            align-items: center;
            padding: 0 16px;
            font-size: 10px;
            color: var(--subtle);
            gap: 16px;
        }
        .status-bar span { display: flex; align-items: center; gap: 4px; }
    </style>
</head>
<body>
    <div class="nav-bar">
        <div class="breadcrumbs">${breadcrumbHtml}</div>
        <div class="controls">
            <input type="text" id="search" placeholder="Filter…" autocomplete="off" spellcheck="false">
            <button class="settings-btn" id="settingsToggle" title="Column settings">⊞</button>
            <div class="dropdown" id="settingsDropdown">
                <div class="dropdown-section">Columns</div>
                <label><input type="checkbox" checked data-col="col-size"> Size</label>
                <label><input type="checkbox" checked data-col="col-kind"> Type</label>
                <label><input type="checkbox" checked data-col="col-modified"> Modified</label>
                <label><input type="checkbox" data-col="col-accessed"> Accessed</label>
                <label><input type="checkbox" data-col="col-created"> Created</label>
                <label><input type="checkbox" data-col="col-recency"> Recent</label>
                <label><input type="checkbox" checked data-col="col-detailed-type"> Detailed Type</label>
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th class="col-name" onclick="resort(0, this)">Name <span class="sort-icon"></span></th>
                <th class="col-size" onclick="resort(1, this)">Size <span class="sort-icon"></span></th>
                <th class="col-kind" onclick="resort(2, this)">Type <span class="sort-icon"></span></th>
                <th class="col-modified" onclick="resort(3, this)">Modified <span class="sort-icon"></span></th>
                <th class="col-accessed hidden" onclick="resort(4, this)">Accessed <span class="sort-icon"></span></th>
                <th class="col-created hidden" onclick="resort(5, this)">Created <span class="sort-icon"></span></th>
                <th class="col-recency hidden" onclick="resort(6, this)">Recent <span class="sort-icon"></span></th>
                <th class="col-detailed-type" onclick="resort(7, this)">Detailed Type <span class="sort-icon"></span></th>
            </tr>
        </thead>
        <tbody id="file-list">${rows}${emptyState}</tbody>
    </table>

    <div class="status-bar">
        <span id="item-count">${visibleItems.length} item${visibleItems.length !== 1 ? 's' : ''}</span>
        <span id="filter-status" style="display:none;">— <span id="filter-count"></span> visible</span>
    </div>

    <script>
        const search = document.getElementById('search');
        const list   = document.getElementById('file-list');
        const allHeaders = Array.from(document.querySelectorAll('th'));
        let currentSortIdx = -1;
        let sortDir = 1;

        // Filter
        search.addEventListener('input', () => {
            const term = search.value.toLowerCase();
            let visible = 0;
            Array.from(list.children).forEach(row => {
                if (!row.dataset.name) return;
                const show = row.dataset.name.includes(term);
                row.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            const status = document.getElementById('filter-status');
            const count  = document.getElementById('filter-count');
            if (term) {
                status.style.display = '';
                count.textContent = visible + ' visible';
            } else {
                status.style.display = 'none';
            }
        });

        // Sort
        function resort(idx, thEl) {
            if (currentSortIdx === idx) {
                sortDir *= -1;
            } else {
                sortDir = 1;
                currentSortIdx = idx;
            }

            allHeaders.forEach(h => {
                h.classList.remove('sorted');
                const icon = h.querySelector('.sort-icon');
                if (icon) icon.innerText = '';
            });
            thEl.classList.add('sorted');
            const icon = thEl.querySelector('.sort-icon');
            if (icon) icon.innerText = sortDir === 1 ? '▲' : '▼';

            const rows = Array.from(list.children).filter(r => r.dataset.name);
            const sorted = rows.sort((a, b) => {
                let vA, vB;
                switch (idx) {
                    case 1: [vA, vB] = [parseInt(a.dataset.size), parseInt(b.dataset.size)]; break;
                    case 3: [vA, vB] = [parseInt(a.dataset.mtime), parseInt(b.dataset.mtime)]; break;
                    case 4: [vA, vB] = [parseInt(a.dataset.atime), parseInt(b.dataset.atime)]; break;
                    case 5: [vA, vB] = [parseInt(a.dataset.ctime), parseInt(b.dataset.ctime)]; break;
                    default: [vA, vB] = [
                        a.children[idx]?.innerText.toLowerCase() ?? '',
                        b.children[idx]?.innerText.toLowerCase() ?? ''
                    ];
                }
                return vA > vB ? sortDir : vA < vB ? -sortDir : 0;
            });
            sorted.forEach(r => list.appendChild(r));
        }

        // Settings dropdown
        document.getElementById('settingsToggle').onclick = (e) => {
            e.stopPropagation();
            document.getElementById('settingsDropdown').classList.toggle('show');
        };
        document.querySelectorAll('#settingsDropdown input').forEach(cb => {
            cb.onchange = () => {
                const cls = cb.dataset.col;
                document.querySelectorAll('.' + cls).forEach(el => el.classList.toggle('hidden', !cb.checked));
            };
        });
        document.addEventListener('click', () => {
            document.getElementById('settingsDropdown').classList.remove('show');
        });

        // Keyboard shortcut: focus search on '/'
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && document.activeElement !== search) {
                e.preventDefault();
                search.focus();
            }
            if (e.key === 'Escape') search.value = '' && search.dispatchEvent(new Event('input'));
        });
    </script>
</body>
</html>`);
        }

        // ── File serving ───────────────────────────────────────────────────
        res.sendFile(absolutePath, (err) => {
            if (err && !res.headersSent) {
                console.error(`[ERROR] Failed to send file: ${absolutePath}`, err);
                res.status(500).send(errorPage({
                    status: 500,
                    title: 'Internal Server Error',
                    message: 'The file could not be sent. It may be unreadable or a server fault has occurred.',
                    suggestion: relativePath,
                }));
            }
        });

    } catch (err) {
        console.error(`[ERROR] Unhandled exception for path: ${relativePath}`, err);
        if (!res.headersSent) {
            res.status(500).send(errorPage({
                status: 500,
                title: 'Internal Server Error',
                message: 'An unexpected error occurred. Check the server logs for details.',
            }));
        }
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INFO] Glacier running on port ${PORT}`);
});