import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Agent Performance — Bellwood Ventures',
  description: 'Monitor agent accuracy and founder agreement rates',
};

type AgentStats = {
  name: string;
  label: string;
  events7d: number;
  events30d: number;
  totalFeedback: number;
  avgRating: number | null;
  overrideCount: number;
  agreementRate: number | null;
};

const AGENTS = [
  { name: 'scout', label: 'Scout', feedbackType: 'scout_lead' as const },
  { name: 'appraiser', label: 'Appraiser', feedbackType: 'avm_result' as const },
  { name: 'counsel', label: 'Counsel', feedbackType: 'legal_step' as const },
  { name: 'marketer', label: 'Marketer', feedbackType: 'outreach_template' as const },
  { name: 'orchestrator', label: 'Orchestrator', feedbackType: null },
  { name: 'system', label: 'System', feedbackType: null },
];

const AgentsPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch stats for each agent
  const agentStats: AgentStats[] = await Promise.all(
    AGENTS.map(async (agent) => {
      const [events7d, events30d] = await Promise.all([
        database.agentEvent.count({
          where: { agent: agent.name as any, createdAt: { gte: sevenDaysAgo } },
        }),
        database.agentEvent.count({
          where: { agent: agent.name as any, createdAt: { gte: thirtyDaysAgo } },
        }),
      ]);

      let totalFeedback = 0;
      let avgRating: number | null = null;
      let overrideCount = 0;

      if (agent.feedbackType) {
        const [feedbackAgg, overrides] = await Promise.all([
          database.founderFeedback.aggregate({
            where: { targetType: agent.feedbackType, createdAt: { gte: thirtyDaysAgo } },
            _count: { id: true },
            _avg: { rating: true },
          }),
          database.founderFeedback.count({
            where: {
              targetType: agent.feedbackType,
              overrides: { not: null },
              createdAt: { gte: thirtyDaysAgo },
            },
          }),
        ]);

        totalFeedback = feedbackAgg._count.id;
        avgRating = feedbackAgg._avg.rating;
        overrideCount = overrides;
      }

      const agreementRate =
        totalFeedback > 0 ? ((totalFeedback - overrideCount) / totalFeedback) * 100 : null;

      return {
        name: agent.name,
        label: agent.label,
        events7d,
        events30d,
        totalFeedback,
        avgRating,
        overrideCount,
        agreementRate,
      };
    })
  );

  // Overall stats
  const totalEvents30d = agentStats.reduce((sum, a) => sum + a.events30d, 0);
  const totalFeedback30d = agentStats.reduce((sum, a) => sum + a.totalFeedback, 0);
  const allRatings = agentStats.filter((a) => a.avgRating !== null);
  const overallAvgRating =
    allRatings.length > 0
      ? allRatings.reduce((sum, a) => sum + (a.avgRating ?? 0), 0) / allRatings.length
      : null;

  return (
    <>
      <Header pages={[]} page="Agent Performance" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Overall stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Events (30d)</p>
            <p className="text-2xl font-bold">{totalEvents30d}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Feedback Given</p>
            <p className="text-2xl font-bold">{totalFeedback30d}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Avg Rating</p>
            <p className="text-2xl font-bold">
              {overallAvgRating !== null ? `${overallAvgRating.toFixed(1)}/5` : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Active Agents</p>
            <p className="text-2xl font-bold">
              {agentStats.filter((a) => a.events30d > 0).length}
            </p>
          </div>
        </div>

        {/* Agent cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agentStats.map((agent) => (
            <div key={agent.name} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">{agent.label}</h3>
                <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                  {agent.name}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Events (7d)</p>
                  <p className="font-semibold">{agent.events7d}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Events (30d)</p>
                  <p className="font-semibold">{agent.events30d}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Rating</p>
                  <p className="font-semibold">
                    {agent.avgRating !== null ? `${agent.avgRating.toFixed(1)}/5` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Agreement</p>
                  <p
                    className={`font-semibold ${
                      agent.agreementRate !== null
                        ? agent.agreementRate >= 80
                          ? 'text-emerald-600'
                          : agent.agreementRate >= 60
                            ? 'text-amber-600'
                            : 'text-red-600'
                        : ''
                    }`}
                  >
                    {agent.agreementRate !== null
                      ? `${agent.agreementRate.toFixed(0)}%`
                      : '—'}
                  </p>
                </div>
              </div>

              {agent.totalFeedback > 0 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {agent.totalFeedback} reviews, {agent.overrideCount} overrides
                </div>
              )}

              {agent.events30d === 0 && (
                <p className="mt-3 text-xs text-muted-foreground italic">
                  No activity in the last 30 days
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default AgentsPage;
