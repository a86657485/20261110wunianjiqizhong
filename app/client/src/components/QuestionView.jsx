import React, { useMemo, useState, useEffect } from 'react';
import RecallPanel from './RecallPanel.jsx';
import StageProgressChip from './StageProgressChip.jsx';

/**
 * One question per page. Interaction focus must NOT hint the correct option
 * before the student answers (no yellow glow / hand on a single choice).
 */


function questionShowsRecall(question) {
  if (!question) return false;
  if (question.hasRecallImage === false) return false;
  return !!(question.recallImage || question.recallCaption || question.recallSceneAnchor);
}

function ChoiceOptions({ options, value, onChange }) {
  return (
    <div
      className={'option-list' + ((options || []).length >= 3 ? ' option-list--tiles' : '')}
      role="radiogroup"
    >
      {(options || []).map((opt) => {
        const picked = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={picked}
            className={'option-btn' + (picked ? ' picked' : '')}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function MatchingView({ left, right, value, onChange }) {
  const [activeLeft, setActiveLeft] = useState(null);
  const pairs = value || {};
  const usedRight = new Set(Object.values(pairs));

  function pickLeft(item) {
    setActiveLeft(item);
  }
  function pickRight(item) {
    if (!activeLeft) return;
    const next = { ...pairs };
    // clear previous mapping that used this right or this left
    for (const k of Object.keys(next)) {
      if (next[k] === item || k === activeLeft) delete next[k];
    }
    next[activeLeft] = item;
    onChange(next);
    setActiveLeft(null);
  }
  function clearPair(leftItem) {
    const next = { ...pairs };
    delete next[leftItem];
    onChange(next);
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        先点左边一项，再点右边配对（一对一）。点已配对左侧可清除。
      </p>
      <div className="matching">
        <div className="side-list">
          {(left || []).map((item) => (
            <button
              key={item}
              type="button"
              className={
                'side-item' +
                (activeLeft === item ? ' active' : '') +
                (pairs[item] ? ' filled' : '')
              }
              onClick={() => (pairs[item] ? clearPair(item) : pickLeft(item))}
            >
              {item}
              {pairs[item] ? ' →' : ''}
            </button>
          ))}
        </div>
        <div className="side-list">
          {(right || []).map((item) => (
            <button
              key={item}
              type="button"
              className={'side-item' + (usedRight.has(item) ? ' filled' : '')}
              onClick={() => pickRight(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <ul className="match-pairs">
        {Object.keys(pairs).map((k) => (
          <li key={k}>
            {k} → {pairs[k]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrderCardsView({ cards, slots, value, onChange }) {
  const mapping = value || {};
  const [activeSlot, setActiveSlot] = useState(slots && slots[0] ? slots[0] : null);
  const used = new Set(Object.values(mapping));

  function place(card) {
    if (!activeSlot) return;
    const next = { ...mapping };
    // remove card from any slot / clear active slot
    for (const k of Object.keys(next)) {
      if (next[k] === card) delete next[k];
    }
    next[activeSlot] = card;
    onChange(next);
    // move to next empty slot
    const idx = (slots || []).indexOf(activeSlot);
    const nextEmpty = (slots || []).find((s, i) => i > idx && !next[s]) ||
      (slots || []).find((s) => !next[s]);
    setActiveSlot(nextEmpty || activeSlot);
  }

  function clearSlot(slot) {
    const next = { ...mapping };
    delete next[slot];
    onChange(next);
    setActiveSlot(slot);
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        先点下方空位，再点卡片放入。点空位上的内容可清除。
      </p>
      <div className="slots-row">
        {(slots || []).map((slot) => (
          <button
            key={slot}
            type="button"
            className={'slot-box' + (activeSlot === slot ? ' active' : '')}
            onClick={() => (mapping[slot] ? clearSlot(slot) : setActiveSlot(slot))}
          >
            <div className="muted" style={{ fontSize: '0.75rem' }}>
              {slot}
            </div>
            <div>{mapping[slot] || '（空）'}</div>
          </button>
        ))}
      </div>
      <div className="cards-row">
        {(cards || []).map((card) => (
          <button
            key={card}
            type="button"
            className={'card-chip' + (used.has(card) ? ' used' : '')}
            onClick={() => place(card)}
            disabled={used.has(card)}
          >
            {card}
          </button>
        ))}
      </div>
    </div>
  );
}

function FillTripleView({ cards, slots, value, onChange }) {
  // slots: diamond / yes / no — same point-into-slot UX
  const labels = { diamond: '◇条件', yes: '是 →', no: '否 →' };
  const displaySlots = (slots || ['diamond', 'yes', 'no']).map((s) => ({
    id: s,
    label: labels[s] || s,
  }));
  const mapping = value || {};
  const [activeSlot, setActiveSlot] = useState(displaySlots[0] ? displaySlots[0].id : null);
  const used = new Set(Object.values(mapping));

  function place(card) {
    if (!activeSlot) return;
    const next = { ...mapping };
    for (const k of Object.keys(next)) {
      if (next[k] === card) delete next[k];
    }
    next[activeSlot] = card;
    onChange(next);
    const ids = displaySlots.map((s) => s.id);
    const idx = ids.indexOf(activeSlot);
    const nextEmpty = ids.find((s, i) => i > idx && !next[s]) || ids.find((s) => !next[s]);
    setActiveSlot(nextEmpty || activeSlot);
  }

  function clearSlot(slot) {
    const next = { ...mapping };
    delete next[slot];
    onChange(next);
    setActiveSlot(slot);
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        点选空位，再点卡片补全：条件与是／否出口。
      </p>
      <div className="slots-row">
        {displaySlots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            className={'slot-box' + (activeSlot === slot.id ? ' active' : '')}
            onClick={() => (mapping[slot.id] ? clearSlot(slot.id) : setActiveSlot(slot.id))}
          >
            <div className="muted" style={{ fontSize: '0.75rem' }}>
              {slot.label}
            </div>
            <div>{mapping[slot.id] || '（空）'}</div>
          </button>
        ))}
      </div>
      <div className="cards-row">
        {(cards || []).map((card) => (
          <button
            key={card}
            type="button"
            className={'card-chip' + (used.has(card) ? ' used' : '')}
            onClick={() => place(card)}
            disabled={used.has(card)}
          >
            {card}
          </button>
        ))}
      </div>
    </div>
  );
}

function PickInvalidView({ cards, value, onChange, diagram }) {
  return (
    <div>
      {diagram && diagram.note ? (
        <p className="muted" style={{ marginTop: 0 }}>
          {diagram.note}
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>
          点选不能放入菱形的那一张卡。
        </p>
      )}
      <ChoiceOptions options={cards} value={value} onChange={onChange} />
    </div>
  );
}

export default function QuestionView({
  question,
  value,
  onChange,
  stageName,
  answeredCount,
  questionCount,
  pageIndex,
  pageTotal,
  onPrev,
  onNext,
  onSubmitStage,
  canSubmitStage,
  submitting,
}) {
  const key = (question && (question.interactionSpecKey || question.type)) || '';

  const body = useMemo(() => {
    if (!question) return null;
    switch (key) {
      case 'single_choice':
      case 'app_op_choice':
      case 'flowchart_back_edge':
        return (
          <ChoiceOptions key={question.id} options={question.options} value={value} onChange={onChange} />
        );
      case 'flowchart_fix_choice':
        return (
          <div>
            <p className="muted" style={{ marginTop: 0 }}>
              点选应如何改正的那一项。
            </p>
            <ChoiceOptions options={question.options} value={value} onChange={onChange} />
          </div>
        );
      case 'matching':
      case 'matching_one_to_one':
        return (
          <MatchingView
            key={question.id}
            left={question.left}
            right={question.right}
            value={value || {}}
            onChange={onChange}
          />
        );
      case 'flowchart_order_cards':
        return (
          <OrderCardsView
            key={question.id}
            cards={question.cards}
            slots={question.slots}
            value={value || {}}
            onChange={onChange}
          />
        );
      case 'flowchart_fill_triple':
        return (
          <FillTripleView
            key={question.id}
            cards={question.cards}
            slots={question.slots}
            value={value || {}}
            onChange={onChange}
          />
        );
      case 'flowchart_pick_invalid':
        return (
          <PickInvalidView
            key={question.id}
            cards={question.cards}
            value={value}
            onChange={onChange}
            diagram={question.diagram}
          />
        );
      default:
        if (question.options) {
          return <ChoiceOptions options={question.options} value={value} onChange={onChange} />;
        }
        return <p className="error-box">暂不支持的交互：{key}</p>;
    }
  }, [question, key, value, onChange]);

  useEffect(() => {
    // scroll to top on question change
    window.scrollTo(0, 0);
  }, [question && question.id]);

  if (!question) return null;

  const showRecall = questionShowsRecall(question);
  const diagramVisual = question.diagram && question.diagram.visual;
  const diagramNote = question.diagram && question.diagram.note && key === 'flowchart_back_edge';

  return (
    <div className={'card question-page page-fill' + (showRecall ? '' : ' question-page--no-recall')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <StageProgressChip
          stageName={stageName}
          answeredCount={answeredCount}
          questionCount={questionCount}
        />
        <span className="chip">
          第 {pageIndex + 1}/{pageTotal} 题
        </span>
      </div>
      <div style={{ height: 6 }} />
      <div className={'qa-stack' + (showRecall ? '' : ' qa-stack--no-recall')}>
        {showRecall ? <RecallPanel question={question} /> : null}
        <div className="qa-body">
          <div className="scene-prompt">{question.prompt}</div>
          {diagramVisual ? <div className="state-board">{diagramVisual}</div> : null}
          {diagramNote ? (
            <p className="muted" style={{ marginTop: 0 }}>
              {question.diagram.note}
            </p>
          ) : null}
          <div className="scene-interact">{body}</div>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn-ghost" onClick={onPrev} disabled={pageIndex <= 0}>
          上一题
        </button>
        {pageIndex < pageTotal - 1 ? (
          <button type="button" className="btn-primary" onClick={onNext}>
            下一题
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={onSubmitStage}
            disabled={!canSubmitStage || submitting}
          >
            {submitting ? '提交中…' : '提交本关'}
          </button>
        )}
      </div>
    </div>
  );
}
