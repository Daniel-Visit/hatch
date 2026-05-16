'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from './cards';
import { CommentItem, type CommentNode, type AuthorMini } from './comment-item';
import { postComment, toggleCommentLike } from '@/lib/actions/comment';

type CommentsProps = {
  appId: string;
  slug: string;
  initialComments: CommentNode[];
  isAuthenticated: boolean;
  viewer?: AuthorMini;
};

export function Comments({ appId, slug, initialComments, isAuthenticated, viewer }: CommentsProps) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [comments, setComments] = useState<CommentNode[]>(initialComments);
  const [, startTransition] = useTransition();

  const fallbackViewer: AuthorMini = {
    handle: 'you',
    display_name: 'You',
    avatar_url: null,
    hue: 200,
    emoji: '◇',
  };

  const onAdd = (body: string) => {
    if (!isAuthenticated) {
      router.push(`/sign-in?next=/a/${slug}`);
      return;
    }
    const tempId = `temp-${Date.now()}`;
    const optimistic: CommentNode = {
      id: tempId,
      body,
      relative_time: 'just now',
      is_creator: false,
      likes_count: 0,
      viewer_liked: false,
      author: viewer ?? fallbackViewer,
    };
    setComments((prev) => [optimistic, ...prev]);
    startTransition(async () => {
      const res = await postComment({ appId, slug, body });
      if (!res.ok) {
        setComments((prev) => prev.filter((x) => x.id !== tempId));
      }
      router.refresh();
    });
  };

  const onToggleLike = (commentId: string) => {
    if (!isAuthenticated) {
      router.push(`/sign-in?next=/a/${slug}`);
      return;
    }
    setComments((prev) => prev.map((c) => recursiveToggle(c, commentId)));
    startTransition(async () => {
      const res = await toggleCommentLike({ commentId, slug });
      if (!res.ok) router.refresh();
    });
  };

  const send = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText('');
  };

  return (
    <div className="comments" id="comments-section">
      <div className="comments-head">
        <h3>Conversation</h3>
        <span className="comments-count">{comments.length} comments</span>
        <span className="comments-sort">sorted by · most loved</span>
      </div>

      <div className="comment-compose">
        <Avatar user={viewer ?? fallbackViewer} size={36} />
        <div className="comment-compose-body">
          <textarea
            className="comment-textarea"
            placeholder="Say something nice about this app…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="comment-compose-actions">
            <span className="comment-hint">
              <span className="comment-hint-kbd">⌘</span>
              <span className="comment-hint-kbd">↵</span>
              to post · Markdown supported
            </span>
            <button className="comment-send" disabled={!text.trim()} onClick={send}>
              Post comment
            </button>
          </div>
        </div>
      </div>

      <div className="comment-list">
        {comments.map((c) => (
          <CommentItem key={c.id} comment={c} onToggleLike={onToggleLike} />
        ))}
      </div>
    </div>
  );
}

function recursiveToggle(c: CommentNode, targetId: string): CommentNode {
  if (c.id === targetId) {
    return {
      ...c,
      viewer_liked: !c.viewer_liked,
      likes_count: c.likes_count + (c.viewer_liked ? -1 : 1),
    };
  }
  if (c.replies && c.replies.length > 0) {
    return { ...c, replies: c.replies.map((r) => recursiveToggle(r, targetId)) };
  }
  return c;
}
