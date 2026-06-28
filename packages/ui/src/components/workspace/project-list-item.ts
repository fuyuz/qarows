export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: string;
  hasValidSession?: boolean;
}

export function sortProjectListItems(items: ProjectListItem[]): ProjectListItem[] {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}
