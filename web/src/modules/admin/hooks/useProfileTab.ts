// RED stub: the real hook lands in the GREEN commit.
export type ProfileTab = 'details' | 'security' | 'appearance';

export function useProfileTab(): { tab: ProfileTab; setTab: (tab: ProfileTab) => void } {
  return { tab: 'details', setTab: () => undefined };
}
