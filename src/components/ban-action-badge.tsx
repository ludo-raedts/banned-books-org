// Canonical vocabulary + visual system for the three censorship ACTIONS we
// record (bans.action_type). One source of truth for the label, the one-line
// definition, and the badge colour — reused by the book-page bans table, the
// timeline legend, and anywhere else an action is shown, so the terminology and
// colours never drift between pages.
//
// Definitions mirror the umbrella explained on /about and /challenged-books:
//   banned     — a legal prohibition (government law or court order)
//   restricted — an institutional removal (school / library / prison)
//   challenged — a formal complaint that resulted in removal or restriction
//
// Colour intensity tracks severity and matches the timeline's fill weight
// (banned = strongest/solid, challenged = lightest/outline).

type ActionMeta = { label: string; definition: string; classes: string }

const ACTIONS: Record<string, ActionMeta> = {
  banned: {
    label: 'Banned',
    definition: 'A legal prohibition — a government law or court order.',
    classes: 'bg-red-100 text-red-700',
  },
  restricted: {
    label: 'Restricted',
    definition: 'An institutional removal — a school, library, or prison withdrawing access.',
    classes: 'bg-amber-100 text-amber-800',
  },
  challenged: {
    label: 'Challenged',
    definition: 'A formal complaint that resulted in removal or restriction.',
    classes: 'bg-gray-200 text-gray-700',
  },
  // Legacy values that may still appear in old rows — folded onto the canonical three.
  removed: {
    label: 'Restricted',
    definition: 'An institutional removal — a school, library, or prison withdrawing access.',
    classes: 'bg-amber-100 text-amber-800',
  },
  blocked: {
    label: 'Banned',
    definition: 'A legal prohibition — a government law or court order.',
    classes: 'bg-red-100 text-red-700',
  },
}

const FALLBACK: ActionMeta = { label: 'Restricted', definition: 'An institutional removal or restriction.', classes: 'bg-gray-200 text-gray-700' }

const meta = (action: string): ActionMeta => ACTIONS[action] ?? FALLBACK

/** Display order so mixed clusters list actions consistently. */
export const ACTION_ORDER = ['banned', 'restricted', 'challenged', 'removed', 'blocked'] as const

export function banActionLabel(action: string): string {
  return meta(action).label
}

export function banActionDefinition(action: string): string {
  return meta(action).definition
}

/**
 * A labelled chip for a single censorship action. `count` (optional) appends a
 * multiplier when one cluster contains several bans of the same type.
 */
export default function BanActionBadge({ action, count }: { action: string; count?: number }) {
  const m = meta(action)
  return (
    <span
      title={m.definition}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${m.classes}`}
    >
      {m.label}
      {count && count > 1 ? <span className="opacity-70">×{count}</span> : null}
    </span>
  )
}
