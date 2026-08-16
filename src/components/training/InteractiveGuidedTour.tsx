/**
 * Interactive guided walkthrough — spotlights real UI elements with dim overlay.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSettings } from "@/lib/settings-store";
import { useTrainingProgressStore } from "@/lib/training-progress-store";
import { getTourById, getToursForRole, type TourId } from "@/lib/guided-tour-definitions";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const ACTIVE_TOUR_KEY = "ornexa_active_tour";
const TOUR_STEP_KEY = "ornexa_active_tour_step";

type SpotlightRect = { top: number; left: number; width: number; height: number };

function findTargetRect(selector: string): SpotlightRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const pad = 8;
  return {
    top: Math.max(0, rect.top - pad),
    left: Math.max(0, rect.left - pad),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export function startGuidedTour(tourId: TourId, stepIndex = 0) {
  localStorage.setItem(ACTIVE_TOUR_KEY, tourId);
  localStorage.setItem(TOUR_STEP_KEY, String(stepIndex));
  window.dispatchEvent(new CustomEvent("ornexa-tour-start", { detail: { tourId, stepIndex } }));
}

export function InteractiveGuidedTour() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const role = useSettings((s) => s.currentUserRole);
  const { upsertProgress } = useTrainingProgressStore();
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  const tour = useMemo(
    () => (activeTourId ? getTourById(activeTourId) : undefined),
    [activeTourId],
  );
  const step = tour?.steps[stepIndex];

  const refreshSpotlight = useCallback(() => {
    if (!step) {
      setSpotlight(null);
      return;
    }
    setSpotlight(findTargetRect(step.selector));
  }, [step]);

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_TOUR_KEY) as TourId | null;
    const storedStep = Number(localStorage.getItem(TOUR_STEP_KEY) ?? "0");
    if (stored && getTourById(stored)) {
      setActiveTourId(stored);
      setStepIndex(Number.isFinite(storedStep) ? storedStep : 0);
    }
  }, []);

  useEffect(() => {
    function onStart(e: Event) {
      const detail = (e as CustomEvent<{ tourId: TourId; stepIndex?: number }>).detail;
      setActiveTourId(detail.tourId);
      setStepIndex(detail.stepIndex ?? 0);
    }
    window.addEventListener("ornexa-tour-start", onStart);
    return () => window.removeEventListener("ornexa-tour-start", onStart);
  }, []);

  useEffect(() => {
    if (!tour || !step) return;
    const currentStep = step;
    let cancelled = false;

    async function go() {
      if (currentStep.route) {
        await navigate({ to: currentStep.route as "/" });
        await new Promise((r) => setTimeout(r, currentStep.waitMs ?? 400));
      }
      if (!cancelled) refreshSpotlight();
    }
    void go();

    const onResize = () => refreshSpotlight();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [tour, step, navigate, refreshSpotlight]);

  function closeTour(skipped = false) {
    if (tour && !skipped) {
      void upsertProgress({
        moduleCode: tour.moduleCode,
        progressPercentage: 100,
        currentStepIndex: tour.steps.length,
        isCompleted: true,
      });
    } else if (tour && skipped) {
      void upsertProgress({
        moduleCode: tour.moduleCode,
        progressPercentage: Math.round(((stepIndex + 1) / tour.steps.length) * 100),
        currentStepIndex: stepIndex,
        isCompleted: false,
      });
    }
    localStorage.removeItem(ACTIVE_TOUR_KEY);
    localStorage.removeItem(TOUR_STEP_KEY);
    setActiveTourId(null);
    setSpotlight(null);
  }

  function resumeLater() {
    if (tour) {
      void upsertProgress({
        moduleCode: tour.moduleCode,
        progressPercentage: Math.round((stepIndex / tour.steps.length) * 100),
        currentStepIndex: stepIndex,
        isCompleted: false,
      });
    }
    localStorage.setItem(TOUR_STEP_KEY, String(stepIndex));
    setActiveTourId(null);
    setSpotlight(null);
  }

  if (!tour || !step) return null;

  const title = t(step.titleKey);
  const body = t(step.bodyKey);

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none" data-testid="guided-tour-overlay">
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {spotlight && (
        <div
          className="absolute rounded-lg ring-2 ring-gold pointer-events-none"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      <Card className="pointer-events-auto absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 p-4 shadow-xl border-gold/30">
        <div className="flex justify-between items-start gap-2 mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("tour.stepOf")
                .replace("{current}", String(stepIndex + 1))
                .replace("{total}", String(tour.steps.length))}
            </p>
            <h3 className="font-semibold text-sm text-gold">{title}</h3>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => closeTour(true)}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{body}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {stepIndex > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const next = stepIndex - 1;
                setStepIndex(next);
                localStorage.setItem(TOUR_STEP_KEY, String(next));
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              {t("common.back")}
            </Button>
          )}
          {stepIndex < tour.steps.length - 1 ? (
            <Button
              size="sm"
              onClick={() => {
                const next = stepIndex + 1;
                setStepIndex(next);
                localStorage.setItem(TOUR_STEP_KEY, String(next));
                void upsertProgress({
                  moduleCode: tour.moduleCode,
                  progressPercentage: Math.round((next / tour.steps.length) * 100),
                  currentStepIndex: next,
                  isCompleted: false,
                });
              }}
            >
              {t("common.next")}
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => closeTour(false)}>
              {t("tour.finish")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => closeTour(true)}>
            {t("tour.skip")}
          </Button>
          <Button size="sm" variant="ghost" onClick={resumeLater}>
            {t("tour.resumeLater")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Lists tours available for the current role (Help → Guided Tours). */
export function useAvailableTours() {
  const role = useSettings((s) => s.currentUserRole);
  return useMemo(() => getToursForRole(role ?? undefined), [role]);
}
