import { describe, expect, it } from "vitest";
import { CONFIG_BUNDLE_SCHEMA, validateConfigurationBundle } from "@/lib/configuration-bundle";

describe("configuration-bundle", () => {
  it("accepts MTJ default shape", () => {
    const v = validateConfigurationBundle({
      schema: CONFIG_BUNDLE_SCHEMA,
      version: "1.0.0",
      bundleId: "mtj-default.v1",
      label: "MTJ Default",
      maTaraWorkshopPolicy: { pureGoldReferencePermille: 995 },
    });
    expect(v.ok).toBe(true);
  });

  it("rejects missing schema", () => {
    const v = validateConfigurationBundle({
      version: "1.0.0",
      bundleId: "x",
      label: "x",
    });
    expect(v.ok).toBe(false);
  });
});
