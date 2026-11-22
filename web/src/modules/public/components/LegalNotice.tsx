// SPEC-GAP: LegalNotice, the DRAFT notice of a legal page (UI-SPEC L1 item 1, D-14). A static box, not a live region. The page shows
// it only while the page is not approved. Deep imports only (PERF-01).
import { Icon } from '@/components/brand/Icon';
import { LEGAL_COPY } from '../legalCopy';
import { noticeClasses, noticeIconClasses, noticeLabelClasses, noticeSmallClasses } from './legal.recipe';

export function LegalNotice() {
  return (
    <div className={noticeClasses}>
      <Icon name="triangle-alert" size={20} className={noticeIconClasses} />
      <div>
        <p className={noticeLabelClasses}>{LEGAL_COPY.notice.label}</p>
        <p className={noticeSmallClasses}>{LEGAL_COPY.notice.detail}</p>
      </div>
    </div>
  );
}
