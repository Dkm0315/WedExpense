import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BsWallet2,
  BsCurrencyRupee,
  BsGraphUpArrow,
  BsListCheck,
} from 'react-icons/bs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  getWedding,
  getWeddingSummary,
  getEventSummary,
  getCategorySummary,
  getAIInsights,
} from '../api/client';
import { formatINR, formatINRShort } from '../utils/format';

const CHART_COLORS = [
  '#a78bfa', '#f59e0b', '#34d399', '#f472b6', '#60a5fa', '#fb923c',
  '#c084fc', '#2dd4bf', '#fbbf24', '#818cf8', '#fb7185', '#a3e635',
];

interface Props {
  weddingId: string;
}

const BudgetSummaryContent: React.FC<Props> = ({ weddingId }) => {
  const [wedding, setWedding] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [eventData, setEventData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiInsights, setAiInsights] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDataSummary, setAiDataSummary] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [weddingData, summaryData, eventSummary, categorySummary] =
        await Promise.all([
          getWedding(weddingId),
          getWeddingSummary(weddingId).catch(() => null),
          getEventSummary(weddingId).catch(() => []),
          getCategorySummary(weddingId).catch(() => []),
        ]);
      setWedding(weddingData);
      setSummary(summaryData);
      setEventData(Array.isArray(eventSummary) ? eventSummary : []);
      setCategoryData(Array.isArray(categorySummary) ? categorySummary : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, [weddingId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalBudget = parseFloat(wedding?.total_budget || '0');
  const plannedBudget = parseFloat(summary?.planned_budget || '0');
  const totalSpent = parseFloat(summary?.total_spent || wedding?.total_spent || '0');
  const remaining = totalBudget - totalSpent;
  const allocatedPct = totalBudget > 0 ? Math.round((plannedBudget / totalBudget) * 100) : 0;
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const eventChartData = eventData.map((evt: any) => ({
    name: evt.event_name || 'Unknown',
    budget: parseFloat(evt.event_budget || '0'),
    spent: parseFloat(evt.total_spent || '0'),
  }));

  const categoryChartData = categoryData
    .filter((cat: any) => parseFloat(cat.total || cat.total_spent || '0') > 0)
    .map((cat: any) => ({
      name: cat.category || cat.category_name || 'Other',
      value: parseFloat(cat.total || cat.total_spent || '0'),
    }));

  const perSide = Array.isArray(summary?.per_side) ? summary.per_side : [];
  const sideMap: Record<string, number> = {};
  perSide.forEach((s: any) => { sideMap[s.paid_by] = parseFloat(s.total || '0'); });
  const sideChartData = [
    { name: 'Bride Side', value: sideMap['bride_side'] || 0 },
    { name: 'Groom Side', value: sideMap['groom_side'] || 0 },
    { name: 'Shared', value: sideMap['shared'] || 0 },
  ].filter((d) => d.value > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-dark-200 border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-white mb-1">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {formatINR(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-dark-200 border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-white">
          {payload[0].name}: {formatINR(payload[0].value)}
        </p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <BsWallet2 className="text-primary-300 text-lg" />
            </div>
            <span className="text-sm text-white/50">Total Budget</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatINR(totalBudget)}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <BsListCheck className="text-blue-400 text-lg" />
            </div>
            <span className="text-sm text-white/50">Planned</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{formatINR(plannedBudget)}</p>
          <p className="text-xs text-white/40 mt-1">{allocatedPct}% allocated</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <BsCurrencyRupee className="text-accent text-lg" />
            </div>
            <span className="text-sm text-white/50">Total Spent</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatINR(totalSpent)}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${remaining >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <BsGraphUpArrow className={`text-lg ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <span className="text-sm text-white/50">Remaining</span>
          </div>
          <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatINR(Math.abs(remaining))}
            {remaining < 0 && <span className="text-sm font-normal ml-1">over budget</span>}
          </p>
        </motion.div>
      </div>

      {/* Budget Progress Bar */}
      {totalBudget > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 mb-8">
          <div className="flex items-center justify-between text-xs text-white/50 mb-2">
            <span>Budget Utilization</span>
            <span>{spentPct}% spent · {allocatedPct}% planned</span>
          </div>
          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden mb-1.5">
            <div className="absolute inset-y-0 left-0 bg-blue-500/40 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(allocatedPct, 100)}%` }} />
          </div>
          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${spentPct > 100 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-primary to-accent'}`}
              style={{ width: `${Math.min(spentPct, 100)}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/50 inline-block" /> Planned ({allocatedPct}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-primary to-accent inline-block" /> Spent ({spentPct}%)
            </span>
          </div>
        </motion.div>
      )}

      {/* Per-Event Breakdown */}
      {eventChartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Per-Event Breakdown</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" tickFormatter={(v) => formatINRShort(v)} stroke="#ffffff30" tick={{ fill: '#ffffff60', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" stroke="#ffffff30" tick={{ fill: '#ffffff80', fontSize: 12 }} width={120} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#ffffff80', fontSize: 12 }} />
                <Bar dataKey="budget" name="Budget" fill="#7c3aed" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey="spent" name="Spent" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Category + Side Split Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {categoryChartData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">By Category</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                    {categoryChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend formatter={(value: string) => <span className="text-white/70 text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {sideChartData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Bride vs Groom Side</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sideChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" stroke="#ffffff30" tick={{ fill: '#ffffff80', fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatINRShort(v)} stroke="#ffffff30" tick={{ fill: '#ffffff60', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]} barSize={60}>
                    {sideChartData.map((_entry, index) => (
                      <Cell key={`bar-${index}`} fill={index === 0 ? '#f472b6' : index === 1 ? '#60a5fa' : '#a78bfa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {sideChartData.map((side, idx) => (
                <div key={side.name} className="text-center p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-white/50 mb-1">{side.name}</p>
                  <p className="text-sm font-bold" style={{ color: idx === 0 ? '#f472b6' : idx === 1 ? '#60a5fa' : '#a78bfa' }}>
                    {formatINR(side.value)}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* AI Budget Insights */}
      {(eventChartData.length > 0 || categoryChartData.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">AI Budget Advisor</h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={aiLoading}
              onClick={async () => {
                setAiLoading(true);
                setAiInsights('');
                try {
                  const result = await getAIInsights(weddingId);
                  setAiInsights(result.insights || 'No insights available.');
                  setAiDataSummary(result.data_summary || null);
                } catch (err: any) {
                  setAiInsights('Failed to get AI insights: ' + (err.message || 'Unknown error'));
                } finally {
                  setAiLoading(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl text-sm shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BsGraphUpArrow className="text-sm" />
                  Ask AI for Insights
                </>
              )}
            </motion.button>
          </div>

          {aiLoading && (
            <div className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin flex-shrink-0" />
              <p className="text-purple-300 text-sm">AI is analyzing your wedding budget...</p>
            </div>
          )}

          {!aiLoading && aiInsights && (
            <div className="space-y-4">
              {aiDataSummary && (
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="px-3 py-1 bg-white/5 rounded-full text-white/50">{aiDataSummary.expense_count} expenses analyzed</span>
                  <span className="px-3 py-1 bg-white/5 rounded-full text-white/50">{aiDataSummary.event_count} events</span>
                  <span className="px-3 py-1 bg-white/5 rounded-full text-white/50">{aiDataSummary.percent_used}% budget used</span>
                </div>
              )}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                {aiInsights.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="text-white/80 text-sm leading-relaxed mb-3 last:mb-0"
                    dangerouslySetInnerHTML={{
                      __html: paragraph
                        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
                        .replace(/₹([\d,]+)/g, '<span class="text-accent font-semibold">₹$1</span>')
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {!aiLoading && !aiInsights && (
            <p className="text-white/30 text-sm">Click "Ask AI for Insights" to get smart budget analysis powered by AI.</p>
          )}
        </motion.div>
      )}

      {/* No data fallback */}
      {eventChartData.length === 0 && categoryChartData.length === 0 && (
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-12 text-center">
          <p className="text-white/40 text-lg mb-2">No expense data yet</p>
          <p className="text-white/30 text-sm">Start adding expenses to see budget breakdowns and charts.</p>
        </div>
      )}
    </div>
  );
};

export default BudgetSummaryContent;
