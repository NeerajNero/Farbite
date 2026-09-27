import type { AdminSettings } from "@farbite/shared";
import { adminFetch } from "@/app/_libs/api/admin";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

// §9.10 — read-only display so the founder can confirm prod env is right.
export default async function SettingsPage() {
  const s = await adminFetch<AdminSettings>("/v1/admin/settings");
  const rows: [string, string][] = [
    ["PAYMENT_PROVIDER", s.payment_provider],
    ["UPI_VPA", s.upi_vpa ?? "(not set)"],
    ["UPI_PAYEE_NAME", s.upi_payee_name ?? "(not set)"],
    [
      "ADMIN_EMAILS",
      s.admin_emails.length ? s.admin_emails.join(", ") : "(none)",
    ],
    ["ORDER_EXPIRY_MINUTES", String(s.order_expiry_minutes)],
    ["APP_BASE_URL", s.app_base_url ?? "(not set)"],
    ["SUPPORT_WHATSAPP", s.support_whatsapp ?? "(not set)"],
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Settings (read-only)" />
      <dl className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-3 py-2 sm:grid-cols-3">
            <dt className="font-mono text-xs text-neutral-500">{k}</dt>
            <dd className="sm:col-span-2">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-neutral-500">
        Values come from the API&apos;s environment. Edit them in the
        host&apos;s env config.
      </p>
    </div>
  );
}
