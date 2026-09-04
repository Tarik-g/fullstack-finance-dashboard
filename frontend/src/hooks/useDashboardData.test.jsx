import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useDashboardData from "./useDashboardData";
import {
  createApiMock,
  deferred,
  expense,
  income,
  jsonResponse,
  page,
} from "../test/apiMock";

const options = {
  filters: { search: "old" },
  page: 1,
  sortField: "booking_date",
  sortDirection: "desc",
  granularity: "month",
  version: 0,
};

describe("dashboard request lifecycle", () => {
  it("ignores a late result from an aborted search", async () => {
    const api = createApiMock();
    const old = deferred();
    api.respondWith("/api/v1/transactions", (url) =>
      url.searchParams.get("search") === "old"
        ? old.promise
        : jsonResponse(page([income])),
    );
    const { result, rerender } = renderHook(
      (props) => useDashboardData(props),
      { initialProps: options },
    );
    const firstSignal = api.callsFor("/api/v1/transactions")[0].options.signal;
    rerender({ ...options, filters: { search: "new" } });
    expect(firstSignal.aborted).toBe(true);
    await waitFor(() =>
      expect(result.current.transactions.isLoading).toBe(false),
    );
    expect(result.current.transactions.data.items[0].id).toBe(income.id);
    await act(async () => old.resolve(jsonResponse(page([expense]))));
    expect(result.current.transactions.data.items[0].id).toBe(income.id);
  });

  it("aborts pending requests when unmounted, including StrictMode cleanup", () => {
    const api = createApiMock();
    const pending = deferred();
    api.respondWith("/api/v1/transactions", () => pending.promise);
    const { unmount } = renderHook(() => useDashboardData(options), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    unmount();
    const requests = api.callsFor("/api/v1/transactions");
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests)
      expect(request.options.signal.aborted).toBe(true);
  });
});
