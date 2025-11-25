'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface BarChartProps {
  title: string;
  data: Array<{
    [key: string]: any;
  }>;
  xAxisKey: string;
  bars: Array<{
    dataKey: string;
    fill: string;
    name: string;
  }>;
  height?: number;
  className?: string;
  loading?: boolean;
  stacked?: boolean;
}

export function BarChart({
  title,
  data,
  xAxisKey,
  bars,
  height = 300,
  className,
  loading = false,
  stacked = false
}: BarChartProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-32"></div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`bg-gray-100 rounded animate-pulse`} style={{ height }}>
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading chart...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey={xAxisKey}
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              labelStyle={{ color: '#374151' }}
            />
            {bars.length > 1 && <Legend />}
            {bars.map((bar, index) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                fill={bar.fill}
                name={bar.name}
                stackId={stacked ? 'stack' : undefined}
                radius={stacked ? undefined : [2, 2, 0, 0]}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}