'use client';

// Publish screen — the "fill the template" form. Live preview on the right
// updates as the user types. Multi-section single page (not multi-step) so
// nothing is hidden; you can see everything you have to fill.
//
// VERBATIM PORT of prototype/apps-gallery/publish.jsx. CSS classNames, copy,
// glyphs, and JSX structure are byte-identical to the prototype. The only
// permitted deviations are the TypeScript adaptations called out in the spec:
// React Hook Form + zodResolver, server-fetched categories prop, hidden file
// input upload flow, and router-driven cancel/publish.

import { useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  PublishAppInput,
  type PublishAppInputT,
  ART_KINDS,
  ACCENT_COLORS,
} from '@/lib/zod/publish';
import { publishApp, getCoverUploadUrl } from '@/lib/actions/publish';
import { AppArt } from './app-art';
import {
  ClassicCard,
  type AppData,
  type Category as CardCategory,
  type User as CardUser,
} from './cards';

type Category = { id: string; label: string; icon: string };

type ViewerMini = {
  handle: string;
  display_name: string;
  avatar_url: string | null;
  hue: number;
  emoji: string;
};

export type PublishScreenProps = {
  categories: Category[];
  viewer: ViewerMini;
  cardStyle?: 'classic' | 'sticker' | 'dark' | 'mono' | 'bento';
};

export function PublishScreen({ categories, viewer, cardStyle = 'classic' }: PublishScreenProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { control, register, handleSubmit, watch, setValue, getValues } = useForm<PublishAppInputT>(
    {
      resolver: zodResolver(PublishAppInput),
      defaultValues: {
        title: 'Slow Forge',
        tagline: 'Forces you to write code on a 1980s typewriter rhythm. 60 wpm cap.',
        description:
          'Slow Forge gates every keystroke through a configurable delay model that mimics the cadence of a Selectric. Counter-intuitively, my commits got shorter and my reviews got faster. Maybe yours will too.',
        link: 'https://slow-forge.dev',
        categoryId: 'tools',
        tags: ['VS Code ext', 'TypeScript'],
        artKind: 'cursor',
        accent: '#a855f7',
        coverUrl: null,
      },
    },
  );

  const title = watch('title');
  const tagline = watch('tagline');
  const description = watch('description');
  const link = watch('link');
  const categoryId = watch('categoryId');
  const tags = watch('tags');
  const artKind = watch('artKind');
  const accent = watch('accent');

  const completion = [
    title,
    tagline,
    description,
    link,
    categoryId,
    tags.length >= 1,
    artKind,
    accent,
  ].filter(Boolean).length;
  const total = 8;
  const pct = Math.round((completion / total) * 100);

  // Map prototype's preview shape to local AppCard types. The prototype uses
  // string author/category; our typed cards expect User and Category objects.
  const previewCategory: CardCategory = categories.find((c) => c.id === categoryId) ?? {
    id: categoryId || 'tools',
    label: categoryId || 'Tools',
    icon: '🛠',
  };
  const previewAuthor: CardUser = {
    handle: viewer.handle,
    display_name: viewer.display_name,
    hue: viewer.hue,
    emoji: viewer.emoji,
  };
  const previewApp: AppData = {
    id: 'preview',
    title: title || 'Your app title',
    tagline: tagline || 'Your one-line pitch goes here.',
    author: previewAuthor,
    category: previewCategory,
    stats: { likes: 0, views: '—' as unknown as number },
    tags,
    art: artKind,
    accent,
  };

  const onSubmit = handleSubmit(async (data) => {
    const result = await publishApp(data);
    if (result.ok) {
      router.push(`/a/${result.data.slug}` as Route);
    }
  });

  const onCancel = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };

  const addTag = (raw: string) => {
    const t = raw.trim();
    const current = getValues('tags');
    if (t && !current.includes(t) && current.length < 6) {
      setValue('tags', [...current, t], { shouldValidate: true, shouldDirty: true });
    }
  };

  const removeTag = (t: string) => {
    const current = getValues('tags');
    setValue(
      'tags',
      current.filter((x) => x !== t),
      { shouldValidate: true, shouldDirty: true },
    );
  };

  const popTag = () => {
    const current = getValues('tags');
    if (current.length) {
      setValue('tags', current.slice(0, -1), { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <div className="publish">
      <div className="detail-crumbs">
        <button className="crumb-back" onClick={onCancel}>
          ← Cancel
        </button>
        <span className="crumb-sep">/</span>
        <span className="crumb-here">Publish a new app</span>
      </div>

      <div className="publish-head">
        <div>
          <h1>Ship it.</h1>
          <p>Fill the template, preview on the right, hit publish. Takes 90 seconds.</p>
        </div>
        <div className="publish-progress">
          <div className="prog-bar">
            <i style={{ width: pct + '%' }} />
          </div>
          <div className="prog-l">
            {completion}/{total} fields complete
          </div>
        </div>
      </div>

      <div className="publish-grid">
        <form className="publish-form" onSubmit={onSubmit}>
          <section className="psec">
            <header className="psec-head">
              <h2>The basics</h2>
              <p>Name, pitch, and a link people can click.</p>
            </header>
            <div className="psec-body">
              <label className="f">
                <span>
                  App name <i>required</i>
                </span>
                <input type="text" maxLength={32} {...register('title')} />
                <span className="f-hint">{(title ?? '').length}/32 · short, memorable</span>
              </label>
              <label className="f">
                <span>
                  One-line pitch <i>required</i>
                </span>
                <input type="text" maxLength={90} {...register('tagline')} />
                <span className="f-hint">
                  {(tagline ?? '').length}/90 · tell us what it does in a tweet
                </span>
              </label>
              <label className="f">
                <span>
                  Live link <i>required</i>
                </span>
                <input type="url" {...register('link')} />
                <span className="f-hint">URL where people can actually use the app</span>
              </label>
            </div>
          </section>

          <section className="psec">
            <header className="psec-head">
              <h2>Tell the story</h2>
              <p>The longer pitch. What it does, why it exists.</p>
            </header>
            <div className="psec-body">
              <label className="f">
                <span>The longer pitch</span>
                <textarea rows={5} {...register('description')} />
                <span className="f-hint">
                  What inspired it, what it does, what makes it different. Markdown ok.
                </span>
              </label>
            </div>
          </section>

          <section className="psec">
            <header className="psec-head">
              <h2>Discoverability</h2>
              <p>Help the right people stumble onto your app.</p>
            </header>
            <div className="psec-body">
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <label className="f">
                    <span>Category</span>
                    <div className="cat-grid">
                      {categories
                        .filter((c) => c.id !== 'all')
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={'cat-tile ' + (field.value === c.id ? 'is-on' : '')}
                            onClick={() => field.onChange(c.id)}
                          >
                            <span className="cat-tile-i">{c.icon}</span>
                            {c.label}
                          </button>
                        ))}
                    </div>
                  </label>
                )}
              />

              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <label className="f">
                    <span>
                      Tags <i>up to 6</i>
                    </span>
                    <div className="tag-input">
                      {field.value.map((t) => (
                        <span key={t} className="tag-pill">
                          {t}
                          <button type="button" onClick={() => removeTag(t)}>
                            ×
                          </button>
                        </span>
                      ))}
                      {field.value.length < 6 && (
                        <input
                          type="text"
                          placeholder="add a tag…"
                          onKeyDown={(e) => {
                            const target = e.currentTarget;
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTag(target.value);
                              target.value = '';
                            }
                            if (e.key === 'Backspace' && !target.value && field.value.length) {
                              popTag();
                            }
                          }}
                        />
                      )}
                    </div>
                    <span className="f-hint">
                      Press Enter to add. Use stack names, not buzzwords.
                    </span>
                  </label>
                )}
              />
            </div>
          </section>

          <section className="psec">
            <header className="psec-head">
              <h2>Cover art</h2>
              <p>Pick a vibe & accent. Or upload your own screenshot.</p>
            </header>
            <div className="psec-body">
              <Controller
                control={control}
                name="artKind"
                render={({ field }) => (
                  <label className="f">
                    <span>Pick a vibe</span>
                    <div className="art-picker">
                      {ART_KINDS.map((a) => (
                        <button
                          key={a}
                          type="button"
                          className={'art-tile ' + (field.value === a ? 'is-on' : '')}
                          onClick={() => field.onChange(a)}
                        >
                          <div className="art-tile-inner">
                            <AppArt kind={a} accent={accent} glyphSize={32} />
                          </div>
                        </button>
                      ))}
                    </div>
                    <span className="f-hint">
                      Or upload your own PNG (1200×800, {'<'} 2MB).{' '}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }}
                      >
                        Upload →
                      </a>
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const res = await getCoverUploadUrl({ filename: f.name });
                        if (!res.ok) return;
                        await fetch(res.data.signedUrl, {
                          method: 'PUT',
                          body: f,
                          headers: { 'Content-Type': f.type },
                        });
                        setValue('coverUrl', res.data.finalPath, { shouldDirty: true });
                      }}
                    />
                  </label>
                )}
              />

              <Controller
                control={control}
                name="accent"
                render={({ field }) => (
                  <label className="f">
                    <span>Accent color</span>
                    <div className="color-row">
                      {ACCENT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={'color-dot ' + (field.value === c ? 'is-on' : '')}
                          style={{ background: c }}
                          onClick={() => field.onChange(c)}
                        />
                      ))}
                    </div>
                  </label>
                )}
              />
            </div>
          </section>

          <div className="publish-actions">
            <button type="button" className="btn btn-ghost-2" disabled title="Drafts coming soon">
              Save draft
            </button>
            <button type="submit" className="btn btn-primary btn-lg">
              Publish to Hatch →
            </button>
          </div>
        </form>

        <aside className="publish-preview">
          <div className="prev-head">
            <span className="prev-dot" /> Live preview
            <span className="prev-style">style: {cardStyle}</span>
          </div>
          <div className="prev-stage">
            <ClassicCard app={previewApp} onOpen={() => {}} onAuthor={() => {}} />
          </div>
          <div className="prev-tips">
            <h4>Tips for getting on the front page</h4>
            <ul>
              <li>Ship a one-line pitch that makes someone laugh or curious.</li>
              <li>Real screenshots beat slick covers — show the actual thing.</li>
              <li>Reply to early comments. Builders remember.</li>
              <li>Add at least 2 tags so people in your stack can find it.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default PublishScreen;
