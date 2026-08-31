import { useEffect, useState } from "react";
import {
  loadCommunicationPolicy,
  getCachedCommunicationPolicy,
  type CommunicationPolicy,
} from "@/lib/comm/communication-policy";

export function useCommunicationPolicy(): CommunicationPolicy {
  const [policy, setPolicy] = useState<CommunicationPolicy>(getCachedCommunicationPolicy);
  useEffect(() => {
    void loadCommunicationPolicy().then(setPolicy);
  }, []);
  return policy;
}
