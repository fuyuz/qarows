import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ResultsFile, SessionConfig, TestDefinition } from "@qarows/shared";

interface QarowsDB extends DBSchema {
  meta: {
    key: "state";
    value: {
      definition: TestDefinition | null;
      results: ResultsFile | null;
      session: SessionConfig | null;
    };
  };
}

const DB_NAME = "qarows-v1";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<QarowsDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<QarowsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("meta");
      },
    });
  }
  return dbPromise;
}

export interface PersistedState {
  definition: TestDefinition | null;
  results: ResultsFile | null;
  session: SessionConfig | null;
}

const defaultState: PersistedState = {
  definition: null,
  results: null,
  session: null,
};

export async function loadState(): Promise<PersistedState> {
  const db = await getDb();
  const stored = await db.get("meta", "state");
  if (!stored) return defaultState;
  return {
    definition: stored.definition ?? null,
    results: stored.results ?? null,
    session: stored.session ?? null,
  };
}

export async function saveState(state: PersistedState): Promise<void> {
  const db = await getDb();
  await db.put("meta", state, "state");
}

export async function clearState(): Promise<void> {
  const db = await getDb();
  await db.delete("meta", "state");
}
