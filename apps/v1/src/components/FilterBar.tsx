import { RunnerFilterBar } from "@/components/RunnerFilterBar";

export function FilterBar({ variant = "runner" }: { variant?: "runner" | "bugs" }) {
  return <RunnerFilterBar className="sticky top-0 z-10" variant={variant} />;
}
