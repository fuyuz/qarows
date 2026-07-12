import { AppNav } from "@/components/AppNav";
import { DashboardPageLayout } from "@qarows/runner-ui";

export function DashboardPage() {
  return <DashboardPageLayout nav={<AppNav />} />;
}
