import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock "server-only" in Vitest so server-side utilities can be unit tested in Node/JSDOM
vi.mock("server-only", () => ({}));

