import { useQuery } from "@tanstack/react-query";
import {
  fetchPublicWebsiteBundle,
  fetchPublicPricingPlans,
  fetchPublishedBlogPosts,
  fetchPublishedTutorials,
  fetchPublishedReleaseNotes,
} from "@/lib/website/website-service";
import { DEFAULT_WEBSITE_BUNDLE } from "@/lib/website/defaults";
import type { PublicWebsiteBundle } from "@/lib/website/types";

export function usePublicWebsiteBundle(): {
  data: PublicWebsiteBundle;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: ["public-website-bundle"],
    queryFn: fetchPublicWebsiteBundle,
    staleTime: 60_000,
    placeholderData: DEFAULT_WEBSITE_BUNDLE,
  });
  return {
    data: query.data ?? DEFAULT_WEBSITE_BUNDLE,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function usePublicPricingPlans() {
  return useQuery({
    queryKey: ["public-pricing-plans"],
    queryFn: fetchPublicPricingPlans,
    staleTime: 60_000,
  });
}

export function usePublicBlogPosts() {
  return useQuery({
    queryKey: ["public-blog-posts"],
    queryFn: fetchPublishedBlogPosts,
    staleTime: 60_000,
  });
}

export function usePublicTutorials() {
  return useQuery({
    queryKey: ["public-tutorials"],
    queryFn: fetchPublishedTutorials,
    staleTime: 60_000,
  });
}

export function usePublicReleaseNotes() {
  return useQuery({
    queryKey: ["public-release-notes"],
    queryFn: fetchPublishedReleaseNotes,
    staleTime: 60_000,
  });
}
