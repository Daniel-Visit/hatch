'use client';

import { useTranslations } from 'next-intl';

export type RefinerTurn = {
  role: 'agent' | 'user';
  content: string;
  streaming?: boolean;
};

export type TurnCounter = {
  current: number;
  max: number;
};

type RefinerTranscriptProps = {
  turns: RefinerTurn[];
  turnCounter: TurnCounter;
  userInitial?: string;
};

export function RefinerTranscript({
  turns,
  turnCounter,
  userInitial = 'D',
}: RefinerTranscriptProps) {
  const t = useTranslations('Wanted');

  return (
    <>
      <div className="refiner-head">
        <h1>{t('head.title')}</h1>
        <span className="turn-counter">{`turn ${turnCounter.current} / ${turnCounter.max}`}</span>
      </div>

      {turns.map((turn, index) => (
        <div
          key={index}
          className={'refiner-bubble ' + (turn.role === 'agent' ? 'is-agent' : 'is-user')}
        >
          <div className="refiner-bubble-avatar">{turn.role === 'agent' ? '⬢' : userInitial}</div>
          <div className="refiner-bubble-content">{turn.content}</div>
        </div>
      ))}
    </>
  );
}
