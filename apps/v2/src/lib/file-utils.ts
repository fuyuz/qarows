export function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("ファイル読み込みに失敗しました"));
    reader.readAsText(file);
  });
}

export function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function appendUniqueFiles(prev: File[], incoming: File[]): File[] {
  const seen = new Set(prev.map(fileKey));
  const next = [...prev];
  for (const file of incoming) {
    const key = fileKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(file);
  }
  return next;
}
