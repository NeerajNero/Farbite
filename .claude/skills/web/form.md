# Skill: Form

react-hook-form + Zod + shadcn Form primitives. Working example: `src/app/(auth)/login/_components/login-form.tsx`.

## Pattern

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const featureSchema = z.object({
  email: z.email("Enter a valid email address"),
  name: z.string().min(1, "Name is required"),
});

type FeatureValues = z.infer<typeof featureSchema>;

export function FeatureForm({ onSuccess }: { onSuccess?: () => void }) {
  const form = useForm<FeatureValues>({
    resolver: zodResolver(featureSchema),
    defaultValues: { email: "", name: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FeatureValues) => api.<domain>.<method>({ dto: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEATURE_KEYS.all });
      toast.success("Saved");
      onSuccess?.();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong"),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Form>
  );
}
```

## Rules

- Zod v4 syntax: `z.email(...)` (not `z.string().email()`); message as the first argument
- Schema + inferred type colocated with the form; move to feature `_libs/` only when shared between create/edit
- Every field: `FormField → FormItem → FormLabel → FormControl → FormMessage`. Never render an input outside `FormControl`
- `defaultValues` always provided (controlled inputs from the first render)
- Submit through a React Query mutation; disable the submit button on `isPending`; toast both outcomes
- Edit forms: seed `defaultValues` from the fetched entity and use `form.formState.dirtyFields` when the API supports partial updates
- Selects/checkboxes: use the shadcn `Select`/`Checkbox` inside `FormControl` with `field.value`/`field.onChange`

## Where forms live

- Page-level forms (create/edit): `_components/<feature>-form.tsx`, rendered by `new/page.tsx` or `[id]/edit/page.tsx`
- Quick actions: inside a `Dialog`/`Sheet` from the list page — same form component, passed `onSuccess={() => setOpen(false)}`

## Anti-patterns

- Manual `useState` per field
- Validating in the submit handler instead of `zodResolver`
- `alert()`/inline error divs instead of `FormMessage` + `sonner`
- Calling SDK methods directly in `onSubmit` without a mutation (loses pending/error states and cache invalidation)
