'use client';

// Hatch landing mini app card — renders real DB app rows in GalleryPreview.
// Uses AppArt (string kind / hex accent) — the production cover renderer.
// Clickable when `slug` is provided (whole card wrapped in <Link>).

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { AppArt } from '@/app/_components/app-art';
import { LandingAvatar } from '@/app/_landing/avatar';
import { Heart, HeartFill, Comment, Arrow } from '@/app/_landing/icons';

export type MiniAppCardProps = {
  title: string;
  by: string;
  desc: string;
  cat: string;
  hearts: number;
  comments: number;
  kind?: string; // AppArt kind name, defaults to 'mesh'
  accent?: string; // hex color, defaults to '#a855f7'
  slug?: string; // when present, wraps card in Link to /a/<slug>
  hue?: number;
};

export const MiniAppCard = ({
  title,
  by,
  desc,
  cat,
  hearts,
  comments,
  kind,
  accent,
  slug,
  hue,
}: MiniAppCardProps) => {
  const [liked, setLiked] = useState(false);
  const [pop, setPop] = useState(false);
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLike = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLiked((l) => !l);
    setPop(true);
    if (popTimerRef.current) clearTimeout(popTimerRef.current);
    popTimerRef.current = setTimeout(() => setPop(false), 380);
  };

  useEffect(() => {
    return () => {
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
    };
  }, []);

  return (
    <article className="card appcard" style={{ position: 'relative' }}>
      <div className="appcard-art" aria-hidden="true">
        <AppArt kind={kind ?? 'mesh'} accent={accent ?? '#a855f7'} />
      </div>
      <div className="appcard-body">
        <div className="appcard-head">
          <LandingAvatar name={by} hue={hue} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="appcard-title"
              style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {title}
            </div>
            <div className="appcard-byline">by {by.toLowerCase()}</div>
          </div>
          <span className="appcard-cat">{cat}</span>
        </div>
        <p className="appcard-desc">{desc}</p>
        <div className="appcard-foot">
          <div className="appcard-stats">
            <button
              type="button"
              className={'like-btn ' + (liked ? 'liked' : '')}
              onClick={onLike}
              aria-label={liked ? 'Unlike' : 'Like'}
              aria-pressed={liked}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <span className={'heart ' + (pop ? 'heart-pop' : '')}>
                {liked ? <HeartFill size={12} /> : <Heart size={12} />}
              </span>
              {hearts + (liked ? 1 : 0)}
            </button>
            <span className="stat">
              <Comment size={12} />
              {comments}
            </span>
          </div>
          <Arrow size={14} />
        </div>
      </div>
      {slug && (
        <Link
          href={`/a/${slug}` as Route}
          aria-label={`Open ${title}`}
          style={{ position: 'absolute', inset: 0, zIndex: 0 }}
        >
          <span
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
            }}
          >
            Open {title}
          </span>
        </Link>
      )}
    </article>
  );
};
