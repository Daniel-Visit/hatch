'use client';
import { Avatar, fmtNum } from './cards';

export type AuthorMini = {
  handle: string;
  display_name: string;
  avatar_url: string | null;
  hue: number;
  emoji: string;
};

export type CommentNode = {
  id: string;
  body: string;
  relative_time: string;
  is_creator: boolean;
  likes_count: number;
  viewer_liked: boolean;
  author: AuthorMini;
  replies?: CommentNode[];
};

type CommentItemProps = {
  comment: CommentNode;
  onToggleLike: (commentId: string) => void;
  isReply?: boolean;
};

export function CommentItem({ comment, onToggleLike, isReply }: CommentItemProps) {
  const c = comment;
  const u = c.author;
  const totalLikes = c.likes_count;

  return (
    <div className="comment">
      <Avatar user={u} size={36} />
      <div className="comment-body">
        <div className="comment-head">
          <span className="comment-author">{u.display_name}</span>
          <span className="comment-handle">@{u.handle}</span>
          {c.is_creator && <span className="comment-creator-pill">Creator</span>}
          <span className="comment-time">· {c.relative_time}</span>
        </div>
        <p className="comment-text">{c.body}</p>
        <div className="comment-actions">
          <button
            className="cm-btn"
            data-on={c.viewer_liked ? '1' : '0'}
            onClick={() => onToggleLike(c.id)}
          >
            <i className="cm-i">{c.viewer_liked ? '♥' : '♡'}</i>
            <span>{fmtNum(totalLikes)}</span>
          </button>
          {!isReply && <button className="cm-btn">Reply</button>}
          <button className="cm-btn">Share</button>
        </div>
        {c.replies && c.replies.length > 0 && (
          <div className="comment-replies">
            {c.replies.map((r) => (
              <CommentItem key={r.id} comment={r} onToggleLike={onToggleLike} isReply />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
