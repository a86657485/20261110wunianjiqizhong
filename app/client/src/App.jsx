import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './lib/api.js';
import CarnivalMap from './components/CarnivalMap.jsx';
import StageClearBanner from './components/StageClearBanner.jsx';
import QuestionView from './components/QuestionView.jsx';

function isTeacherPath() {
  return typeof location !== 'undefined' && location.pathname.indexOf('/teacher') === 0;
}

function answeredEnough(answer, question) {
  if (!question) return false;
  if (answer === undefined || answer === null || answer === '') return false;
  const key = question.interactionSpecKey || question.type;
  if (
    key === 'matching' ||
    key === 'matching_one_to_one' ||
    key === 'flowchart_order_cards' ||
    key === 'flowchart_fill_triple'
  ) {
    if (typeof answer !== 'object') return false;
    const need = question.left
      ? question.left.length
      : question.slots
        ? question.slots.length
        : 0;
    const filled = Object.keys(answer).filter((k) => answer[k] != null && answer[k] !== '').length;
    return need > 0 ? filled >= need : filled > 0;
  }
  return true;
}

function LoginPage({ onLoggedIn }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('501');
  const [selected, setSelected] = useState(null);
  const [manual, setManual] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.roster().then((d) => setClasses(d.classes || [])).catch((e) => setError(e.message));
  }, []);

  const students = useMemo(() => {
    const g = (classes || []).find((c) => c.id === classId);
    const list = (g && g.students) || [];
    const qq = q.trim();
    if (!qq) return list;
    return list.filter((s) => s.name.indexOf(qq) >= 0);
  }, [classes, classId, q]);

  async function doLogin(studentId, name, isManual) {
    setLoading(true);
    setError('');
    try {
      const body = studentId
        ? { studentId }
        : { classId, name, manual: !!isManual };
      const data = await api.login(body);
      onLoggedIn(data);
    } catch (e) {
      setError(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell login-shell">
      <div className="login-hero">
        <h1>算法嘉年华·站点通行证</h1>
        <p className="muted">五年级《身边的算法》期中闯关 · 选班级和姓名进入</p>
      </div>
      <div className="card login-card">
        <div className="class-pills">
          {['501', '502', '503', '504'].map((id) => (
            <button
              key={id}
              type="button"
              className={'class-pill' + (classId === id ? ' active' : '')}
              onClick={() => {
                setClassId(id);
                setSelected(null);
              }}
            >
              {id} 班
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索姓名"
          style={{
            width: '100%',
            minHeight: 44,
            padding: '10px 12px',
            borderRadius: 12,
            border: '2px solid #fed7aa',
            font: 'inherit',
          }}
        />
        <div className="name-list">
          {students.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'name-btn' + (selected && selected.id === s.id ? ' selected' : '')}
              onClick={() => setSelected(s)}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn-primary"
            disabled={!selected || loading}
            onClick={() => doLogin(selected.id)}
          >
            {loading ? '进入中…' : '确认进入嘉年华'}
          </button>
        </div>
        <hr style={{ border: 0, borderTop: '1px solid #fed7aa', margin: '16px 0' }} />
        <p className="muted" style={{ marginTop: 0 }}>
          名单里没有我的名字？可手动输入（归入当前班级）：
        </p>
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="输入姓名"
          style={{
            width: '100%',
            minHeight: 44,
            padding: '10px 12px',
            borderRadius: 12,
            border: '2px solid #fed7aa',
            font: 'inherit',
          }}
        />
        <div className="btn-row">
          <button
            type="button"
            className="btn-ghost"
            disabled={!manual.trim() || loading}
            onClick={() => doLogin(null, manual.trim(), true)}
          >
            手动姓名进入
          </button>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
      </div>
    </div>
  );
}

function ResultPanel({ progress, onMap, onChallenge, onSkipChallenge, onSubmitMain, submitting }) {
  const main = progress.firstSubmitMain;
  const ch = progress.firstSubmitChallenge;
  const mainPending = progress.mainReady && !progress.mainSubmitted;
  return (
    <div className="card">
      <h2 style={{ marginTop: 0, color: '#c2410c' }}>闯关结果</h2>
      {mainPending ? (
        <p className="muted" style={{ marginTop: 0 }}>
          先做挑战不会自动交主卷。主卷百分要点「提交主卷」后才计入。
        </p>
      ) : null}
      <div className="stat-row">
        <div className="stat">
          <span className="muted">主卷百分</span>
          <b>{main ? main.percent : '—'}</b>
          <span className="muted">{main ? main.correct + '/' + main.total + ' 题对' : '尚未交卷'}</span>
        </div>
        <div className="stat">
          <span className="muted">挑战加分</span>
          <b>{ch ? '+' + ch.bonus : progress.challengeSkipped ? '已跳过' : '—'}</b>
          <span className="muted">{ch ? ch.correct + '/' + ch.total + ' 题对' : '每对 +2，满分 +10'}</span>
        </div>
        <div className="stat">
          <span className="muted">综合分</span>
          <b>
            {main
              ? main.percent + (ch ? ch.bonus : 0)
              : '—'}
          </b>
          <span className="muted">主卷百分＋挑战加分</span>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn-ghost" onClick={onMap}>
          回到站点地图
        </button>
        {mainPending && onSubmitMain ? (
          <button
            type="button"
            className="btn-primary"
            onClick={onSubmitMain}
            disabled={!!submitting}
          >
            {submitting ? '提交中…' : '提交主卷 · 查看百分'}
          </button>
        ) : null}
        {progress.mainReady && !progress.challengeSubmitted && !progress.challengeSkipped ? (
          <>
            <button type="button" className={mainPending ? 'btn-ghost' : 'btn-primary'} onClick={onChallenge}>
              进入加分挑战关
            </button>
            <button type="button" className="btn-ghost" onClick={onSkipChallenge}>
              跳过挑战
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function TeacherPage() {
  const [classId, setClassId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .teacher(classId || null)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [classId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">教师大屏 · 算法嘉年华诊断</div>
        <div className="chip">免密 · 仅局域网</div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="class-pills">
          <button
            type="button"
            className={'class-pill' + (!classId ? ' active' : '')}
            onClick={() => setClassId('')}
          >
            全年级
          </button>
          {['501', '502', '503', '504'].map((id) => (
            <button
              key={id}
              type="button"
              className={'class-pill' + (classId === id ? ' active' : '')}
              onClick={() => setClassId(id)}
            >
              {id}
            </button>
          ))}
          <button type="button" className="btn-ghost" onClick={load}>
            刷新
          </button>
        </div>
        {data ? (
          <div className="stat-row">
            <div className="stat">
              <span className="muted">进入</span>
              <b>
                {data.entered}/{data.denominator}
              </b>
            </div>
            <div className="stat">
              <span className="muted">主卷已交</span>
              <b>{data.mainSubmitted}</b>
            </div>
            <div className="stat">
              <span className="muted">主卷均分</span>
              <b>{data.avgMainPercent != null ? data.avgMainPercent : '—'}</b>
            </div>
            <div className="stat">
              <span className="muted">命题</span>
              <b style={{ fontSize: '0.85rem' }}>{data.paperVersion}</b>
            </div>
          </div>
        ) : null}
        {error ? <div className="error-box">{error}</div> : null}
      </div>
      <div className="card" style={{ overflow: 'auto', maxHeight: '70vh' }}>
        <table className="teacher-table">
          <thead>
            <tr>
              <th>班</th>
              <th>姓名</th>
              <th>进入</th>
              <th>通关站</th>
              <th>主卷%</th>
              <th>挑战+</th>
              <th>分课正确（有首答时）</th>
            </tr>
          </thead>
          <tbody>
            {(data && data.students ? data.students : []).map((s) => (
              <tr key={s.id}>
                <td>{s.classId}</td>
                <td>{s.name}</td>
                <td>{s.entered ? '是' : '否'}</td>
                <td>{s.stagesCompleted}</td>
                <td>{s.mainPercent != null ? s.mainPercent : '—'}</td>
                <td>{s.challengeBonus != null ? s.challengeBonus : '—'}</td>
                <td>
                  {s.byLesson
                    ? Object.keys(s.byLesson)
                        .sort()
                        .map((L) => L + ':' + s.byLesson[L].correct + '/' + s.byLesson[L].total)
                        .join(' ')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginBottom: 0 }}>
          不设达标线；正确率仅诊断。学生端不下发答案。更新于 {data && data.updatedAt}
        </p>
      </div>
    </div>
  );
}

function StudentApp() {
  const [student, setStudent] = useState(null);
  const [paper, setPaper] = useState(null);
  const [progress, setProgress] = useState(null);
  const [view, setView] = useState('map'); // map | stage | clear | result
  const [activeStageId, setActiveStageId] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [localAnswers, setLocalAnswers] = useState({});
  const [clearFeedback, setClearFeedback] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const qById = useMemo(() => {
    const m = {};
    if (paper && paper.questions) {
      for (const q of paper.questions) m[q.id] = q;
    }
    return m;
  }, [paper]);

  const activeStage = useMemo(() => {
    if (!paper || !activeStageId) return null;
    return (paper.stages || []).find((s) => s.stageId === activeStageId) || null;
  }, [paper, activeStageId]);

  const stageQuestions = useMemo(() => {
    if (!activeStage) return [];
    return activeStage.questionIds.map((id) => qById[id]).filter(Boolean);
  }, [activeStage, qById]);

  const currentQ = stageQuestions[pageIndex] || null;

  const stageAnsweredCount = useMemo(() => {
    let n = 0;
    for (const q of stageQuestions) {
      if (answeredEnough(localAnswers[q.id], q)) n += 1;
    }
    return n;
  }, [stageQuestions, localAnswers]);

  function onLoggedIn(data) {
    setStudent(data.student);
    setPaper(data.paper);
    setProgress(data.progress);
    setLocalAnswers(Object.assign({}, data.progress.draftAnswers || {}));
    setView('map');
  }

  function enterStage(node) {
    setActiveStageId(node.stageId);
    setPageIndex(0);
    setClearFeedback('');
    setError('');
    setView('stage');
  }

  const saveAnswer = useCallback(
    async (questionId, answer) => {
      setLocalAnswers((prev) => ({ ...prev, [questionId]: answer }));
      if (!student) return;
      try {
        const data = await api.answer({ studentId: student.id, questionId, answer });
        setProgress(data.progress);
      } catch (e) {
        setError(e.message);
      }
    },
    [student]
  );

  async function submitStage() {
    if (!student || !activeStage) return;
    setSubmitting(true);
    setError('');
    try {
      const answers = {};
      for (const q of stageQuestions) answers[q.id] = localAnswers[q.id];
      const data = await api.submitStage({
        studentId: student.id,
        stageId: activeStage.stageId,
        answers,
      });
      setProgress(data.progress);
      // ONLY server-approved clearFeedback (v1.4.2 encouraging text)
      setClearFeedback(data.stageClearFeedback || '');
      setView('clear');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMain() {
    if (!student) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await api.submitMain({ studentId: student.id });
      setProgress(data.progress);
      setView('result');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitChallenge() {
    if (!student || !activeStage) return;
    setSubmitting(true);
    setError('');
    try {
      const answers = {};
      for (const q of stageQuestions) answers[q.id] = localAnswers[q.id];
      const data = await api.submitChallenge({ studentId: student.id, answers });
      setProgress(data.progress);
      setClearFeedback(data.stageClearFeedback || '');
      setView('result');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function skipChallenge() {
    if (!student) return;
    const data = await api.skipChallenge({ studentId: student.id });
    setProgress(data.progress);
    setView('result');
  }

  if (!student) return <LoginPage onLoggedIn={onLoggedIn} />;

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">算法嘉年华·站点通行证</div>
        <div className="chip">
          {student.classId} · {student.name}
          {paper ? ' · ' + paper.version.replace('2026-11-09-midterm-', '') : ''}
        </div>
      </div>
      {error ? <div className="error-box">{error}</div> : null}

      {view === 'map' ? (
        <CarnivalMap
          stageProgress={progress && progress.stageProgress}
          onEnter={enterStage}
          onSubmitMain={submitMain}
          mainReady={progress && progress.mainReady}
          mainSubmitted={progress && progress.mainSubmitted}
        />
      ) : null}

      {view === 'map' && progress && progress.mainSubmitted ? (
        <div style={{ marginTop: 8 }}>
          <ResultPanel
            progress={progress}
            onMap={() => setView('map')}
            onChallenge={() => {
              const bonus = (progress.stageProgress || []).find((s) => s.stageId === 'gate_bonus');
              if (bonus) enterStage(bonus);
            }}
            onSkipChallenge={skipChallenge}
            onSubmitMain={submitMain}
            submitting={submitting}
          />
        </div>
      ) : null}

      {view === 'clear' ? (
        <StageClearBanner
          feedback={clearFeedback}
          onBackMap={() => {
            setView('map');
            setClearFeedback('');
          }}
        />
      ) : null}

      {view === 'stage' && currentQ ? (
        <QuestionView
          question={currentQ}
          value={localAnswers[currentQ.id]}
          onChange={(ans) => saveAnswer(currentQ.id, ans)}
          stageName={activeStage && activeStage.stageName}
          answeredCount={stageAnsweredCount}
          questionCount={stageQuestions.length}
          pageIndex={pageIndex}
          pageTotal={stageQuestions.length}
          onPrev={() => setPageIndex((i) => Math.max(0, i - 1))}
          onNext={() => setPageIndex((i) => Math.min(stageQuestions.length - 1, i + 1))}
          onSubmitStage={
            activeStage && activeStage.stageId === 'gate_bonus' ? submitChallenge : submitStage
          }
          canSubmitStage={stageAnsweredCount >= stageQuestions.length}
          submitting={submitting}
        />
      ) : null}

      {view === 'result' ? (
        <ResultPanel
          progress={progress}
          onMap={() => setView('map')}
          onChallenge={() => {
            const bonus = (progress.stageProgress || []).find((s) => s.stageId === 'gate_bonus');
            if (bonus) enterStage(bonus);
          }}
          onSkipChallenge={skipChallenge}
          onSubmitMain={submitMain}
          submitting={submitting}
        />
      ) : null}

      {view === 'map' ? (
        <p className="muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>
          到时不强制锁死交卷。关内可改选至本关提交。学生端不显示答案与解析。
        </p>
      ) : null}
    </div>
  );
}

export default function App() {
  if (isTeacherPath()) return <TeacherPage />;
  return <StudentApp />;
}
