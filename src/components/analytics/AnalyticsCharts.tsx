'use client';

/**
 * Analytics Charts Components
 *
 * WHY: Provides reusable chart components for analytics dashboards.
 *      Ensures consistent styling and behavior across affiliate/admin views.
 *
 * WHEN: Use these components on any analytics page requiring visual data.
 *
 * HOW: Import the specific chart component and pass data with config options.
 *      Built on recharts library for responsive, interactive charts.
 */

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface LineChartProps {
  data: ChartDataPoint[];
  lines: {
    dataKey: string;
    name: string;
    color: string;
    strokeWidth?: number;
  }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  xAxisKey?: string;
  formatXAxis?: (value: string) => string;
  formatTooltip?: (value: number, name: string) => string;
}

export interface BarChartProps {
  data: ChartDataPoint[];
  bars: {
    dataKey: string;
    name: string;
    color: string;
    stackId?: string;
  }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  xAxisKey?: string;
  formatXAxis?: (value: string) => string;
  formatTooltip?: (value: number, name: string) => string;
  layout?: 'vertical' | 'horizontal';
}

export interface PieChartProps {
  data: {
    name: string;
    value: number;
    color?: string;
  }[];
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  formatTooltip?: (value: number, name: string) => string;
}

export interface AreaChartProps {
  data: ChartDataPoint[];
  areas: {
    dataKey: string;
    name: string;
    color: string;
    fillOpacity?: number;
    stackId?: string;
  }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  xAxisKey?: string;
  formatXAxis?: (value: string) => string;
  formatTooltip?: (value: number, name: string) => string;
}

// =====================================
// DEFAULT COLORS
// =====================================

const CHART_COLORS = {
  primary: '#F97316', // Orange (brand)
  secondary: '#10B981', // Emerald
  tertiary: '#6366F1', // Indigo
  quaternary: '#8B5CF6', // Purple
  gray: '#6B7280',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.tertiary,
  CHART_COLORS.quaternary,
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F472B6', // Light pink
  '#A855F7', // Purple
];

// =====================================
// TOOLTIP COMPONENTS
// =====================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
  formatValue?: (value: number, name: string) => string;
}

function CustomTooltip({ active, payload, label, formatValue }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-900">
            {formatValue
              ? formatValue(entry.value as number, entry.name as string)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// =====================================
// CHART COMPONENTS
// =====================================

/**
 * Line Chart Component
 *
 * WHY: Best for showing trends over time (daily calls, earnings trends).
 * WHEN: Time-series data with continuous measurements.
 * HOW: Pass data array with date key and numeric values.
 */
export function AnalyticsLineChart({
  data,
  lines,
  height = 300,
  showGrid = true,
  showLegend = true,
  xAxisKey = 'date',
  formatXAxis,
  formatTooltip,
}: LineChartProps) {
  const defaultFormatXAxis = (value: string) => {
    const date = new Date(value);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
        <XAxis
          dataKey={xAxisKey}
          tickFormatter={formatXAxis || defaultFormatXAxis}
          stroke="#6B7280"
          fontSize={12}
        />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip
          content={<CustomTooltip formatValue={formatTooltip} />}
        />
        {showLegend && <Legend />}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color}
            strokeWidth={line.strokeWidth || 2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Bar Chart Component
 *
 * WHY: Best for comparing discrete categories or periods.
 * WHEN: Comparing values across campaigns, service types, etc.
 * HOW: Pass data array with category key and numeric values.
 */
export function AnalyticsBarChart({
  data,
  bars,
  height = 300,
  showGrid = true,
  showLegend = true,
  xAxisKey = 'date',
  formatXAxis,
  formatTooltip,
  layout = 'horizontal',
}: BarChartProps) {
  const defaultFormatXAxis = (value: string) => {
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(value);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
    return value;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
        {layout === 'horizontal' ? (
          <>
            <XAxis
              dataKey={xAxisKey}
              tickFormatter={formatXAxis || defaultFormatXAxis}
              stroke="#6B7280"
              fontSize={12}
            />
            <YAxis stroke="#6B7280" fontSize={12} />
          </>
        ) : (
          <>
            <XAxis type="number" stroke="#6B7280" fontSize={12} />
            <YAxis
              dataKey={xAxisKey}
              type="category"
              tickFormatter={formatXAxis || defaultFormatXAxis}
              stroke="#6B7280"
              fontSize={12}
              width={100}
            />
          </>
        )}
        <Tooltip content={<CustomTooltip formatValue={formatTooltip} />} />
        {showLegend && <Legend />}
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name}
            fill={bar.color}
            stackId={bar.stackId}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Pie/Donut Chart Component
 *
 * WHY: Best for showing composition/distribution of a total.
 * WHEN: Showing breakdown by campaign, service type, etc.
 * HOW: Pass data array with name and value pairs.
 */
export function AnalyticsPieChart({
  data,
  height = 300,
  showLegend = true,
  innerRadius = 0,
  outerRadius = 100,
  formatTooltip,
}: PieChartProps) {
  // Filter out zero values
  const filteredData = data.filter((d) => d.value > 0);

  if (filteredData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-500"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const CustomPieTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ value: number; name: string; payload: { fill: string } }>;
  }) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const entry = payload[0];
    const value = formatTooltip
      ? formatTooltip(entry.value as number, entry.name as string)
      : entry.value;

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 text-sm">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.payload.fill }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-900">{value}</span>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={filteredData}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {filteredData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomPieTooltip />} />
        {showLegend && <Legend />}
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * Area Chart Component
 *
 * WHY: Similar to line chart but emphasizes volume/magnitude.
 * WHEN: Showing cumulative values or emphasizing totals over time.
 * HOW: Pass data array with date key and numeric values.
 */
export function AnalyticsAreaChart({
  data,
  areas,
  height = 300,
  showGrid = true,
  showLegend = true,
  xAxisKey = 'date',
  formatXAxis,
  formatTooltip,
}: AreaChartProps) {
  const defaultFormatXAxis = (value: string) => {
    const date = new Date(value);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
        <XAxis
          dataKey={xAxisKey}
          tickFormatter={formatXAxis || defaultFormatXAxis}
          stroke="#6B7280"
          fontSize={12}
        />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip content={<CustomTooltip formatValue={formatTooltip} />} />
        {showLegend && <Legend />}
        {areas.map((area) => (
          <Area
            key={area.dataKey}
            type="monotone"
            dataKey={area.dataKey}
            name={area.name}
            stroke={area.color}
            fill={area.color}
            fillOpacity={area.fillOpacity || 0.3}
            stackId={area.stackId}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// =====================================
// STAT CARD COMPONENT
// =====================================

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: React.ReactNode;
  color?: 'orange' | 'emerald' | 'blue' | 'purple' | 'gray';
}

/**
 * Stat Card Component
 *
 * WHY: Displays key metrics with optional change indicator.
 * WHEN: Summary statistics at top of analytics pages.
 * HOW: Pass title, value, and optional change percentage.
 */
export function StatCard({ title, value, change, icon, color = 'orange' }: StatCardProps) {
  const colorClasses = {
    orange: 'bg-orange-50 text-orange-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          {change && (
            <div className="mt-2 flex items-center text-sm">
              {change.type === 'increase' && (
                <span className="text-emerald-600">+{change.value.toFixed(1)}%</span>
              )}
              {change.type === 'decrease' && (
                <span className="text-red-600">-{Math.abs(change.value).toFixed(1)}%</span>
              )}
              {change.type === 'neutral' && (
                <span className="text-gray-500">{change.value.toFixed(1)}%</span>
              )}
              <span className="ml-1 text-gray-500">vs last period</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================
// CHART CARD WRAPPER
// =====================================

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * Chart Card Wrapper
 *
 * WHY: Provides consistent styling for chart containers.
 * WHEN: Wrapping any chart component.
 * HOW: Pass title, optional subtitle, and chart as children.
 */
export function ChartCard({ title, subtitle, children, actions }: ChartCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {actions && <div>{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// Export color constants for custom styling
export { CHART_COLORS, PIE_COLORS };
