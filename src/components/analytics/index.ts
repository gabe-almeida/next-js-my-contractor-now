/**
 * Analytics Components Index
 *
 * WHY: Provides a single entry point for all analytics-related components.
 * WHEN: Importing chart components or date filters in analytics pages.
 * HOW: Re-exports all public components and utilities.
 */

// Chart components
export {
  AnalyticsLineChart,
  AnalyticsBarChart,
  AnalyticsPieChart,
  AnalyticsAreaChart,
  StatCard,
  ChartCard,
  CHART_COLORS,
  PIE_COLORS,
} from './AnalyticsCharts';

// Date range components
export {
  DateRangePicker,
  QuickDateFilters,
  getDateRangeFromPreset,
} from './DateRangePicker';

// Type exports
export type { DateRange } from './DateRangePicker';
export type {
  ChartDataPoint,
  LineChartProps,
  BarChartProps,
  PieChartProps,
  AreaChartProps,
} from './AnalyticsCharts';
