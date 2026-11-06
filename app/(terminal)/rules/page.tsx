import { RuleReviewView } from "@/components/rules/rule-review-view";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchRuleReview, RULE_REVIEW_WINDOW_DAYS } from "@/lib/arena/rule-review";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadataFromKey("rules");

export default async function RulesPage() {
  const summary = await fetchRuleReview();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Rules"
        title="Rule core review"
        description={`Last ${RULE_REVIEW_WINDOW_DAYS} days: how often each agent's rule traded, how often Gemini confirmed or vetoed it, and what the vetoes cost or saved.`}
      />

      {summary ? (
        <RuleReviewView summary={summary} />
      ) : (
        <EmptyState title="Rule review needs the arena database." description="Supabase persistence is not configured in this environment." />
      )}
    </div>
  );
}
