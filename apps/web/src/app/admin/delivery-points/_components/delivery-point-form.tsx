"use client";

import { useActionState } from "react";
import type { DeliveryPoint } from "@farbite/shared";
import type { ActionResult } from "@/app/_libs/api/admin";
import {
  buttonClass,
  ErrorBox,
  Field,
  inputClass,
  secondaryButtonClass,
} from "@/components/admin/ui";

type Props = {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  initial?: DeliveryPoint;
  onDone?: () => void;
  submitLabel: string;
};

export function DeliveryPointForm({
  action,
  initial,
  onDone,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.ok) onDone?.();
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <Field label="Name" hint='e.g. "Sri Sai PG (Gents)"'>
        <input
          name="name"
          required
          defaultValue={initial?.name ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="Area">
        <input
          name="area"
          defaultValue={initial?.area ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="Landmark" hint='e.g. "Gate next to Chai Point"'>
        <input
          name="landmark"
          defaultValue={initial?.landmark ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="Sort order">
        <input
          name="sort_order"
          type="number"
          step={1}
          defaultValue={initial?.sort_order ?? 0}
          className={inputClass}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="Handover notes"
          hint='e.g. "Call security, they let us in"'
        >
          <textarea
            name="handover_notes"
            rows={2}
            defaultValue={initial?.handover_notes ?? ""}
            className={inputClass}
          />
        </Field>
      </div>
      {state && !state.ok && (
        <div className="sm:col-span-2">
          <ErrorBox message={state.message} details={state.details} />
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
