import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { cn } from "../../lib/cn";

export interface FileDropZoneProps {
  title: string;
  hint: string;
  accept?: string;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
}

export function FileDropZone({ title, hint, accept, onFiles, children }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    setActive(true);
  };

  const handleDragLeave = () => setActive(false);

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setActive(false);
    const files = [...event.dataTransfer.files];
    if (files.length > 0) onFiles(files);
  };

  const handleChange = () => {
    const files = inputRef.current?.files;
    if (files && files.length > 0) onFiles([...files]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={cn(
        "cursor-pointer rounded-xl border-2 border-dashed bg-card px-6 py-10 text-center transition-colors",
        active ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-primary/5",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <Upload className="mx-auto mb-3 size-8 text-muted-foreground/60" aria-hidden />
      <p className="mb-1 text-base font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={handleChange}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

function classifyFile(file: File): "tests" | "results" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".yml") || name.endsWith(".yaml")) return "tests";
  if (name.endsWith(".json")) return "results";
  return null;
}

export function classifyDroppedFiles(files: File[]): {
  tests?: File;
  results: File[];
  unknown: File[];
} {
  let tests: File | undefined;
  const results: File[] = [];
  const unknown: File[] = [];

  for (const file of files) {
    const kind = classifyFile(file);
    if (kind === "tests" && !tests) tests = file;
    else if (kind === "results") results.push(file);
    else unknown.push(file);
  }

  return { tests, results, unknown };
}

export function classifyResultsFiles(files: File[]): { results: File[]; unknown: File[] } {
  const results: File[] = [];
  const unknown: File[] = [];

  for (const file of files) {
    if (classifyFile(file) === "results") results.push(file);
    else unknown.push(file);
  }

  return { results, unknown };
}
