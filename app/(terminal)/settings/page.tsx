import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isArenaDebugControlsEnabled } from "@/lib/agent/view";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerSecretStatus } from "@/lib/env.server";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const metadata = pageMetadataFromKey("settings");

export default function SettingsPage() {
  if (!isArenaDebugControlsEnabled()) {
    notFound();
  }
  const publicConfigured = isSupabaseConfigured();
  const secrets = getServerSecretStatus();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Settings"
        title="Environment"
        description="Secrets stay on the server. This page only shows whether required variables are present."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
              Public client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <EnvRow name="NEXT_PUBLIC_SUPABASE_URL" configured={publicConfigured} />
            <EnvRow
              name="NEXT_PUBLIC_SUPABASE_ANON_KEY (or PUBLISHABLE_KEY)"
              configured={publicConfigured}
            />
            <p className="text-xs text-faint">
              Persistence writes use the service role on the server. Realtime uses the public anon key in the browser. Apply `supabase/migrations/20260917120000_arena.sql` in the Supabase SQL editor, then set all three keys. The arena keeps working in memory until then.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
              Server secrets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <EnvRow
              name="SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)"
              configured={secrets.SUPABASE_SERVICE_ROLE_KEY}
            />
            <EnvRow name="CMC_API_KEY" configured={secrets.CMC_API_KEY} />
            <EnvRow name="GEMINI_API_KEY" configured={secrets.GEMINI_API_KEY} />
            <EnvRow name="GEMINI_MODEL" configured={secrets.GEMINI_MODEL} />
            <p className="text-xs text-faint">
              CMC_API_KEY and GEMINI_API_KEY stay on the server. Never use NEXT_PUBLIC_GEMINI_API_KEY. Secret values are never shown here.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
            Product rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>This is paper trading. No real funds are used.</p>
          <p>The AI will never mutate portfolio state directly.</p>
          <p>The Risk Engine decides whether a trade is allowed. The Paper Engine executes it.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function EnvRow({ name, configured }: { name: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <code className="text-xs text-foreground">{name}</code>
      <span
        className={
          configured
            ? "text-xs font-medium text-positive"
            : "text-xs font-medium text-tertiary"
        }
      >
        {configured ? "Configured" : "Missing"}
      </span>
    </div>
  );
}
