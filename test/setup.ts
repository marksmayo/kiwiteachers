import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

process.env.TZ = "Pacific/Auckland";

afterEach(() => {
  vi.clearAllMocks();
});
