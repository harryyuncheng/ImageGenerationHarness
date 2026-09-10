import { z } from 'zod';

export const shortcutActions = [
  { id: 'focusPrompt', label: 'Focus prompt', scope: 'On the canvas' },
  { id: 'create', label: 'Create', scope: 'While editing the prompt' },
  { id: 'addImages', label: 'Add images', scope: 'Outside dialogs' },
  { id: 'openSettings', label: 'Open settings', scope: 'Outside dialogs' },
] as const;
export type ShortcutAction = (typeof shortcutActions)[number]['id'];

const bindingSchema = z.strictObject({
  key: z.string().min(1).max(32),
  ctrlKey: z.boolean(),
  altKey: z.boolean(),
  shiftKey: z.boolean(),
  metaKey: z.boolean(),
});
export type ShortcutBinding = z.infer<typeof bindingSchema>;
export type ShortcutBindings = Record<ShortcutAction, ShortcutBinding | null>;

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const primaryModifier = {
  ctrlKey: !isMac,
  altKey: false,
  shiftKey: false,
  metaKey: isMac,
};

export const defaultShortcuts: ShortcutBindings = {
  focusPrompt: { ...primaryModifier, key: 'k' },
  create: { ...primaryModifier, key: 'Enter' },
  addImages: { ...primaryModifier, shiftKey: true, key: 'o' },
  openSettings: { ...primaryModifier, key: '/' },
};

const modifiers = [
  { key: 'ctrlKey', label: isMac ? '\u2303' : 'Ctrl', aria: 'Control' },
  { key: 'altKey', label: isMac ? '\u2325' : 'Alt', aria: 'Alt' },
  { key: 'shiftKey', label: isMac ? '\u21e7' : 'Shift', aria: 'Shift' },
  { key: 'metaKey', label: isMac ? '\u2318' : 'Meta', aria: 'Meta' },
] as const;

export function formatShortcut(binding: ShortcutBinding | null): string {
  if (binding === null) return 'Not set';
  const key = binding.key === ' ' ? 'Space' : binding.key.toUpperCase();
  return [
    ...modifiers.filter(({ key: modifier }) => binding[modifier]).map(({ label }) => label),
    binding.key.length === 1 ? key : binding.key,
  ].join(isMac ? ' ' : ' + ');
}

export function shortcutAriaKeys(binding: ShortcutBinding | null): string | undefined {
  if (binding === null) return undefined;
  const key = binding.key === '+' ? 'plus' : binding.key === ' ' ? 'Space' : binding.key;
  return [
    ...modifiers.filter(({ key: modifier }) => binding[modifier]).map(({ aria }) => aria),
    key,
  ].join('+');
}

export function sameShortcut(
  first: ShortcutBinding | null,
  second: ShortcutBinding | null,
): boolean {
  if (first === null || second === null) return first === second;
  return first.key === second.key && modifiers.every(({ key }) => first[key] === second[key]);
}

export function shortcutFromEvent(event: KeyboardEvent): ShortcutBinding {
  return {
    key: event.key.length === 1 ? event.key.toLowerCase() : event.key,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
  };
}

export function matchesShortcut(event: KeyboardEvent, binding: ShortcutBinding | null): boolean {
  return (
    binding !== null &&
    !event.defaultPrevented &&
    !event.repeat &&
    !event.isComposing &&
    !event.getModifierState('AltGraph') &&
    sameShortcut(shortcutFromEvent(event), binding)
  );
}

function bindingProblem(binding: ShortcutBinding): string | undefined {
  if (!binding.ctrlKey && !binding.metaKey) {
    return 'Include Command or Ctrl so ordinary typing does not trigger an action.';
  }
  if (
    binding.key === ' ' ||
    (binding.key.length !== 1 &&
      binding.key !== 'Enter' &&
      !/^F(?:[1-9]|1[0-2])$/.test(binding.key))
  ) {
    return 'Use a letter, number, punctuation key, Enter, or a function key. Navigation keys stay unchanged.';
  }
  if (binding.key.length === 1 && binding.key !== binding.key.toLowerCase()) {
    return 'Record the shortcut again to use a valid key.';
  }
  const plainReserved = [
    'a',
    'c',
    'f',
    'h',
    'l',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'v',
    'w',
    'x',
    'y',
    'z',
    ',',
    '[',
    ']',
    '`',
  ];
  const shiftedReserved = ['n', 'q', 'r', 't', 'v', 'w', 'z', '~'];
  if (
    (!binding.altKey &&
      ((!binding.shiftKey &&
        (plainReserved.includes(binding.key) || /^[0-9]$/.test(binding.key))) ||
        (binding.shiftKey && shiftedReserved.includes(binding.key)) ||
        ['+', '=', '-', '_'].includes(binding.key))) ||
    (binding.metaKey && ['q', 'w'].includes(binding.key)) ||
    (binding.ctrlKey && ['F4', 'F5'].includes(binding.key)) ||
    (binding.metaKey && binding.shiftKey && ['3', '4', '5', '#', '$', '%'].includes(binding.key)) ||
    (isMac &&
      binding.ctrlKey &&
      !binding.metaKey &&
      !binding.altKey &&
      ['b', 'd', 'e', 'k', 'u'].includes(binding.key))
  ) {
    return 'That combination is reserved for browser, system, or text-editing commands.';
  }
  return undefined;
}

function conflictingAction(
  bindings: ShortcutBindings,
  action: ShortcutAction,
  binding: ShortcutBinding | null,
) {
  return binding === null
    ? undefined
    : shortcutActions.find(({ id }) => id !== action && sameShortcut(bindings[id], binding));
}

export function shortcutBindingError(
  bindings: ShortcutBindings,
  action: ShortcutAction,
  binding: ShortcutBinding | null,
): string | undefined {
  if (binding === null) return undefined;
  const problem = bindingProblem(binding);
  if (problem) return problem;
  const conflict = conflictingAction(bindings, action, binding);
  return conflict
    ? `${formatShortcut(binding)} is already assigned to ${conflict.label}. Change or remove that shortcut first.`
    : undefined;
}

export const shortcutBindingsSchema = z
  .record(
    z.enum(shortcutActions.map(({ id }) => id)),
    bindingSchema
      .superRefine((binding, context) => {
        const problem = bindingProblem(binding);
        if (problem) context.addIssue({ code: 'custom', message: problem });
      })
      .nullable(),
  )
  .superRefine((bindings, context) => {
    for (const action of shortcutActions) {
      const conflict = conflictingAction(bindings, action.id, bindings[action.id]);
      if (conflict) {
        context.addIssue({
          code: 'custom',
          message: `${action.label} and ${conflict.label} cannot share a shortcut.`,
          path: [action.id],
        });
        break;
      }
    }
  });
