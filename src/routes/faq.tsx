import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { MarketingSectionRenderer } from "@/components/marketing/MarketingSectionRenderer";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { getPageFromBundle } from "@/lib/website/website-service";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
});

function FaqPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  if (!bundle.feature_flags.faq) throw notFound();
  const page = getPageFromBundle(bundle, "faq");

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-3xl">Frequently asked questions</h1>
        <div className="mt-10">
          <MarketingSectionRenderer
            sections={
              page?.sections?.length
                ? page.sections
                : [
                    {
                      id: "faq",
                      type: "faq",
                      items: [
                        {
                          question: "Is Ornexa a retail POS or manufacturing ERP?",
                          answer:
                            "Ornexa is manufacturing-first. Retail and wholesale are licensed capabilities on the same platform.",
                        },
                        {
                          question: "How do I get access to Ornexa?",
                          answer:
                            "AVS ERP is invitation-only. Request access from our team or accept a secure invitation from your jeweller — there is no public self-signup or free trial tenant.",
                        },
                        {
                          question: "Is Google sign-in required?",
                          answer:
                            "No. Email and password remain supported. Google OAuth is optional.",
                        },
                        {
                          question: "What happens when my subscription ends?",
                          answer:
                            "Your data is never deleted. Records move to read-only until renewal.",
                        },
                      ],
                    },
                  ]
            }
          />
        </div>
      </div>
    </MarketingLayout>
  );
}
