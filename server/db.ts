import initSqlJs, { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'mcgate.sqlite');

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
    console.error('Failed to persist database:', err);
  } finally {
    isSaving = false;
    if (saveScheduled) {
      saveScheduled = false;
      persistDatabase();
    }
  }
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('Could not read existing DB file, creating fresh DB:', e);
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
