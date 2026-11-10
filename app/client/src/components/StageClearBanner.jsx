import React from 'react';

/** Only show server-approved clearFeedback — never invent answer text. */
export default function StageClearBanner({ feedback, onBackMap }) {
  if (!feedback) return null;
  return (
    <div className="clear-banner" role="status">
      <h2>站点通关</h2>
      <p style={{ margin: '0 0 12px', fontWeight: 600 }}>{feedback}</p>
      <button type="button" className="btn-primary" onClick={onBackMap}>
        回到站点地图
      </button>
    </div>
  );
}
