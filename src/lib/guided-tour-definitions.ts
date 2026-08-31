/**
 * Role-aware guided tour definitions — each step targets a real DOM element.
 */
export type TourId =
  | "getting-started"
  | "party-migration"
  | "manufacturing"
  | "gold-control"
  | "billing"
  | "reports"
  | "customization"
  | "documents-printing"
  | "whatsapp"
  | "assistant"
  | "platform-admin";

export type TourStep = {
  id: string;
  titleKey: string;
  bodyKey: string;
  selector: string;
  route?: string;
  waitMs?: number;
};

export type TourDefinition = {
  id: TourId;
  moduleCode: string;
  titleKey: string;
  roles: string[];
  steps: TourStep[];
};

export const TOUR_DEFINITIONS: TourDefinition[] = [
  {
    id: "getting-started",
    moduleCode: "GETTING_STARTED",
    titleKey: "tour.gettingStartedTitle",
    roles: [],
    steps: [
      {
        id: "welcome",
        titleKey: "tour.welcomeTitle",
        bodyKey: "tour.welcomeBody",
        selector: "[data-tour='sidebar']",
        route: "/",
      },
      {
        id: "dashboard",
        titleKey: "tour.dashboardTitle",
        bodyKey: "tour.dashboardBody",
        selector: "[data-tour='home-dashboard']",
        route: "/",
      },
      {
        id: "people",
        titleKey: "tour.peopleTitle",
        bodyKey: "tour.peopleBody",
        selector: "a[href='/people']",
        route: "/",
      },
      {
        id: "orders",
        titleKey: "tour.ordersTitle",
        bodyKey: "tour.ordersBody",
        selector: "a[href='/orders']",
        route: "/",
      },
      {
        id: "manufacturing",
        titleKey: "tour.manufacturingTitle",
        bodyKey: "tour.manufacturingBody",
        selector: "a[href='/workshop']",
        route: "/",
      },
      {
        id: "gold-book",
        titleKey: "tour.goldBookTitle",
        bodyKey: "tour.goldBookBody",
        selector: "a[href='/workshop/gold-book']",
        route: "/",
      },
      {
        id: "stock",
        titleKey: "tour.stockTitle",
        bodyKey: "tour.stockBody",
        selector: "a[href='/stock']",
        route: "/",
      },
      {
        id: "billing",
        titleKey: "tour.billingTitle",
        bodyKey: "tour.billingBody",
        selector: "a[href='/billing']",
        route: "/",
      },
      {
        id: "reports",
        titleKey: "tour.reportsTitle",
        bodyKey: "tour.reportsBody",
        selector: "a[href='/reports']",
        route: "/",
      },
      {
        id: "customization",
        titleKey: "tour.customizationTitle",
        bodyKey: "tour.customizationBody",
        selector: "a[href='/control/customization']",
        route: "/",
      },
      {
        id: "settings",
        titleKey: "tour.settingsTitle",
        bodyKey: "tour.settingsBody",
        selector: "a[href='/settings']",
        route: "/",
      },
      {
        id: "help",
        titleKey: "tour.helpTitle",
        bodyKey: "tour.helpBody",
        selector: "a[href='/help']",
        route: "/",
      },
    ],
  },
  {
    id: "gold-control",
    moduleCode: "GOLD_CONTROL",
    titleKey: "tour.goldControlTitle",
    roles: ["owner", "admin", "Super Owner", "Administrator", "Production Manager", "inventory"],
    steps: [
      {
        id: "gold-book",
        titleKey: "tour.goldBookStepTitle",
        bodyKey: "tour.goldBookStepBody",
        selector: "a[href='/workshop/gold-book']",
        route: "/workshop/gold-book",
      },
      {
        id: "ledger",
        titleKey: "tour.ledgerStepTitle",
        bodyKey: "tour.ledgerStepBody",
        selector: "a[href='/ledger']",
        route: "/ledger",
      },
    ],
  },
  {
    id: "platform-admin",
    moduleCode: "PLATFORM_ADMIN",
    titleKey: "tour.platformAdminTitle",
    roles: ["saas_admin", "platform_owner"],
    steps: [
      {
        id: "platform",
        titleKey: "tour.platformConsoleTitle",
        bodyKey: "tour.platformConsoleBody",
        selector: "[data-tour='platform-dashboard']",
        route: "/platform",
      },
    ],
  },
];

export function getToursForRole(role: string | undefined): TourDefinition[] {
  const normalized = (role ?? "").toLowerCase();
  return TOUR_DEFINITIONS.filter((tour) => {
    if (tour.roles.length === 0) return true;
    return tour.roles.some((r) => r.toLowerCase() === normalized);
  });
}

export function getTourById(id: TourId): TourDefinition | undefined {
  return TOUR_DEFINITIONS.find((t) => t.id === id);
}
