import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock fetch globally
globalThis.fetch = vi.fn();

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});

// Mock URL.createObjectURL
URL.createObjectURL = vi.fn(() => "blob:http://localhost:3000/test");
URL.revokeObjectURL = vi.fn();

// Mock scrollTo
window.scrollTo = vi.fn();

// Suppress console.error in tests (optional)
// Uncomment the following lines to suppress console.error in tests
// const originalError = console.error;
// console.error = (...args: unknown[]) => {
//   if (
//     typeof args[0] === "string" &&
//     args[0].includes("Warning: ReactDOM.render is no longer supported")
//   ) {
//     return;
//   }
//   originalError.call(console, ...args);
// };
