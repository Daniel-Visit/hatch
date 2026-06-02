'use client';

import { useTranslations } from 'next-intl';
import type { BriefContent } from '@hatch/shared';
import { EditableField } from './editable-field';
import { RemovableChip } from './removable-chip';

type BriefSummaryPanelProps = {
  draft: BriefContent;
  completeness: number;
  manuallyEditedFields: string[];
  onPatch: (path: string, value: string) => void;
  onPatchArray: (path: string, value: string[]) => void;
};

export function BriefSummaryPanel({
  draft,
  completeness,
  manuallyEditedFields,
  onPatch,
  onPatchArray,
}: BriefSummaryPanelProps) {
  const t = useTranslations('Wanted');
  const mef = manuallyEditedFields;

  return (
    <aside className="brief-summary">
      <div className="brief-summary-head">
        <h3>{t('summary.title')}</h3>
        <span className="brief-quality">
          <span className="brief-quality-bar">
            <span
              className="brief-quality-bar-fill"
              style={{ width: `${Math.round(completeness * 100)}%` }}
            />
          </span>
          {completeness.toFixed(2)}
        </span>
      </div>
      <div className="brief-summary-body">
        <div className="brief-summary-note">
          <i>✎</i>
          <span>{t('Brief.editHint')}</span>
        </div>

        <EditableField
          path="title"
          label={t('labels.title')}
          value={draft.title ?? ''}
          manuallyEdited={mef.includes('title')}
          onPatch={onPatch}
        />

        <EditableField
          path="problem.trigger"
          label={t('labels.trigger')}
          value={draft.problem?.trigger ?? ''}
          manuallyEdited={mef.includes('problem.trigger')}
          onPatch={onPatch}
        />

        <EditableField
          path="desiredOutcome.definitionOfGoodEnough"
          label={t('labels.endState')}
          value={draft.desiredOutcome?.definitionOfGoodEnough ?? ''}
          manuallyEdited={mef.includes('desiredOutcome.definitionOfGoodEnough')}
          onPatch={onPatch}
        />

        <RemovableChip
          path="desiredOutcome.mustHaves"
          label={t('labels.mustHaves')}
          items={draft.desiredOutcome?.mustHaves ?? []}
          onPatch={onPatchArray}
        />

        <RemovableChip
          path="desiredOutcome.outOfScope"
          label={t('labels.outOfScope')}
          items={draft.desiredOutcome?.outOfScope ?? []}
          onPatch={onPatchArray}
        />

        <div className="brief-summary-section is-editable">
          <span className="brief-summary-label">{t('labels.technicalLevel')}</span>
          <select
            className="brief-summary-select"
            value={draft.context?.technicalLevel ?? ''}
            onChange={(e) => onPatch('context.technicalLevel', e.target.value)}
          >
            <option value="non_technical">{t('technicalLevel.nonTechnical')}</option>
            <option value="semi_technical">{t('technicalLevel.semiTechnical')}</option>
            <option value="developer">{t('technicalLevel.developer')}</option>
          </select>
        </div>

        <RemovableChip
          path="preferredSolutionType"
          label={t('labels.solutionPreference')}
          items={draft.preferredSolutionType ?? []}
          onPatch={onPatchArray}
        />
      </div>
    </aside>
  );
}
