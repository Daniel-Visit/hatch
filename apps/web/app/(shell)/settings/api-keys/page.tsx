import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { GenerateKeyFlow } from './_components/generate-key-flow';
import { McpConfigSnippet } from './_components/mcp-config-snippet';
import { revokeApiKey } from '@/lib/actions/api-keys';

export const dynamic = 'force-dynamic';

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL ?? 'http://localhost:8080/mcp';

function formatDate(iso: string | null, locale: string, neverLabel: string): string {
  if (!iso) return neverLabel;
  return new Date(iso).toLocaleString(locale);
}

export default async function ApiKeysPage() {
  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    redirect('/sign-in');
  }

  const t = await getTranslations('Settings.ApiKeysPage');
  const locale = await getLocale();
  const neverLabel = t('Never');

  const sb = await createSupabaseServerClient();
  const { data: activeKey } = await sb
    .from('api_keys')
    .select('id, label, token_prefix, created_at, last_used_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();

  async function handleRevoke(formData: FormData) {
    'use server';
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    await revokeApiKey({ id });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('Title')}</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('Subtitle')}</p>
      </header>

      {!activeKey ? (
        <section className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="text-lg font-medium">{t('NoActiveKey')}</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t('NoActiveKeyHint')}
          </p>
          <div className="mt-4">
            <GenerateKeyFlow />
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-medium">{activeKey.label}</h2>
                <p className="font-mono text-sm text-neutral-500">{activeKey.token_prefix}…****</p>
                <p className="text-xs text-neutral-500">
                  {t('Created', { when: formatDate(activeKey.created_at, locale, neverLabel) })} ·{' '}
                  {t('LastUsed', {
                    when: formatDate(activeKey.last_used_at, locale, neverLabel),
                  })}
                </p>
              </div>
              <form action={handleRevoke}>
                <input type="hidden" name="id" value={activeKey.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {t('Revoke')}
                </button>
              </form>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">{t('ConfigTitle')}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t.rich('ConfigSubtitle', {
                code: (chunks) => <code className="font-mono text-xs">{chunks}</code>,
              })}
            </p>
            <McpConfigSnippet endpoint={MCP_URL} />
          </section>
        </>
      )}
    </div>
  );
}
