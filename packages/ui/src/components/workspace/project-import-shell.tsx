import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { TestsYamlGuide } from "./tests-yaml-guide";

export interface ProjectImportShellProps {
  title?: string;
  description: string;
  error: string | null;
  errorShake?: boolean;
  children: ReactNode;
  footer: ReactNode;
  extra?: ReactNode;
}

export function ProjectImportShell({
  title = "新規作成",
  description,
  error,
  errorShake = false,
  children,
  footer,
  extra,
}: ProjectImportShellProps) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <TestsYamlGuide />

        <div className="mt-6">{children}</div>

        <footer className="mt-6 flex flex-wrap items-center gap-3">{footer}</footer>

        {extra}

        {error && (
          <Alert variant="destructive" className={cn("mt-4", errorShake && "animate-ui-shake")}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
