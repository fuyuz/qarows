import { useRef, useState, type DragEvent, type ReactNode } from "react";

interface FileDropZoneProps {
  title: string;
  hint: string;
  accept?: string;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
}

export function FileDropZone({
  title,
  hint,
  accept,
  onFiles,
  children,
}: FileDropZoneProps) {
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
      className={`drop-zone${active ? " drop-zone--active" : ""}`}
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
      <div className="drop-zone__icon" aria-hidden>
        ↑
      </div>
      <p className="drop-zone__title">{title}</p>
      <p className="drop-zone__hint">{hint}</p>
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
  results?: File;
  unknown: File[];
} {
  let tests: File | undefined;
  let results: File | undefined;
  const unknown: File[] = [];

  for (const file of files) {
    const kind = classifyFile(file);
    if (kind === "tests" && !tests) tests = file;
    else if (kind === "results" && !results) results = file;
    else unknown.push(file);
  }

  return { tests, results, unknown };
}
