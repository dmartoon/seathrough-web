import type { ReactNode } from "react";

type SafetyNoticeScreenProps = {
  onBack?: () => void;
  onAcknowledge?: () => void;
  showBackButton?: boolean;
  inModal?: boolean;
};

function TriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="safety-notice-heading-icon">
      <path
        d="M12 3.4 21 19a1.2 1.2 0 0 1-1.04 1.8H4.04A1.2 1.2 0 0 1 3 19L12 3.4Z"
        fill="currentColor"
      />
      <path
        d="M12 8.1v5.9"
        stroke="#082137"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.9" r="1.15" fill="#082137" />
    </svg>
  );
}

function CheckSealIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="safety-bullet-icon">
      <path
        d="M12 3.2 15 4.5l3.2-.3 1.5 2.8 2.7 1.8-.9 3 .9 3-2.7 1.8-1.5 2.8-3.2-.3L12 20.8 9 19.5l-3.2.3-1.5-2.8L1.6 15.2l.9-3-.9-3 2.7-1.8 1.5-2.8L9 4.5 12 3.2Z"
        fill="currentColor"
      />
      <path
        d="m8.2 12.2 2.4 2.4 5.2-5.2"
        fill="none"
        stroke="#082137"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SafetyBullet({ children }: { children: ReactNode }) {
  return (
    <div className="safety-bullet">
      <CheckSealIcon />
      <p>{children}</p>
    </div>
  );
}

export function SafetyNoticeScreen({
  onBack,
  onAcknowledge,
  showBackButton = false,
  inModal = false,
}: SafetyNoticeScreenProps) {
  const content = (
    <div className={inModal ? "safety-notice-card is-modal" : "safety-notice-card"}>
      {showBackButton && onBack ? (
        <div className="safety-notice-topbar">
          <button
            type="button"
            className="detail-circle-button safety-notice-back-button"
            onClick={onBack}
            aria-label="Back"
            title="Back"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="detail-top-icon">
              <path
                d="M14.5 6.5 9 12l5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : null}

      <div className="safety-notice-heading">
        <TriangleIcon />
        <h2>Safety Notice</h2>
      </div>

      <p className="safety-notice-intro">
        SeaThrough is for informational purposes only. It provides estimates and forecasts for planning — ocean
        conditions can change quickly and may differ from predictions.
      </p>

      <div className="safety-notice-bullets">
        <SafetyBullet>This app does not guarantee conditions.</SafetyBullet>
        <SafetyBullet>Verify water visibility on-site before entering the water.</SafetyBullet>
        <SafetyBullet>
          Check multiple sources (e.g., NOAA/NWS marine forecast, buoy observations, local surf reports, and live
          cams) before diving.
        </SafetyBullet>
        <SafetyBullet>If conditions look unsafe, do not dive. Turn back early.</SafetyBullet>
        <SafetyBullet>Always follow safe diving practices and local rules.</SafetyBullet>
      </div>

      <p className="safety-notice-footnote">
        By tapping “I Understand”, you acknowledge this information and agree to use the app at your own discretion.
      </p>

      {onAcknowledge ? (
        <button type="button" className="primary-button safety-notice-action" onClick={onAcknowledge}>
          I Understand
        </button>
      ) : null}
    </div>
  );

  if (inModal) {
    return <div className="safety-notice-overlay">{content}</div>;
  }

  return <section className="safety-notice-page">{content}</section>;
}
