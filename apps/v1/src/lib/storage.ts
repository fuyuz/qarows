import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { getProjectIdFromDefinition, type ResultsFile, type SessionConfig, type TestDefinition } from "@qarows/shared";
import { projectRecordToSummary, sortProjectSummaries } from "@/lib/project-summaries";

/** @deprecated v1 single-project blob — migrated to v2 on first load */
interface LegacyPersistedState {
  definition: TestDefinition | null;
  results: ResultsFile | null;
  session: SessionConfig | null;
}

export interface ProjectRecord {
  definition: TestDefinition;
  results: ResultsFile;
  session: SessionConfig | null;
  updatedAt: string;
}

export interface AppMeta {
  lastOpenedProjectId: string | null;
}

export interface ProjectSummary {
  projectId: string;
  name: string;
  updatedAt: string;
  hasValidSession: boolean;
}

interface QarowsDB extends DBSchema {
  meta: {
    key: "state" | "app";
    value: LegacyPersistedState | AppMeta;
  };
  projects: {
    key: string;
    value: ProjectRecord;
  };
}

const DB_NAME = "qarows-v1";
const DB_VERSION = 2;

const defaultAppMeta: AppMeta = {
  lastOpenedProjectId: null,
};

let dbPromise: Promise<IDBPDatabase<QarowsDB>> | null = null;
let migrationPromise: Promise<void> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<QarowsDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects");
        }
      },
    });
  }
  return dbPromise;
}

async function ensureMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateFromV1();
  }
  await migrationPromise;
}

async function migrateFromV1(): Promise<void> {
  const db = await getDb();
  const legacy = await db.get("meta", "state");
  if (!legacy || !("definition" in legacy) || !legacy.definition) return;

  const projectId = getProjectIdFromDefinition(legacy.definition);
  const results =
    legacy.results ??
    ({
      version: 1,
      projectId,
      updatedAt: new Date().toISOString(),
      results: {},
      bugs: [],
    } satisfies ResultsFile);

  const record: ProjectRecord = {
    definition: legacy.definition,
    results,
    session: legacy.session ?? null,
    updatedAt: results.updatedAt ?? new Date().toISOString(),
  };

  await db.put("projects", record, projectId);
  await db.put("meta", { lastOpenedProjectId: projectId }, "app");
  await db.delete("meta", "state");
}

function recordToSummary(projectId: string, record: ProjectRecord): ProjectSummary {
  return projectRecordToSummary(projectId, record);
}

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  await ensureMigrated();
  const db = await getDb();
  const tx = db.transaction("projects", "readonly");
  const store = tx.objectStore("projects");
  const [keys, records] = await Promise.all([store.getAllKeys(), store.getAll()]);
  await tx.done;
  const summaries = keys.map((projectId, index) =>
    recordToSummary(projectId, records[index]!),
  );
  return sortProjectSummaries(summaries);
}

export async function hasProject(projectId: string): Promise<boolean> {
  await ensureMigrated();
  const db = await getDb();
  const record = await db.get("projects", projectId);
  return record != null;
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
  await ensureMigrated();
  const db = await getDb();
  return (await db.get("projects", projectId)) ?? null;
}

export async function saveProject(projectId: string, record: ProjectRecord): Promise<void> {
  await ensureMigrated();
  const db = await getDb();
  await db.put("projects", record, projectId);
}

export async function deleteProjectFromStorage(projectId: string): Promise<void> {
  await ensureMigrated();
  const db = await getDb();
  await db.delete("projects", projectId);
}

export async function getAppMeta(): Promise<AppMeta> {
  await ensureMigrated();
  const db = await getDb();
  const meta = await db.get("meta", "app");
  if (!meta || !("lastOpenedProjectId" in meta)) return defaultAppMeta;
  return meta;
}

export async function saveAppMeta(meta: AppMeta): Promise<void> {
  await ensureMigrated();
  const db = await getDb();
  await db.put("meta", meta, "app");
}

/** Test helper — resets module state and deletes the database */
export async function resetStorageForTests(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      // ignore close errors during test teardown
    }
  }
  dbPromise = null;
  migrationPromise = null;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("deleteDatabase failed"));
    request.onblocked = () => resolve();
  });
}

/** Clears all projects while keeping the database open */
export async function clearAllProjects(): Promise<void> {
  await ensureMigrated();
  const db = await getDb();
  await db.clear("projects");
  await db.put("meta", defaultAppMeta, "app");
}
