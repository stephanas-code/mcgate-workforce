import initSqlJs from 'sql.js';
import type { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
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
const DATA_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), 'mcgate-data')
  : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'mcgate.sqlite');
const SEED_DB_FILE = path.join(process.cwd(), 'data', 'mcgate.sqlite');

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
  } catch (err) {
    console.warn('[DB] Warning: Failed to persist database to disk:', err);
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

  // On Vercel, copy initial seed DB from repo if it exists and /tmp doesn't have it yet
  if (IS_VERCEL && !fs.existsSync(DB_FILE) && fs.existsSync(SEED_DB_FILE)) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.copyFileSync(SEED_DB_FILE, DB_FILE);
    } catch (err) {
      console.warn('[DB] Failed copying seed DB to /tmp:', err);
    }
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('Could not read existing DB file, creating fresh DB:', e);
      dbInstance = new SQL.Database();
    }
  } else if (fs.existsSync(SEED_DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(SEED_DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('Could not read seed DB file, creating fresh DB:', e);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  dbInstance.run('PRAGMA foreign_keys = ON;');
  return dbInstance;
}

// Helper query wrappers
export async function queryAll<T = Record<string, any>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export async function queryOne<T = Record<string, any>>(sql: string, params: SqlValue[] = []): Promise<T | null> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result: T | null = null;
  if (stmt.step()) {
    result = stmt.getAsObject() as T;
  }
  stmt.free();
  return result;
}

export async function execute(sql: string, params: SqlValue[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
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
  return { changes, lastInsertRowid };
}

export async function executeBatch(statements: string[]): Promise<void> {
  const db = await getDb();
  for (const sql of statements) {
    if (sql.trim()) {
      db.run(sql);
    }
  }
  persistDatabase();
}
