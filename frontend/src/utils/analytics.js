const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  year: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
});

function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function getCurrentDayKey() {
  const now = new Date();
  const localTime = now.getTime() - now.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 10);
}

export function formatTimelineData(points, granularity) {
  const currentPeriod =
    granularity === "day" ? getCurrentDayKey() : getCurrentMonthKey();

  return points.map((point) => {
    const periodKey =
      granularity === "day" ? point.period : point.period.slice(0, 7);
    const formatter = granularity === "day" ? dayFormatter : monthFormatter;

    return {
      key: periodKey,
      label: formatter.format(new Date(`${point.period}T00:00:00`)),
      income: point.income,
      expenses: point.expenses,
      isCurrentPeriod: periodKey === currentPeriod,
    };
  });
}

export function collapseCategoryData(categories, maximumCategories = 6) {
  if (categories.length <= maximumCategories) {
    return categories;
  }

  const visibleCategories = categories.slice(0, maximumCategories);
  const remainingAmount = categories
    .slice(maximumCategories)
    .reduce((sum, category) => sum + category.amount, 0);

  return [...visibleCategories, { name: "Sonstige", amount: remainingAmount }];
}
