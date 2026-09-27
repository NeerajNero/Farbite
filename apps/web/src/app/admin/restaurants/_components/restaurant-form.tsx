"use client";

import { useActionState } from "react";
import type { Restaurant } from "@farbite/shared";
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
  initial?: Restaurant;
  onDone?: () => void;
  submitLabel: string;
};

export function RestaurantForm({
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
      <Field label="Name">
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
      <Field label="Address">
        <input
          name="address"
          defaultValue={initial?.address ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="Phone">
        <input
          name="phone"
          defaultValue={initial?.phone ?? ""}
          className={inputClass}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes">
          <textarea
            name="notes"
            rows={2}
            defaultValue={initial?.notes ?? ""}
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
