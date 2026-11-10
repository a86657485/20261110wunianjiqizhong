import React from 'react';

/**
 * Upper recall image zone (normal document flow — not an absolute overlay).
 * Caption is a small tag. Never invent answer-leaking text.
 * Image uses object-fit:contain so it is not stretched.
 */
export default function RecallPanel({ question }) {
  if (!question) return null;
  const caption = question.recallCaption || question.recallSceneAnchor || '回忆当时学习画面';
  const src = question.recallImage;

  return (
    <div className="recall-zone">
      {src ? (
        <img
          className="recall-zone-img"
          src={'/' + String(src).replace(/^\//, '')}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const ph = e.currentTarget.nextSibling;
            if (ph) ph.style.display = 'flex';
          }}
        />
      ) : null}
      <div
        className="recall-zone-placeholder"
        style={{ display: src ? 'none' : 'flex' }}
        aria-hidden={!!src}
      >
        {question.recallSceneAnchor || '嘉年华回忆画板（插图占位）'}
      </div>
      <div className="recall-zone-caption">{caption}</div>
    </div>
  );
}
