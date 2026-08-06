import { NARRATION_CONFIG } from './config';

/**
 * Player-supplied piece names are substituted into authored lines as **data**,
 * never as markup (ADR 0004 §4.2, `narrative-llm` skill rule 5). Prompt injection
 * is not a runtime concern here — there is no runtime prompt — but a name still
 * reaches a rendered surface, so it is sanitized before substitution:
 *
 * - control characters (including newlines and the Unicode separators) removed,
 * - runs of whitespace collapsed to a single space,
 * - length capped so one piece cannot blow out a speech bubble,
 * - angle brackets and ampersands neutralized so the string is inert in any text
 *   or HTML context downstream (defense in depth; the UI must still render text).
 *
 * The result is never empty: a blank name falls back to a neutral placeholder so
 * a line never renders with a hole in it.
 */
export function sanitizeName(
  raw: string,
  maxLength: number = NARRATION_CONFIG.maxNameLength,
): string {
  const stripped = [...raw]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      // C0 and C1 control ranges, plus DEL.
      if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false;
      // Line/paragraph separators that survive the control-range check.
      if (code === 0x2028 || code === 0x2029) return false;
      return true;
    })
    .join('')
    .replace(/[<>&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const capped = [...stripped].slice(0, Math.max(0, maxLength)).join('').trim();
  return capped.length > 0 ? capped : 'the recruit';
}
