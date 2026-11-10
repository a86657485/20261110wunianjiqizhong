import React from 'react';

export default function StageProgressChip({ answeredCount, questionCount, stageName }) {
  return (
    <span className="chip" title="本关进度">
      {stageName || '本关'} · 已答 {answeredCount}/{questionCount}
    </span>
  );
}
