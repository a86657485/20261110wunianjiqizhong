import React from 'react';

export default function StageNode({ node, onEnter }) {
  const locked = !node.unlocked;
  const done = node.completed;
  let statusClass = 'status-locked';
  let statusText = '未解锁';
  let nodeClass = 'stage-node locked';
  if (done) {
    statusClass = 'status-done';
    statusText = '已通关';
    nodeClass = 'stage-node completed';
  } else if (!locked) {
    statusClass = 'status-open';
    statusText = node.required === false ? '可选挑战' : '可进入';
    nodeClass = 'stage-node unlocked';
  }
  return (
    <button
      type="button"
      className={nodeClass}
      disabled={locked}
      onClick={() => !locked && onEnter && onEnter(node)}
      aria-label={node.stageName + ' ' + statusText}
    >
      <div className="order">
        {node.required === false ? '加分站' : '第 ' + node.stage + ' 站'}
      </div>
      <h3>{node.stageName}</h3>
      <div className={'status ' + statusClass}>{statusText}</div>
      <div className="muted" style={{ marginTop: 6, fontSize: '0.8rem' }}>
        {node.answeredCount}/{node.questionCount} 题
      </div>
    </button>
  );
}
