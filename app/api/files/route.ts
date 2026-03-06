import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resolveSafePath, listDirectory } from '@/app/lib/utils/fs-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestPath = searchParams.get('path') || '/';

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
        { error: 'Not found', message: 'The requested path does not exist.' },
        { status: 404 }
      );
    }

    const stats = fs.statSync(absolutePath);

    if (stats.isFile()) {
      return NextResponse.json(
        {
          type: 'file',
          name: path.basename(absolutePath),
          size: stats.size,
          modified: stats.mtime.toISOString(),
        },
        { status: 200 }
      );
    }

    if (stats.isDirectory()) {
      try {
        const listing = listDirectory(absolutePath);
        return NextResponse.json(listing, { status: 200 });
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Failed to read directory',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid path type', message: 'The path is neither a file nor a directory.' },
      { status: 400 }
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
