import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resolveSafePath } from '@/app/lib/utils/fs-utils';

export const dynamic = 'force-dynamic';

// Maximum file size to display: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Text file extensions that can be displayed
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'mdx', 'json', 'jsonl', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'pyc', 'pyw', 'java', 'c', 'h',
  'cpp', 'cc', 'cxx', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'erb', 'swift', 'kt',
  'dart', 'lua', 'pl', 'pde', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'sql',
  'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1', 'vbs', 'dockerfile', 'glsl',
  'vert', 'frag', 'shader', 'csv', 'rtf', 'nfo', 'properties', 'log', 'conf',
  'config', 'cfg', 'gradle', 'maven', 'pom', 'lock', 'gitignore', 'dockerignore',
  'editorconfig', 'eslintrc', 'prettierrc', 'babelrc', 'tsconfig', 'webpack',
  'vite', 'rollup', 'parcel', 'browserslist', 'npmrc', 'yarnrc', 'pnpmfile',
  'makefile', 'dockerfile', 'compose', 'yaml', 'yml', 'toml', 'ini', 'env',
  'htaccess', 'htpasswd', 'htaccess', 'htpasswd', 'htaccess', 'htpasswd',
  'tex', 'latex', 'bib', 'sty', 'cls', 'doc', 'docx', 'odt', 'pages',
  'pdf', 'epub', 'mobi', 'azw', 'azw3', 'ibooks', 'cbz', 'cbr',
]);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestPath = searchParams.get('path');

    if (!requestPath) {
      return NextResponse.json(
        { error: 'Missing path parameter', message: 'Path parameter is required' },
        { status: 400 }
      );
    }

    let absolutePath: string;
    try {
      absolutePath = resolveSafePath(requestPath);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Invalid path',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      );
    }

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { error: 'Not found', message: 'The requested file does not exist.' },
        { status: 404 }
      );
    }

    const stats = fs.statSync(absolutePath);

    if (stats.isDirectory()) {
      return NextResponse.json(
        { error: 'Invalid path', message: 'The path is a directory, not a file.' },
        { status: 400 }
      );
    }

    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large',
          message: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
        },
        { status: 413 }
      );
    }

    // Check if file extension is allowed
    const ext = path.extname(absolutePath).slice(1).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error: 'Unsupported file type',
          message: `Cannot display files with .${ext} extension`,
        },
        { status: 415 }
      );
    }

    // Read file content
    const content = fs.readFileSync(absolutePath, 'utf-8');

    return NextResponse.json(
      {
        content,
        fileName: path.basename(absolutePath),
        size: stats.size,
        modified: stats.mtime.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API Error]', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      },
      { status: 500 }
    );
  }
}
