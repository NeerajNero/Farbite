import type { Actor } from './guards/actor.guard.js';

/** events.actor value for the current request (PLAN.md §6). */
export function actorLabel(
  actor: Actor,
  opts: { admin?: boolean } = {},
): string {
  if (actor.type === 'guest') return 'guest';
  return opts.admin ? `admin:${actor.userId}` : actor.userId;
}
