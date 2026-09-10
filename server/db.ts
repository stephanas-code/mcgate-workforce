import initSqlJs from 'sql.js';
import type { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
function getCurrentDir(): string {
  try {
    if (typeof __dirname !== 'undefined' && __dirname) {
      return __dirname;
    }
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {
    // fallback
  }
  return process.cwd();
}

const CURRENT_DIR = getCurrentDir();

let dbInstance: Database | null = null;
const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = process.env.DESKTOP_USER_DATA
  ? path.join(process.env.DESKTOP_USER_DATA, 'data')
  : IS_VERCEL
  ? path.join(os.tmpdir(), 'mcgate-data')
  : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'mcgate.sqlite');

function findSeedDbFile(): string | null {
  const candidates = [
    path.join(process.cwd(), 'data', 'mcgate.sqlite'),
    path.join(CURRENT_DIR, 'data', 'mcgate.sqlite'),
    path.join(CURRENT_DIR, '..', 'data', 'mcgate.sqlite'),
    path.join(CURRENT_DIR, 'mcgate.sqlite')
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  return null;
}

export interface DbLogEntry {
  id: number;
  timestamp: string;
  containerId: string;
  type: 'QUERY' | 'EXECUTE' | 'BATCH' | 'PERSIST' | 'INIT' | 'ERROR';
  sql?: string;
  params?: any[];
  changes?: number;
  lastInsertRowid?: number;
  error?: string;
  details?: any;
}

export const CONTAINER_ID = `cntr-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString(36)}`;
export const CONTAINER_BOOT_TIME = new Date().toISOString();
const dbLogs: DbLogEntry[] = [];
let logCounter = 1;

export function addDbLog(entry: Omit<DbLogEntry, 'id' | 'timestamp' | 'containerId'>): void {
  const fullEntry: DbLogEntry = {
    id: logCounter++,
    timestamp: new Date().toISOString(),
    containerId: CONTAINER_ID,
    ...entry
  };
  dbLogs.unshift(fullEntry);
  if (dbLogs.length > 200) {
    dbLogs.pop();
  }
}

export function getDbLogs(): {
  containerId: string;
  bootTime: string;
  isVercel: boolean;
  dataDir: string;
  dbFile: string;
  dbFileExists: boolean;
  dbFileSize: number;
  blobConfigured: boolean;
  logs: DbLogEntry[];
} {
  let dbFileSize = 0;
  try {
    if (fs.existsSync(DB_FILE)) {
      dbFileSize = fs.statSync(DB_FILE).size;
    }
  } catch {}

  return {
    containerId: CONTAINER_ID,
    bootTime: CONTAINER_BOOT_TIME,
    isVercel: IS_VERCEL,
    dataDir: DATA_DIR,
    dbFile: DB_FILE,
    dbFileExists: fs.existsSync(DB_FILE),
    dbFileSize,
    blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    logs: dbLogs
  };
}

async function tryDownloadBlobDb(): Promise<Buffer | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { head } = await import('@vercel/blob');
    const blobDetails = await head('mcgate-db/mcgate.sqlite').catch(() => null);
    if (blobDetails?.downloadUrl) {
      const resp = await fetch(blobDetails.downloadUrl);
      if (resp.ok) {
        const arrBuf = await resp.arrayBuffer();
        addDbLog({
          type: 'INIT',
          details: `Synchronized DB from Vercel Blob: ${arrBuf.byteLength} bytes`
        });
        return Buffer.from(arrBuf);
      }
    }
  } catch (err: any) {
    addDbLog({
      type: 'ERROR',
      error: `Failed to download from Vercel Blob: ${err?.message || String(err)}`
    });
  }
  return null;
}

async function tryUploadBlobDb(buffer: Buffer): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { put } = await import('@vercel/blob');
    await put('mcgate-db/mcgate.sqlite', buffer, {
      access: 'public',
      addRandomSuffix: false
    });
    addDbLog({
      type: 'PERSIST',
      details: `Persisted DB to Vercel Blob: ${buffer.length} bytes`
    });
  } catch (err: any) {
    addDbLog({
      type: 'ERROR',
      error: `Failed to upload to Vercel Blob: ${err?.message || String(err)}`
    });
  }
}

let isSaving = false;
let saveScheduled = false;

export function persistDatabase(): void {
  if (!dbInstance) return;
  if (isSaving) {
    saveScheduled = true;
    return;
  }
  isSaving = true;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
    addDbLog({
      type: 'PERSIST',
      details: { bytes: buffer.length, path: DB_FILE }
    });
    if (IS_VERCEL && process.env.BLOB_READ_WRITE_TOKEN) {
      tryUploadBlobDb(buffer).catch(console.error);
    }
  } catch (err: any) {
    console.warn('[DB] Warning: Failed to persist database to disk:', err);
    addDbLog({
      type: 'ERROR',
      error: `Persist failed: ${err?.message || String(err)}`
    });
  } finally {
    isSaving = false;
    if (saveScheduled) {
      saveScheduled = false;
      persistDatabase();
    }
  }
}

import { SQL_WASM_BASE64 } from './wasmBinary.ts';

function getWasmBinary(): Buffer {
  const possiblePaths = [
    path.join(CURRENT_DIR, 'sql-wasm.wasm'),
    path.join(CURRENT_DIR, '..', 'api', 'sql-wasm.wasm'),
    path.join(process.cwd(), 'api', 'sql-wasm.wasm'),
    path.join(process.cwd(), 'server', 'sql-wasm.wasm'),
    path.join(process.cwd(), 'sql-wasm.wasm'),
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p);
      }
    } catch {
      // ignore
    }
  }
  // Serverless resilient fallback: Use pre-embedded wasm binary
  return Buffer.from(SQL_WASM_BASE64, 'base64');
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const wasmBinary = getWasmBinary();
  const SQL = await initSqlJs({
    ...(wasmBinary ? { wasmBinary } : {}),
    locateFile: (file) => {
      const candidates = [
        path.join(CURRENT_DIR, file),
        path.join(process.cwd(), 'api', file),
        path.join(process.cwd(), 'server', file),
        path.join(process.cwd(), file),
        path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
      return file;
    }
  });

  // On Vercel, check if Vercel Blob has an updated database
  if (IS_VERCEL && process.env.BLOB_READ_WRITE_TOKEN) {
    const blobBuffer = await tryDownloadBlobDb();
    if (blobBuffer) {
      try {
        dbInstance = new SQL.Database(blobBuffer);
        dbInstance.run('PRAGMA foreign_keys = ON;');
        return dbInstance;
      } catch (err) {
        console.warn('Failed loading blob DB into SQL.js, falling back to disk/seed:', err);
      }
    }
  }

  // On Vercel, copy initial seed DB from repo if it exists and /tmp doesn't have it yet
  const seedFile = findSeedDbFile();
  if (IS_VERCEL && !fs.existsSync(DB_FILE) && seedFile) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.copyFileSync(seedFile, DB_FILE);
      addDbLog({
        type: 'INIT',
        details: `Copied seed DB from ${seedFile} to ${DB_FILE}`
      });
    } catch (err) {
      console.warn('[DB] Failed copying seed DB to /tmp:', err);
      addDbLog({
        type: 'ERROR',
        error: `Failed copying seed DB to /tmp: ${err}`
      });
    }
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
      addDbLog({
        type: 'INIT',
        details: `Loaded database from disk: ${DB_FILE} (${fileBuffer.length} bytes)`
      });
    } catch (e) {
      console.warn('Could not read existing DB file, creating fresh DB:', e);
      dbInstance = new SQL.Database();
      addDbLog({
        type: 'ERROR',
        error: `Could not read existing DB file: ${e}`
      });
    }
  } else if (seedFile) {
    try {
      const fileBuffer = fs.readFileSync(seedFile);
      dbInstance = new SQL.Database(fileBuffer);
      addDbLog({
        type: 'INIT',
        details: `Loaded database directly from seed file: ${seedFile} (${fileBuffer.length} bytes)`
      });
    } catch (e) {
      console.warn('Could not read seed DB file, creating fresh DB:', e);
      dbInstance = new SQL.Database();
      addDbLog({
        type: 'ERROR',
        error: `Could not read seed DB file: ${e}`
      });
    }
  } else {
    dbInstance = new SQL.Database();
    addDbLog({
      type: 'INIT',
      details: 'Initialized completely fresh in-memory database'
    });
  }

  dbInstance.run('PRAGMA foreign_keys = ON;');
  return dbInstance;
}

// Helper query wrappers
export async function queryAll<T = Record<string, any>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  try {
    const db = await getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  } catch (err: any) {
    addDbLog({
      type: 'ERROR',
      sql: sql.substring(0, 200),
      params,
      error: err?.message || String(err)
    });
    throw err;
  }
}

export async function queryOne<T = Record<string, any>>(sql: string, params: SqlValue[] = []): Promise<T | null> {
  try {
    const db = await getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let result: T | null = null;
    if (stmt.step()) {
      result = stmt.getAsObject() as T;
    }
    stmt.free();
    return result;
  } catch (err: any) {
    addDbLog({
      type: 'ERROR',
      sql: sql.substring(0, 200),
      params,
      error: err?.message || String(err)
    });
    throw err;
  }
}

export async function execute(sql: string, params: SqlValue[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  try {
    const db = await getDb();
    db.run(sql, params);
    const info = db.exec('SELECT changes() as changes, last_insert_rowid() as id');
    let changes = 0;
    let lastInsertRowid = 0;
    if (info.length > 0 && info[0].values.length > 0) {
      changes = Number(info[0].values[0][0]) || 0;
      lastInsertRowid = Number(info[0].values[0][1]) || 0;
    }
    persistDatabase();
    addDbLog({
      type: 'EXECUTE',
      sql: sql.substring(0, 200),
      params,
      changes,
      lastInsertRowid
    });
    return { changes, lastInsertRowid };
  } catch (err: any) {
    addDbLog({
      type: 'ERROR',
      sql: sql.substring(0, 200),
      params,
      error: err?.message || String(err)
    });
    throw err;
  }
}

export async function executeBatch(statements: string[]): Promise<void> {
  try {
    const db = await getDb();
    for (const sql of statements) {
      if (sql.trim()) {
        db.run(sql);
      }
    }
    persistDatabase();
    addDbLog({
      type: 'BATCH',
      details: { count: statements.length }
    });
  } catch (err: any) {
    addDbLog({
      type: 'ERROR',
      error: `Batch execution failed: ${err?.message || String(err)}`
    });
    throw err;
  }
}
