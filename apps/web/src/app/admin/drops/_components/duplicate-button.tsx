"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { duplicateDrop } from "../_actions";
import { secondaryButtonClass } from "@/components/admin/ui";

export function DuplicateButton({
  dropId,
  className,
}: {
  dropId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={className ?? secondaryButtonClass}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await duplicateDrop(dropId);
            if (result.ok && "id" in result)
              router.push(`/admin/drops/${result.id}/edit`);
            else if (!result.ok) setError(result.message);
          });
        }}
      >
        {pending ? "Duplicating…" : "Duplicate"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
