'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ContactModal } from '@/app/_components/contact-modal';
import { sendContactRequest } from '@/lib/actions/contact-requests';
import { toast } from 'sonner';

type Props = {
  app: { id: string; slug: string; title: string; accent: string; art_kind: string };
  author: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    hue: number;
    emoji: string | null;
  };
  viewer: {
    handle: string;
    display_name: string;
    avatar_url: string | null;
    hue: number;
    emoji: string | null;
  } | null;
  signedIn: boolean;
};

export function ContactCTA({ app, author, viewer, signedIn }: Props) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('Contact');
  const tDetail = useTranslations('Detail');

  const firstName = author.display_name.split(' ')[0];

  if (!signedIn) {
    // Anon: link to /sign-in?next back to this app
    return (
      <a
        href={`/sign-in?next=/a/${app.slug}`}
        className="btn btn-publish"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {tDetail('ContactFirstName', { name: firstName })}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-publish"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={() => setOpen(true)}
      >
        {tDetail('ContactFirstName', { name: firstName })}
      </button>
      <ContactModal
        open={open}
        app={app}
        author={author}
        viewer={viewer}
        onClose={() => setOpen(false)}
        onSubmit={async ({ role, note, link }) => {
          const result = await sendContactRequest({
            appId: app.id,
            recipientId: author.id,
            role,
            note,
            link: link || undefined,
            consent: true,
          });
          if (!result.ok) {
            throw new Error(result.error);
          }
          toast.success(t('RequestSent'));
        }}
      />
    </>
  );
}
