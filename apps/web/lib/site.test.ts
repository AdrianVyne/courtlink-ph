import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, siteUrl } from "./site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("defaults to localhost when SITE_URL is unset", () => {
    vi.stubEnv("SITE_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("strips trailing slashes from SITE_URL", () => {
    vi.stubEnv("SITE_URL", "https://courtlink.ph/");
    expect(siteUrl()).toBe("https://courtlink.ph");
  });
});

describe("absoluteUrl", () => {
  it("joins a path without a double slash", () => {
    vi.stubEnv("SITE_URL", "https://courtlink.ph/");
    expect(absoluteUrl("/courts")).toBe("https://courtlink.ph/courts");
  });

  it("adds a leading slash when the path lacks one", () => {
    vi.stubEnv("SITE_URL", "https://courtlink.ph");
    expect(absoluteUrl("courts/riverside")).toBe("https://courtlink.ph/courts/riverside");
  });

  it("resolves the root path", () => {
    vi.stubEnv("SITE_URL", "https://courtlink.ph");
    expect(absoluteUrl("/")).toBe("https://courtlink.ph/");
  });
});
