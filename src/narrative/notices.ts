import noticesPack from './packs/military/notices.json';
import nounMapPack from './packs/military/nounMap.json';

/**
 * Fixed communications — the pre-authored system notices the game shows when
 * no piece is speaking (ADR 0023: pack data, role-abstract, placeholder
 * interpolation at render time).
 */
export type NoticeId = keyof typeof noticesPack.notices;

export interface FixedNotice {
  readonly title: string;
  readonly body: string;
}

export function noticeFor(id: NoticeId): FixedNotice {
  return noticesPack.notices[id];
}

export function renderNotice(
  id: NoticeId,
  params: Readonly<Record<string, string>> = {},
): FixedNotice {
  const entry = noticeFor(id);
  const render = (template: string): string =>
    template.replace(
      /\{(\w+)\}/g,
      (match, key: string) => params[key] ?? match,
    );
  return { title: render(entry.title), body: render(entry.body) };
}

/** The active pack's noun map — themes re-skin these nouns, never the keys. */
export const NOUN_MAP = nounMapPack;
