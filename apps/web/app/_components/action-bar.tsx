'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { fmtNum } from './cards';
import { toggleLike } from '@/lib/actions/like';
import { toggleSave } from '@/lib/actions/save';

type ActionBarProps = {
  appId: string;
  slug: string;
  initialLikesCount: number;
  initialLiked: boolean;
  initialSaved: boolean;
  commentCount: number;
  isAuthenticated: boolean;
};

export function ActionBar({
  appId,
  slug,
  initialLikesCount,
  initialLiked,
  initialSaved,
  commentCount,
  isAuthenticated,
}: ActionBarProps) {
  const router = useRouter();
  const t = useTranslations('Detail');
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikesCount);
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  const onLike = () => {
    if (!isAuthenticated) {
      router.push(`/sign-in?next=/a/${slug}`);
      return;
    }
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikes((n) => n + (nextLiked ? 1 : -1));
    startTransition(async () => {
      const res = await toggleLike({ appId, slug });
      if (!res.ok) {
        router.refresh();
      }
    });
  };

  const onSave = () => {
    if (!isAuthenticated) {
      router.push(`/sign-in?next=/a/${slug}`);
      return;
    }
    const nextSaved = !saved;
    setSaved(nextSaved);
    startTransition(async () => {
      const res = await toggleSave({ appId, slug });
      if (!res.ok) router.refresh();
    });
  };

  const onComments = () => {
    document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="action-bar">
      <button
        className="act-btn like"
        data-on={liked ? '1' : '0'}
        onClick={onLike}
        title={t('Love')}
      >
        <span className="act-i">{liked ? '♥' : '♡'}</span>
        <span className="act-num">{fmtNum(likes)}</span>
      </button>
      <button className="act-btn" onClick={onComments} title={t('Comments')}>
        <span className="act-i">◌</span>
        <span className="act-num">{commentCount}</span>
      </button>
      <button className="act-btn" title={t('Share')}>
        <span className="act-i">↗</span>
        <span>{t('Share')}</span>
      </button>
      <span className="act-sep" />
      <button className="act-btn" title={t('More')}>
        <span className="act-i">⋯</span>
      </button>
      <span className="act-grow" />
      <button className="act-save" data-saved={saved ? '1' : '0'} onClick={onSave}>
        {saved ? t('Saved') : t('Save')}
      </button>
    </div>
  );
}
