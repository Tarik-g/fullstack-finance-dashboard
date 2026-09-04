import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  // Tests must never fall through to the developer's running API.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("Unexpected fetch"))),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => cleanup());

// jsdom has no native modal/top-layer rendering. Only emulate open/close state;
// real focus trapping and responsive layout still need browser verification.
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: {
    configurable: true,
    value() {
      this.setAttribute("open", "");
    },
  },
  close: {
    configurable: true,
    value() {
      this.removeAttribute("open");
    },
  },
});
