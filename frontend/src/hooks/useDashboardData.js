import { useEffect, useState } from "react";
import {
  getAvailableYears,
  getCategories,
  getCategoryTotals,
  getFinancialSummary,
  getTimeline,
  getTransactions,
} from "../api/financeApi";

function useApiResource(requestKey, load) {
  const [result, setResult] = useState({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    load(JSON.parse(requestKey), { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data, error: null });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data: null, error: error.message });
        }
      });

    return () => controller.abort();
  }, [load, requestKey]);

  const isLoading = result.key !== requestKey;

  return {
    data: result.data,
    error: isLoading ? null : result.error,
    isLoading,
  };
}

async function loadMetadata(_parameters, options) {
  const [summary, categories, years] = await Promise.all([
    getFinancialSummary(options),
    getCategories(options),
    getAvailableYears(options),
  ]);
  return { summary, categories, years };
}

function loadPage({ filters, page, sortField, sortDirection }, options) {
  return getTransactions(
    {
      ...filters,
      page,
      page_size: 10,
      sort_by: sortField,
      sort_direction: sortDirection,
    },
    options,
  );
}

async function loadAnalytics({ filters, granularity }, options) {
  const [timeline, categories] = await Promise.all([
    getTimeline({ ...filters, granularity }, options),
    getCategoryTotals(filters, options),
  ]);
  return { timeline, categories, granularity };
}

export default function useDashboardData({
  filters,
  page,
  sortField,
  sortDirection,
  granularity,
  version,
}) {
  // Separate keys keep page/sort changes from reloading the chart totals.
  const metadata = useApiResource(JSON.stringify({ version }), loadMetadata);
  const transactions = useApiResource(
    JSON.stringify({ filters, page, sortField, sortDirection, version }),
    loadPage,
  );
  const analytics = useApiResource(
    JSON.stringify({ filters, granularity, version }),
    loadAnalytics,
  );

  return { metadata, transactions, analytics };
}
