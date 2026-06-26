'use client';

import { useTranslations } from 'next-intl';
import { RefinerUiComponent } from './refiner-ui';
import type { UiOutput } from './refiner-ui/types';

export type RefinerTurn = {
  role: 'agent' | 'user';
  content: string;
  streaming?: boolean;
  /**
   * A declarative UI component invocation rendered inline in this agent turn
   * (§4.4.0a). When `output` is set the component renders FROZEN (final
   * selection, no handlers); otherwise INTERACTIVE (awaiting the seeker).
   */
  uiCall?: {
    turnId: string;
    component: string;
    props: Record<string, unknown>;
    output?: UiOutput;
  };
};

export type TurnCounter = {
  current: number;
  max: number;
};

type RefinerTranscriptProps = {
  turns: RefinerTurn[];
  turnCounter: TurnCounter;
  userInitial?: string;
  /** Submit handler for an interactive UI component (by AGENT turn id). */
  onUiSubmit?: (turnId: string, component: string, output: UiOutput) => void;
  /** Disables interactive UI components while a submit/resume is in flight. */
  uiBusy?: boolean;
};

export function RefinerTranscript({
  turns,
  turnCounter,
  userInitial = 'D',
  onUiSubmit,
  uiBusy = false,
}: RefinerTranscriptProps) {
  const t = useTranslations('Wanted');

  return (
    <>
      <div className="refiner-head">
        <h1>{t('head.title')}</h1>
        <span className="turn-counter">{`turn ${turnCounter.current} / ${turnCounter.max}`}</span>
      </div>

      {turns.map((turn, index) => (
        <div key={index}>
          <div className={'refiner-bubble ' + (turn.role === 'agent' ? 'is-agent' : 'is-user')}>
            <div className="refiner-bubble-avatar">{turn.role === 'agent' ? '⬢' : userInitial}</div>
            <div className="refiner-bubble-content">{turn.content}</div>
          </div>

          {turn.uiCall && (
            <div className="refiner-bubble-component">
              {turn.uiCall.output !== undefined ? (
                <RefinerUiComponent
                  frozen
                  component={turn.uiCall.component}
                  props={turn.uiCall.props}
                  output={turn.uiCall.output}
                />
              ) : (
                <RefinerUiComponent
                  frozen={false}
                  component={turn.uiCall.component}
                  props={turn.uiCall.props}
                  disabled={uiBusy}
                  onSubmit={(output) =>
                    onUiSubmit?.(turn.uiCall!.turnId, turn.uiCall!.component, output)
                  }
                />
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
