import { ArrowRight, ExternalLink, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  BrandLockup,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LanguageSwitcher,
  useTranslation,
} from "@qarows/ui";
import { useApp } from "@/context/AppContext";
import { GITHUB_REPO_URL } from "@/lib/site-links";
import { projectPath } from "@qarows/runner-ui";

const FEATURE_KEYS = [
  "landing.feature1",
  "landing.feature2",
  "landing.feature3",
  "landing.feature4",
  "landing.feature5",
  "landing.feature6",
  "landing.feature7",
] as const;

export function LandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { projectSummaries, lastOpenedProjectId } = useApp();

  const lastProject = projectSummaries.find(
    (summary) => summary.projectId === lastOpenedProjectId,
  );
  const continuePath = lastProject
    ? projectPath(lastProject.projectId, lastProject.hasValidSession ? "run" : "session")
    : null;

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <BrandLockup subtitle={t("common.brandSubtitle")} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="outline" size="sm" asChild>
              <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <section className="mb-8">
          <h1 className="mb-3 whitespace-pre-line text-2xl font-bold tracking-tight sm:text-3xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("landing.heroBody")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => navigate("/projects")}>
              {t("landing.getStarted")}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            {continuePath && (
              <Button size="lg" variant="secondary" asChild>
                <Link to={continuePath}>{t("landing.continueWork")}</Link>
              </Button>
            )}
          </div>
        </section>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("landing.featuresTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2.5 text-sm leading-relaxed">
              {FEATURE_KEYS.map((key) => (
                <li key={key} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Alert className="mb-6 border-primary/20 bg-primary/5">
          <Shield className="size-4" aria-hidden />
          <AlertTitle>{t("landing.localDataTitle")}</AlertTitle>
          <AlertDescription className="leading-relaxed">
            {t("landing.localDataBody")}
          </AlertDescription>
        </Alert>

        <p className="text-center text-xs text-muted-foreground">
          {t("landing.sourceNoteBefore")}{" "}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            GitHub（fuyuz/qarows）
          </a>{" "}
          {t("landing.sourceNoteAfter")}
        </p>
      </main>
    </div>
  );
}
