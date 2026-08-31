/**
 * Post-onboarding guided tour offer — launches interactive spotlight walkthrough.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTrainingProgressStore } from "@/lib/training-progress-store";
import { startGuidedTour } from "@/components/training/InteractiveGuidedTour";
import { PlayCircle, BookOpen, X } from "lucide-react";

export function GuidedTourOffer() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const { hydrate, modules } = useTrainingProgressStore();

  useEffect(() => {
    void hydrate();
    const dismissed = localStorage.getItem("ornexa_tour_dismissed");
    const completed = modules.some((m) => m.moduleCode === "GETTING_STARTED" && m.isCompleted);
    const resumed = localStorage.getItem("ornexa_active_tour");
    if (!dismissed && !completed && !resumed) setVisible(true);
  }, [hydrate, modules]);

  if (!visible) return null;

  function handleStart() {
    setVisible(false);
    startGuidedTour("getting-started", 0);
  }

  function handleSkip() {
    localStorage.setItem("ornexa_tour_dismissed", "1");
    setVisible(false);
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-full max-w-sm p-4 shadow-lg border-gold/30 bg-card">
      <div className="flex justify-between items-start gap-2 mb-2">
        <h3 className="font-semibold text-sm text-gold">{t("tour.gettingStartedTitle")}</h3>
        <button type="button" onClick={handleSkip} aria-label={t("common.close")}>
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t("tour.welcomeBody")}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" onClick={handleStart} className="gap-1">
          <PlayCircle className="h-3.5 w-3.5" /> {t("tour.startTour")}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/help">
            <BookOpen className="h-3.5 w-3.5 mr-1" /> {t("tour.guidedTours")}
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={handleSkip}>
          {t("tour.skip")}
        </Button>
      </div>
    </Card>
  );
}
