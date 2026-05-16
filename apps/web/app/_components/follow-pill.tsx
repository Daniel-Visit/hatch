'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toggleFollow } from '@/lib/actions/follow';

type FollowPillProps = {
  followeeId: string;
  followeeHandle: string;
  followerHandle: string;
  initialFollowing: boolean;
  isAuthenticated: boolean;
  isOwnProfile: boolean;
};

export function FollowPill({
  followeeId,
  followeeHandle,
  followerHandle,
  initialFollowing,
  isAuthenticated,
  isOwnProfile,
}: FollowPillProps) {
  const router = useRouter();
  const t = useTranslations('Following');
  const [following, setFollowing] = useState(initialFollowing);
  const [, startTransition] = useTransition();

  if (isOwnProfile) return null;

  const onClick = () => {
    if (!isAuthenticated) {
      router.push(`/sign-in?next=/u/${followeeHandle}`);
      return;
    }
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const res = await toggleFollow({
        followeeId,
        followeeHandle,
        followerHandle: followerHandle ?? 'guest',
      });
      if (!res.ok) router.refresh();
    });
  };

  // Prototype profile.jsx line 48-50: className="btn btn-ghost-2"
  // with glyph "+ Follow" (Icon name="plus" followed by text " Follow").
  // When following, show "✓ Following" to signal state.
  return (
    <button className="btn btn-ghost-2" data-following={following ? '1' : '0'} onClick={onClick}>
      {following ? t('FollowingButton') : t('FollowButton')}
    </button>
  );
}
