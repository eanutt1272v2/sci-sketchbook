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
    'yarn.lock',
    'pnpm-lock.yaml',
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'Makefile',
    'secrets.json',
    'credentials.json',
    'favicon.ico'
];

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function getIconSvg(item, ext) {
    const e = ext ? ext.toLowerCase() : '';

    const ic = (body) =>
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"' +
        ' style="display:inline-block;flex-shrink:0;vertical-align:middle;margin-right:7px">' +
        body + '</svg>';

    const doc = (color, label) => {
        const shape =
            '<path d="M3 1.5H9.5L13 5V14.5H3V1.5Z" stroke="' + color + '" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<path d="M9.5 1.5V5H13" stroke="' + color + '" stroke-width="1.2" stroke-linejoin="round"/>';
        const text = label
            ? '<text x="8" y="11.5" text-anchor="middle" font-size="3.6" fill="' + color + '"' +
              ' font-family="system-ui,-apple-system,sans-serif" font-weight="700" letter-spacing="0.2">' +
              label + '</text>'
            : '';
        return ic(shape + text);
    };

    if (item.isDirectory()) {
        return ic(
            '<path d="M1.5 5.5C1.5 4.95 1.95 4.5 2.5 4.5H6.29C6.55 4.5 6.8 4.61 6.99 4.79L7.7 5.5H13.5' +
            'C14.05 5.5 14.5 5.95 14.5 6.5V12C14.5 12.55 14.05 13 13.5 13H2.5C1.95 13 1.5 12.55 1.5 12V5.5Z"' +
            ' fill="#4a7eba" fill-opacity="0.88"/>' +
            '<path d="M1.5 6.5H14.5" stroke="#4a7eba" stroke-width="0.5" stroke-opacity="0.4"/>'
        );
    }

    if (['.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff','.tif',
         '.ico','.heic','.raw','.cr2','.nef','.psd','.ai','.eps','.svg',
         '.indd'].includes(e)) {
        return ic(
            '<rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke="#a855f7" stroke-width="1.2"/>' +
            '<circle cx="5.5" cy="6.2" r="1.3" fill="#a855f7"/>' +
            '<path d="M1.5 10.5L5 7.5L7.5 9.8L10.5 6.8L14.5 11" stroke="#a855f7"' +
            ' stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>'
        );
    }

    if (['.mp4','.mkv','.mov','.avi','.wmv','.flv','.webm','.m4v',
         '.mpeg','.mpg','.3gp'].includes(e)) {
        return ic(
            '<rect x="1" y="3.5" width="10" height="9" rx="1" stroke="#ef4444" stroke-width="1.2"/>' +
            '<path d="M11 6.5L15 4.5V11.5L11 9.5V6.5Z" stroke="#ef4444" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<line x1="3.5" y1="1.5" x2="3.5" y2="3.5" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/>' +
            '<line x1="6" y1="1.5" x2="6" y2="3.5" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/>' +
            '<line x1="8.5" y1="1.5" x2="8.5" y2="3.5" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/>'
        );
    }

    if (['.mp3','.wav','.flac','.ogg','.m4a','.aac','.wma','.mid',
         '.midi','.aif','.aiff','.opus'].includes(e)) {
        return ic(
            '<path d="M8.5 3L5 5.5H2.5C2 5.5 1.5 6 1.5 6.5V9.5C1.5 10 2 10.5 2.5 10.5H5L8.5 13V3Z"' +
            ' stroke="#ec4899" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<path d="M11 5.5C12.2 6.7 12.2 9.3 11 10.5" stroke="#ec4899" stroke-width="1.2" stroke-linecap="round"/>' +
            '<path d="M13.2 3.5C15.6 5.9 15.6 10.1 13.2 12.5" stroke="#ec4899" stroke-width="1.2" stroke-linecap="round"/>'
        );
    }

    if (e === '.pdf') {
        return ic(
            '<path d="M3 1.5H9.5L13 5V14.5H3V1.5Z" stroke="#ef4444" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<path d="M9.5 1.5V5H13" stroke="#ef4444" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<text x="8" y="11.5" text-anchor="middle" font-size="3.8" fill="#ef4444"' +
            ' font-family="system-ui,-apple-system,sans-serif" font-weight="700">PDF</text>'
        );
    }

    if (['.doc','.docx','.dotx','.odt','.pages'].includes(e)) return doc('#3b82f6', 'DOC');

    if (['.xls','.xlsx','.xlsm','.ods','.numbers'].includes(e)) {
        return ic(
            '<path d="M3 1.5H9.5L13 5V14.5H3V1.5Z" stroke="#22c55e" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<path d="M9.5 1.5V5H13" stroke="#22c55e" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<line x1="5" y1="7.5" x2="11" y2="7.5" stroke="#22c55e" stroke-width="0.9"/>' +
            '<line x1="5" y1="9.5" x2="11" y2="9.5" stroke="#22c55e" stroke-width="0.9"/>' +
            '<line x1="5" y1="11.5" x2="11" y2="11.5" stroke="#22c55e" stroke-width="0.9"/>' +
            '<line x1="8" y1="7" x2="8" y2="12" stroke="#22c55e" stroke-width="0.9"/>'
        );
    }
    if (e === '.csv') return doc('#22c55e', 'CSV');

    if (['.ppt','.pptx','.ppsx','.odp'].includes(e)) return doc('#f97316', 'PPT');
    if (e === '.key') return doc('#f97316', 'KEY');

    if (['.txt','.rtf','.nfo'].includes(e)) {
        return ic(
            '<path d="M3 1.5H9.5L13 5V14.5H3V1.5Z" stroke="#94a3b8" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<path d="M9.5 1.5V5H13" stroke="#94a3b8" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<line x1="5" y1="7.5" x2="11" y2="7.5" stroke="#94a3b8" stroke-width="1"/>' +
            '<line x1="5" y1="9.5" x2="11" y2="9.5" stroke="#94a3b8" stroke-width="1"/>' +
            '<line x1="5" y1="11.5" x2="9" y2="11.5" stroke="#94a3b8" stroke-width="1"/>'
        );
    }
    if (['.md','.mdx'].includes(e)) return doc('#94a3b8', 'MD');
    if (e === '.epub') return doc('#94a3b8', 'EPUB');

    if (['.js','.mjs','.cjs'].includes(e)) return doc('#eab308', 'JS');
    if (e === '.ts') return doc('#3b82f6', 'TS');
    if (e === '.jsx') return doc('#06b6d4', 'JSX');
    if (e === '.tsx') return doc('#06b6d4', 'TSX');

    if (['.py','.pyc','.pyw'].includes(e)) return doc('#3b82f6', 'PY');

    if (['.html','.htm'].includes(e)) return doc('#f97316', 'HTML');
    if (e === '.css') return doc('#38bdf8', 'CSS');
    if (e === '.scss') return doc('#ec4899', 'SCSS');
    if (e === '.less') return doc('#3b82f6', 'LESS');

    if (['.json','.jsonl'].includes(e)) return doc('#eab308', 'JSON');
    if (['.yaml','.yml'].includes(e)) return doc('#94a3b8', 'YML');
    if (e === '.toml') return doc('#94a3b8', 'TOML');
    if (['.ini','.env'].includes(e)) return doc('#94a3b8', 'ENV');
    if (e === '.xml') return doc('#f97316', 'XML');

    if (['.sh','.zsh','.bash','.fish'].includes(e)) {
        return ic(
            '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="#22c55e" stroke-width="1.2"/>' +
            '<path d="M4.5 6.5L7.5 8.5L4.5 10.5" stroke="#22c55e" stroke-width="1.2"' +
            ' stroke-linecap="round" stroke-linejoin="round"/>' +
            '<line x1="9" y1="10.5" x2="12" y2="10.5" stroke="#22c55e" stroke-width="1.2" stroke-linecap="round"/>'
        );
    }
    if (['.bat','.cmd'].includes(e)) return doc('#6b7280', 'BAT');
    if (e === '.ps1') return doc('#3b82f6', 'PS1');
    if (e === '.vbs') return doc('#6b7280', 'VBS');

    if (e === '.c') return doc('#38bdf8', 'C');
    if (e === '.h') return doc('#38bdf8', '.H');
    if (['.cpp','.cc','.cxx'].includes(e)) return doc('#38bdf8', 'C++');
    if (e === '.hpp') return doc('#38bdf8', 'HPP');

    if (e === '.cs') return doc('#a855f7', 'C#');
    if (['.java','.class'].includes(e)) return doc('#f97316', 'JAVA');
    if (e === '.go') return doc('#06b6d4', 'GO');
    if (e === '.rs') return doc('#f97316', 'RS');
    if (e === '.php') return doc('#a855f7', 'PHP');
    if (['.rb','.erb'].includes(e)) return doc('#ef4444', 'RB');
    if (e === '.swift') return doc('#f97316', 'SW');
    if (e === '.kt') return doc('#a855f7', 'KT');
    if (e === '.dart') return doc('#06b6d4', 'DRT');
    if (e === '.lua') return doc('#3b82f6', 'LUA');
    if (e === '.pl') return doc('#94a3b8', 'PL');

    if (e === '.sql') {
        return ic(
            '<ellipse cx="8" cy="4.5" rx="5" ry="2" stroke="#3b82f6" stroke-width="1.2"/>' +
            '<path d="M3 4.5V11.5C3 12.6 5.24 13.5 8 13.5C10.76 13.5 13 12.6 13 11.5V4.5"' +
            ' stroke="#3b82f6" stroke-width="1.2"/>' +
            '<path d="M3 8C3 9.1 5.24 10 8 10C10.76 10 13 9.1 13 8" stroke="#3b82f6" stroke-width="1.2"/>'
        );
    }

    if (e === '.dockerfile') return doc('#3b82f6', 'DOCK');

    if (['.zip','.rar','.tar','.gz','.7z','.bz2','.xz','.iso'].includes(e)) {
        return ic(
            '<rect x="2" y="5" width="12" height="9" rx="1" stroke="#d97706" stroke-width="1.2"/>' +
            '<path d="M5 5V3C5 2.45 5.45 2 6 2H10C10.55 2 11 2.45 11 3V5"' +
            ' stroke="#d97706" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<rect x="6.5" y="7" width="3" height="1.5" rx="0.5" stroke="#d97706" stroke-width="1"/>' +
            '<line x1="8" y1="8.5" x2="8" y2="11.5" stroke="#d97706" stroke-width="1" stroke-linecap="round"/>'
        );
    }
    if (['.pkg','.deb','.rpm'].includes(e)) return doc('#d97706', 'PKG');

    if (['.exe','.msi'].includes(e)) {
        return ic(
            '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="#6b7280" stroke-width="1.2"/>' +
            '<path d="M5 8L7.5 5.5L10 8" stroke="#6b7280" stroke-width="1.2"' +
            ' stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M7.5 5.5V11" stroke="#6b7280" stroke-width="1.2" stroke-linecap="round"/>'
        );
    }
    if (['.app','.dmg'].includes(e)) return doc('#6b7280', 'APP');
    if (['.bin','.dll','.so','.sys'].includes(e)) return doc('#6b7280', 'BIN');

    if (['.ttf','.otf','.woff','.woff2','.eot'].includes(e)) {
        return ic(
            '<rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke="#14b8a6" stroke-width="1.2"/>' +
            '<text x="8" y="11" text-anchor="middle" font-size="8" fill="#14b8a6"' +
            ' font-family="system-ui,-apple-system,sans-serif" font-weight="700">A</text>'
        );
    }

    if (['.obj','.stl','.fbx','.blend','.dae','.gltf','.glb','.step',
         '.dwg','.dxf'].includes(e)) {
        return ic(
            '<path d="M8 2L13.5 5V11L8 14L2.5 11V5L8 2Z" stroke="#06b6d4"' +
            ' stroke-width="1.2" stroke-linejoin="round"/>' +
            '<path d="M8 2V14" stroke="#06b6d4" stroke-width="0.8" stroke-opacity="0.5"/>' +
            '<path d="M2.5 5L8 8L13.5 5" stroke="#06b6d4" stroke-width="0.8" stroke-opacity="0.5"/>'
        );
    }

    return ic(
        '<path d="M3 1.5H9.5L13 5V14.5H3V1.5Z" stroke="#4b5563" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path d="M9.5 1.5V5H13" stroke="#4b5563" stroke-width="1.2" stroke-linejoin="round"/>'
    );
}

const ICON_SETTINGS =
    '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" fill="currentColor" d="M 6.50 2.81 L 6.60 1.06 L 8.41 1.06 L 8.50 2.81 A 4.8 4.8 0 0 1 11.07 4.29 L 12.62 3.50 L 13.53 5.07 L 12.07 6.02 A 4.8 4.8 0 0 1 12.07 8.98 L 13.53 9.94 L 12.62 11.50 L 11.07 10.71 A 4.8 4.8 0 0 1 8.50 12.20 L 8.41 13.94 L 6.60 13.94 L 6.50 12.20 A 4.8 4.8 0 0 1 3.93 10.71 L 2.38 11.50 L 1.47 9.94 L 2.94 8.98 A 4.8 4.8 0 0 1 2.94 6.02 L 1.47 5.07 L 2.38 3.50 L 3.93 4.29 A 4.8 4.8 0 0 1 6.50 2.81 Z M 9.50 7.50 A 2 2 0 1 1 5.50 7.50 A 2 2 0 1 1 9.50 7.50 Z"/></svg>';

const ICON_SORT_ASC =
    '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4 1.5L7 6.5H1L4 1.5Z" fill="currentColor"/></svg>';

const ICON_SORT_DESC =
    '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4 6.5L1 1.5H7L4 6.5Z" fill="currentColor"/></svg>';

const ICON_SEARCH =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="7.8" y1="7.8" x2="11" y2="11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

const sharedStyles =
    ':root{' +
    '--bg:#111111;--surface:#171717;--border:#262626;--hover:#1c1c1c;' +
    '--row-alt:#141414;--text:#c8c8c8;--subtle:#505050;--accent:#4a7eba;' +
    '--text-strong:#ffffff;' +
    '--danger:#c0392b;--warning:#d97706;--success:#22c55e;' +
    '}' +
    '@media(prefers-color-scheme:light){:root{' +
    '--bg:#f5f5f5;--surface:#ffffff;--border:#e0e0e0;--hover:#efefef;' +
    '--row-alt:#fafafa;--text:#1f1f1f;--subtle:#888888;--accent:#2563eb;' +
    '--text-strong:#000000;' +
    '--danger:#dc2626;--warning:#d97706;--success:#16a34a;' +
    '}}' +
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}' +
    'html,body{' +
    'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'background:var(--bg);color:var(--text);font-size:12px;min-height:100vh;' +
    '}' +
    'a{color:var(--text);text-decoration:none;}' +
    'a:hover{color:var(--text-strong);}' +
    '.mono{font-family:ui-monospace,"SF Mono","Cascadia Code","Fira Mono",monospace;}';

function errorPage({ status, title, message, suggestion = null, showHome = true }) {
    const c = status >= 500 ? 'var(--danger)' : status === 403 ? 'var(--warning)' : 'var(--subtle)';
    const safeSuggestion = suggestion ? escapeHtml(suggestion) : null;
    return '<!DOCTYPE html><html lang="en"><head>' +
        '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>' + status + ' \u2014 Sketchbook Web Server</title><style>' + sharedStyles +
        '.wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'min-height:100vh;gap:14px;text-align:center;padding:40px 20px;}' +
        '.code{font-size:80px;font-weight:700;letter-spacing:-5px;color:' + c + ';line-height:1;' +
        'font-variant-numeric:tabular-nums;}' +
        '.div{width:36px;height:1px;background:var(--border);}' +
        '.ttl{font-size:15px;font-weight:600;color:var(--text);}' +
        '.msg{font-size:12px;color:var(--subtle);max-width:380px;line-height:1.65;}' +
        '.sug{font-size:11px;color:var(--subtle);font-family:ui-monospace,monospace;' +
        'background:var(--surface);border:1px solid var(--border);padding:6px 14px;border-radius:3px;}' +
        '.btn{margin-top:4px;display:inline-block;padding:6px 20px;border:1px solid var(--border);' +
        'border-radius:3px;color:var(--text);font-size:11px;' +
        'font-family:system-ui,-apple-system,sans-serif;' +
        'background:var(--surface);transition:border-color .15s,background .15s;}' +
        '.btn:hover{border-color:#444;background:var(--hover);color:var(--text-strong);}' +
        '</style></head><body><div class="wrap">' +
        '<div class="code">' + status + '</div>' +
        '<div class="div"></div>' +
        '<div class="ttl">' + escapeHtml(title) + '</div>' +
        '<p class="msg">' + escapeHtml(message) + '</p>' +
        (safeSuggestion ? '<div class="sug">' + safeSuggestion + '</div>' : '') +
        (showHome ? '<a class="btn" href="/">Return to root</a>' : '') +
        '</div></body></html>';
}

function formatBytes(bytes) {
    if (bytes === -1) return '\u2014';
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + '\u00a0' + sizes[i];
}

function getDetailedType(item, ext) {
    if (item.isDirectory()) return 'Folder';
    if (!ext) return 'File';
    const e = ext.toLowerCase();
    const types = {
        '.jpg':'JPEG Image','.jpeg':'JPEG Image','.png':'PNG Image','.gif':'GIF Image',
        '.svg':'SVG Vector','.webp':'WebP Image','.ico':'Icon Resource','.bmp':'Bitmap Image',
        '.tiff':'TIFF Image','.tif':'TIFF Image','.psd':'Adobe Photoshop','.ai':'Adobe Illustrator',
        '.raw':'RAW Image','.cr2':'Canon RAW','.nef':'Nikon RAW','.heic':'HEIC Image',
        '.eps':'Encapsulated PostScript','.indd':'Adobe InDesign',
        '.pdf':'PDF Document','.doc':'Word Document','.docx':'Word Document','.dotx':'Word Template',
        '.txt':'Plain Text','.md':'Markdown','.rtf':'Rich Text','.csv':'CSV Data',
        '.xls':'Excel Spreadsheet','.xlsx':'Excel Spreadsheet','.xlsm':'Excel Macro-Enabled',
        '.ppt':'PowerPoint','.pptx':'PowerPoint','.ppsx':'PowerPoint Show',
        '.odt':'OpenDocument Text','.ods':'OpenDocument Spreadsheet','.odp':'OpenDocument Presentation',
        '.pages':'Apple Pages','.numbers':'Apple Numbers','.key':'Apple Keynote','.epub':'E-Book',
        '.js':'JavaScript','.mjs':'ES Module','.ts':'TypeScript','.tsx':'React TypeScript',
        '.jsx':'React JavaScript','.html':'HTML Document','.htm':'HTML Document','.css':'CSS Stylesheet',
        '.scss':'Sass Stylesheet','.less':'Less Stylesheet','.json':'JSON Data','.jsonl':'JSON Lines',
        '.py':'Python Script','.pyc':'Compiled Python','.cpp':'C++ Source','.hpp':'C++ Header',
        '.c':'C Source','.h':'C Header','.cs':'C# Source','.java':'Java Source','.class':'Java Bytecode',
        '.php':'PHP Script','.rb':'Ruby Script','.go':'Go Source','.rs':'Rust Source','.sh':'Shell Script',
        '.zsh':'Zsh Script','.bat':'Windows Batch','.ps1':'PowerShell','.yaml':'YAML Config',
        '.yml':'YAML Config','.xml':'XML Document','.sql':'SQL Script','.dart':'Dart Source',
        '.swift':'Swift Source','.kt':'Kotlin Source','.lua':'Lua Script','.pl':'Perl Script',
        '.ini':'INI Config','.env':'Environment Variables','.toml':'TOML Config','.vbs':'VBScript',
        '.dockerfile':'Docker Config','.mp3':'MP3 Audio','.wav':'WAV Audio','.flac':'FLAC Audio',
        '.ogg':'Ogg Vorbis','.m4a':'MPEG-4 Audio','.aac':'AAC Audio','.wma':'Windows Media Audio',
        '.mid':'MIDI','.midi':'MIDI','.aif':'AIFF Audio','.opus':'Opus Audio',
        '.mp4':'MP4 Video','.mkv':'Matroska Video','.mov':'QuickTime Video','.avi':'AVI Video',
        '.wmv':'Windows Media Video','.flv':'Flash Video','.webm':'WebM Video','.m4v':'M4V Video',
        '.mpeg':'MPEG Video','.mpg':'MPEG Video','.3gp':'3GP Video',
        '.zip':'ZIP Archive','.rar':'RAR Archive','.tar':'Tarball','.gz':'Gzip Archive',
        '.7z':'7-Zip Archive','.bz2':'Bzip2 Archive','.xz':'XZ Archive','.iso':'Disc Image',
        '.pkg':'macOS Package','.deb':'Debian Package','.rpm':'RPM Package',
        '.exe':'Windows Executable','.msi':'Windows Installer','.bin':'Binary','.dll':'Dynamic Library',
        '.so':'Shared Object','.dmg':'Apple Disk Image','.app':'macOS Application',
        '.sys':'System File','.lnk':'Windows Shortcut','.reg':'Registry File',
        '.obj':'3D Object','.stl':'STL 3D Model','.fbx':'Filmbox 3D','.blend':'Blender Project',
        '.dae':'Collada 3D','.gltf':'glTF 3D','.glb':'Binary glTF','.dwg':'AutoCAD Drawing',
        '.dxf':'Drawing Exchange','.ttf':'TrueType Font','.otf':'OpenType Font',
        '.woff':'Web Font','.woff2':'Web Font 2.0',
    };
    return types[e] || (e.slice(1).toUpperCase() + ' File');
}

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

    let absolutePath = path.join(__dirname, relativePath);

    try {
        if (fs.existsSync(absolutePath)) {
            absolutePath = fs.realpathSync(absolutePath);
        }
    } catch (e) {
        // fallback
    }

    if (!absolutePath.startsWith(__dirname + path.sep) && absolutePath !== __dirname) {
        console.warn('[SECURITY] Path traversal attempt:', relativePath);
        return res.status(403).send(errorPage({
            status: 403,
            title: 'Forbidden',
            message: 'Access outside the server root is not permitted.',
        }));
    }

    const pathParts = relativePath.split('/').filter(Boolean);
    const isRestricted = pathParts.some(p => p.startsWith('.') || hiddenFiles.includes(p.toLowerCase()));

    if (isRestricted) {
        console.warn('[SECURITY] Blocked restricted path:', relativePath);
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

            let breadcrumbHtml = '<a href="/">root</a>';
            let currentLink = '';
            pathParts.forEach(part => {
                currentLink += '/' + encodeURIComponent(part);
                breadcrumbHtml += ' <span class="sep">/</span> <a href="' + currentLink + '">' + escapeHtml(part) + '</a>';
            });

            const visibleItems = items.filter(
                item => !item.name.startsWith('.') && !hiddenFiles.includes(item.name.toLowerCase())
            );

            const rows = visibleItems.map(item => {
                let s;
                try { s = fs.statSync(path.join(absolutePath, item.name)); }
                catch { return ''; }
                const ext = path.extname(item.name);
                const detailedType = getDetailedType(item, ext);
                const link = path.posix.join(relativePath, item.name);
                const isNew = (Date.now() - s.mtime.getTime()) < 86400000;
                const icon = getIconSvg(item, ext);

                let sizeDisplay, sortSize;
                if (item.isDirectory()) {
                    try {
                        const sub = fs.readdirSync(path.join(absolutePath, item.name));
                        const count = sub.filter(n => !n.startsWith('.') && !hiddenFiles.includes(n.toLowerCase())).length;
                        sizeDisplay = count + '\u00a0' + (count === 1 ? 'item' : 'items');
                        sortSize = count;
                    } catch {
                        sizeDisplay = '\u2014';
                        sortSize = -1;
                    }
                } else {
                    sizeDisplay = formatBytes(s.size);
                    sortSize = s.size;
                }
                
                const safeName = escapeHtml(item.name);
                const safeLink = link.split('/').map(encodeURIComponent).join('/');

                return '<tr' +
                    ' data-name="' + safeName.toLowerCase() + '"' +
                    ' data-size="' + sortSize + '"' +
                    ' data-mtime="' + s.mtime.getTime() + '"' +
                    ' data-atime="' + s.atime.getTime() + '"' +
                    ' data-ctime="' + s.birthtime.getTime() + '"' +
                    ' data-type="' + escapeHtml(detailedType) + '">' +
                    '<td class="col-name"><div class="name-cell">' +
                    icon +
                    '<a href="/' + safeLink + (item.isDirectory() ? '/' : '') + '">' + safeName + '</a>' +
                    '</div></td>' +
                    '<td class="col-size mono">' + sizeDisplay + '</td>' +
                    '<td class="col-kind">' + (item.isDirectory() ? 'Folder' : 'File') + '</td>' +
                    '<td class="col-modified mono">' + s.mtime.toISOString().split('T')[0] + '</td>' +
                    '<td class="col-accessed mono hidden">' + s.atime.toISOString().split('T')[0] + '</td>' +
                    '<td class="col-created mono hidden">' + s.birthtime.toISOString().split('T')[0] + '</td>' +
                    '<td class="col-recency hidden">' + (isNew ? '<span class="new-dot" title="Modified in last 24h"></span>' : '') + '</td>' +
                    '<td class="col-detailed-type">' + escapeHtml(detailedType) + '</td>' +
                    '</tr>';
            }).join('');

            const emptyState = visibleItems.length === 0
                ? '<tr><td colspan="8" class="empty">This directory is empty.</td></tr>'
                : '';

            return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sketchbook Web Server: ${escapeHtml(relativePath)}</title>
    <style>
        ${sharedStyles}

        .nav-bar {
            padding: 0 16px;
            height: 38px;
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
            gap: 3px;
            color: var(--subtle);
            font-size: 11.5px;
        }
        .breadcrumbs a {
            color: var(--text);
            padding: 2px 5px;
            border-radius: 3px;
            transition: background 0.1s;
        }
        .breadcrumbs a:hover { background: var(--hover); color: var(--text-strong); }
        .sep { color: var(--border); user-select: none; margin: 0 1px; }

        .controls { display: flex; align-items: center; gap: 6px; }
        .search-wrap { position: relative; display: flex; align-items: center; }
        .search-icon {
            position: absolute; left: 7px;
            color: var(--subtle); pointer-events: none; display: flex;
        }
        #search {
            background: var(--bg);
            border: 1px solid var(--border);
            padding: 3px 8px 3px 24px;
            width: 168px;
            color: var(--text);
            font-size: 11.5px;
            font-family: system-ui, -apple-system, sans-serif;
            outline: none;
            border-radius: 3px;
            transition: border-color 0.15s, width 0.2s;
        }
        #search:focus { border-color: var(--accent); width: 200px; }
        #search::placeholder { color: var(--subtle); }

        .settings-btn {
            background: none;
            border: 1px solid var(--border);
            color: var(--subtle);
            width: 28px; height: 26px;
            cursor: pointer;
            border-radius: 3px;
            display: flex; align-items: center; justify-content: center;
            transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .settings-btn:hover { border-color: #3a3a3a; color: var(--text); background: var(--hover); }
        .settings-btn.active { border-color: var(--accent); color: var(--accent); }

        .dropdown {
            position: absolute; right: 16px; top: 42px;
            background: var(--surface);
            border: 1px solid var(--border);
            padding: 6px 0 8px;
            display: none; width: 185px;
            z-index: 200;
            box-shadow: 0 12px 28px rgba(0,0,0,0.65);
            border-radius: 4px;
        }
        .dropdown.show { display: block; }
        .dropdown-title {
            padding: 6px 14px 4px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--subtle);
            font-weight: 500;
        }
        .dropdown label {
            display: flex; align-items: center; gap: 10px;
            padding: 5px 14px;
            cursor: pointer;
            color: var(--text);
            font-size: 11.5px;
            font-family: system-ui, -apple-system, sans-serif;
            transition: background 0.1s;
        }
        .dropdown label:hover { background: var(--hover); }
        .dropdown input[type="checkbox"] { accent-color: var(--accent); }

        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { position: sticky; top: 38px; z-index: 50; }
        th {
            text-align: left;
            padding: 7px 12px;
            border-bottom: 1px solid var(--border);
            color: var(--subtle);
            font-weight: 500;
            font-size: 10.5px;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            cursor: pointer;
            white-space: nowrap;
            background: var(--surface);
            user-select: none;
            transition: background 0.1s, color 0.1s;
        }
        th:hover { background: var(--hover); color: var(--text); }
        th.sorted { color: var(--accent); }
        .sort-icon { display: inline-flex; align-items: center; margin-left: 4px; opacity: 0.85; }

        td {
            padding: 0 12px;
            border-bottom: 1px solid transparent;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            height: 28px;
            vertical-align: middle;
        }
        tr:nth-child(even) td { background: var(--row-alt); }
        tr:hover td { background: var(--hover) !important; }
        .col-name a:hover { color: var(--text-strong); }

        /* Name cell: inner div is flex so the td stays a normal table cell */
        .col-name { width: 36%; }
        .name-cell { display: flex; align-items: center; overflow: hidden; }
        .name-cell a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .col-size         { width: 80px; color: var(--subtle); font-size: 11px; }
        .col-kind         { width: 58px; color: var(--subtle); }
        .col-modified     { width: 98px; color: var(--subtle); font-size: 11px; }
        .col-accessed     { width: 98px; color: var(--subtle); font-size: 11px; }
        .col-created      { width: 98px; color: var(--subtle); font-size: 11px; }
        .col-recency      { width: 52px; text-align: center; }
        .col-detailed-type { width: 148px; color: var(--subtle); font-size: 11px; }

        .hidden { display: none !important; }

        .new-dot {
            display: inline-block;
            width: 6px; height: 6px;
            border-radius: 50%;
            background: var(--accent);
        }
        .empty { text-align: center; color: var(--subtle); padding: 48px 0; }

        .status-bar {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 22px;
            background: var(--surface);
            border-top: 1px solid var(--border);
            display: flex; align-items: center;
            padding: 0 16px;
            font-size: 10.5px;
            color: var(--subtle);
            gap: 14px;
        }
        body { padding-bottom: 22px; }
    </style>
</head>
<body>
    <div class="nav-bar">
        <div class="breadcrumbs">${breadcrumbHtml}</div>
        <div class="controls">
            <div class="search-wrap">
                <span class="search-icon">${ICON_SEARCH}</span>
                <input type="text" id="search" placeholder="Filter\u2026" autocomplete="off" spellcheck="false">
            </div>
            <button class="settings-btn" id="settingsToggle" title="Column settings">
                ${ICON_SETTINGS}
            </button>
            <div class="dropdown" id="settingsDropdown">
                <div class="dropdown-title">Columns</div>
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
                <th class="col-name" onclick="resort(0,this)">Name <span class="sort-icon" id="si0"></span></th>
                <th class="col-size" onclick="resort(1,this)">Size <span class="sort-icon" id="si1"></span></th>
                <th class="col-kind" onclick="resort(2,this)">Type <span class="sort-icon" id="si2"></span></th>
                <th class="col-modified" onclick="resort(3,this)">Modified <span class="sort-icon" id="si3"></span></th>
                <th class="col-accessed hidden" onclick="resort(4,this)">Accessed <span class="sort-icon" id="si4"></span></th>
                <th class="col-created hidden" onclick="resort(5,this)">Created <span class="sort-icon" id="si5"></span></th>
                <th class="col-recency hidden" onclick="resort(6,this)">Recent <span class="sort-icon" id="si6"></span></th>
                <th class="col-detailed-type" onclick="resort(7,this)">Detailed Type <span class="sort-icon" id="si7"></span></th>
            </tr>
        </thead>
        <tbody id="file-list">${rows}${emptyState}</tbody>
    </table>

    <div class="status-bar">
        <span id="item-count">${visibleItems.length} item${visibleItems.length !== 1 ? 's' : ''}</span>
        <span id="filter-status" style="display:none;">&mdash; <span id="filter-count"></span> visible</span>
    </div>

    <script>
        const ICON_ASC  = '${ICON_SORT_ASC.replace(/'/g, "\\'")}';
        const ICON_DESC = '${ICON_SORT_DESC.replace(/'/g, "\\'")}';
        const search    = document.getElementById('search');
        const list      = document.getElementById('file-list');
        const allTh     = Array.from(document.querySelectorAll('th'));
        let curIdx = -1, sortDir = 1;

        search.addEventListener('input', () => {
            const term = search.value.toLowerCase();
            let visible = 0;
            Array.from(list.children).forEach(row => {
                if (!row.dataset.name) return;
                const show = row.dataset.name.includes(term);
                row.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            const st = document.getElementById('filter-status');
            const fc = document.getElementById('filter-count');
            if (term) { st.style.display = ''; fc.textContent = visible + ' visible'; }
            else { st.style.display = 'none'; }
        });

        function resort(idx, th) {
            sortDir = curIdx === idx ? sortDir * -1 : 1;
            curIdx = idx;
            allTh.forEach((h, i) => {
                h.classList.remove('sorted');
                const si = document.getElementById('si' + i);
                if (si) si.innerHTML = '';
            });
            th.classList.add('sorted');
            const si = document.getElementById('si' + idx);
            if (si) si.innerHTML = sortDir === 1 ? ICON_ASC : ICON_DESC;
            Array.from(list.children).filter(r => r.dataset.name).sort((a, b) => {
                let vA, vB;
                switch (idx) {
                    case 1: [vA,vB]=[parseInt(a.dataset.size),parseInt(b.dataset.size)]; break;
                    case 3: [vA,vB]=[parseInt(a.dataset.mtime),parseInt(b.dataset.mtime)]; break;
                    case 4: [vA,vB]=[parseInt(a.dataset.atime),parseInt(b.dataset.atime)]; break;
                    case 5: [vA,vB]=[parseInt(a.dataset.ctime),parseInt(b.dataset.ctime)]; break;
                    default: [vA,vB]=[
                        a.children[idx]?.innerText.toLowerCase()??'',
                        b.children[idx]?.innerText.toLowerCase()??''
                    ];
                }
                return vA > vB ? sortDir : vA < vB ? -sortDir : 0;
            }).forEach(r => list.appendChild(r));
        }

        const settingsBtn = document.getElementById('settingsToggle');
        const dropdown    = document.getElementById('settingsDropdown');
        settingsBtn.onclick = e => {
            e.stopPropagation();
            const open = dropdown.classList.toggle('show');
            settingsBtn.classList.toggle('active', open);
        };
        document.querySelectorAll('#settingsDropdown input').forEach(cb => {
            cb.onchange = () =>
                document.querySelectorAll('.' + cb.dataset.col)
                    .forEach(el => el.classList.toggle('hidden', !cb.checked));
        });
        document.addEventListener('click', () => {
            if (dropdown) dropdown.classList.remove('show');
            if (settingsBtn) settingsBtn.classList.remove('active');
        });

        document.addEventListener('keydown', e => {
            if (e.key === '/' && document.activeElement !== search) {
                e.preventDefault(); search.focus();
            }
            if (e.key === 'Escape' && document.activeElement === search) {
                search.value = '';
                search.dispatchEvent(new Event('input'));
                search.blur();
            }
        });
    </script>
</body>
</html>`);
        }

        res.sendFile(absolutePath, (err) => {
            if (err && !res.headersSent) {
                console.error('[ERROR] Failed to send file:', absolutePath, err);
                res.status(500).send(errorPage({
                    status: 500,
                    title: 'Internal Server Error',
                    message: 'The file could not be sent. It may be unreadable or a server fault has occurred.',
                    suggestion: relativePath,
                }));
            }
        });

    } catch (err) {
        console.error('[ERROR] Unhandled exception for path:', relativePath, err);
        if (!res.headersSent) {
            res.status(500).send(errorPage({
                status: 500,
                title: 'Internal Server Error',
                message: 'An unexpected error occurred. Check the server logs for details.',
            }));
        }
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('[INFO] Sketchbook Web Server running on port', PORT);
});
