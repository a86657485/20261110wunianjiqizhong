import React from 'react';
import StageNode from './StageNode.jsx';

export default function CarnivalMap({ stageProgress, onEnter, onSubmitMain, mainReady, mainSubmitted }) {
  return (
    <div className="map-page page-fill">
      <div className="card">
        <h2 style={{ margin: '0 0 6px', color: '#c2410c' }}>嘉年华站点地图</h2>
        <p className="muted" style={{ margin: 0 }}>
          一站接一站闯关。本关题全部作答提交即可解锁下一站（不因分数卡关）。主卷 52 题，建议用时约 60–65 分钟。
        </p>
      </div>
      <div className="carnival-map">
        {(stageProgress || []).map((n) => (
          <StageNode key={n.stageId} node={n} onEnter={onEnter} />
        ))}
      </div>
      {mainReady ? (
        <div>
          {!mainSubmitted ? (
            <p className="muted" style={{ margin: '8px 0 0' }}>
              七站已齐：可先交主卷看百分，也可先点「加分挑战关」。进挑战不会自动交主卷。
            </p>
          ) : null}
          <div className="btn-row">
            <button type="button" className="btn-primary" onClick={onSubmitMain} disabled={mainSubmitted}>
              {mainSubmitted ? '主卷已交卷' : '提交主卷 · 查看百分'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
