import { render, screen, act } from "@testing-library/react";
import App from "./App";
import {
  getCurrentMetrics,
  getIsActive,
  getStack,
} from "./common/storage.js";

// App polls storage on an interval and reads the cross-browser API on mount.
// Stub those so the component can render in isolation under jsdom.
jest.mock("./common/storage.js", () => ({
  saveObjectInLocalStorage: jest.fn(),
  getIsActive: jest.fn(),
  getCurrentMetrics: jest.fn(),
  getStack: jest.fn(),
}));

beforeEach(() => {
  // resetMocks clears implementations between tests, so (re)configure here.
  getIsActive.mockResolvedValue(false);
  getCurrentMetrics.mockResolvedValue({ urls: [], tabName: "" });
  getStack.mockResolvedValue([]);
  // addListener() reads window.chrome.webview; provide a minimal stub.
  window.chrome = {};
});

test("renders the Graph call history section", () => {
  render(<App />);
  expect(screen.getByText(/Graph call history/i)).toBeInTheDocument();
});

test("renders the call-to-action button", () => {
  render(<App />);
  expect(
    screen.getByRole("button", { name: /Show me how/i })
  ).toBeInTheDocument();
});

test("polls metrics after the interval fires", async () => {
  jest.useFakeTimers();
  try {
    render(<App />);
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(getCurrentMetrics).toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
