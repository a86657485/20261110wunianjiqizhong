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
        <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>
          每张试卷只能交一次；交卷前退出可重新登录继续，交卷后不能重复作答。
        </p>
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
  const mainLocked = !!progress.mainSubmitted;
  return (
    <div className="card">
      <h2 style={{ marginTop: 0, color: '#c2410c' }}>闯关结果</h2>
      {mainLocked ? (
        <p className="muted" style={{ marginTop: 0 }}>
          本试卷已交卷，不能重复作答。加分挑战关仍可完成一次。
        </p>
      ) : null}
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
        {!mainLocked ? (
          <button type="button" className="btn-ghost" onClick={onMap}>
            回到站点地图
          </button>
        ) : null}
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

function FinishedPanel({ progress }) {
  const main = progress.firstSubmitMain;
  const ch = progress.firstSubmitChallenge;
  const submittedAt =
    main && main.at
      ? new Date(main.at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      : '—';
  return (
    <div className="card">
      <h2 style={{ marginTop: 0, color: '#c2410c' }}>本试卷已交卷</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        每张试卷只能作答一次，不能重复登录作答。如需更正，请联系老师。
      </p>
      <div className="stat-row">
        <div className="stat">
          <span className="muted">主卷百分</span>
          <b>{main ? main.percent : '—'}</b>
          <span className="muted">{main ? main.correct + '/' + main.total + ' 题对' : '—'}</span>
        </div>
        <div className="stat">
          <span className="muted">挑战加分</span>
          <b>{ch ? '+' + ch.bonus : progress.challengeSkipped ? '已跳过' : '—'}</b>
          <span className="muted">{ch ? ch.correct + '/' + ch.total + ' 题对' : '—'}</span>
        </div>
        <div className="stat">
          <span className="muted">综合分</span>
          <b>{main ? main.percent + (ch ? ch.bonus : 0) : '—'}</b>
          <span className="muted">主卷百分＋挑战加分</span>
        </div>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        交卷时间：{submittedAt}
      </p>
    </div>
  );
}

const LB_COLS = [
  { key: 'classId', label: '班', kind: 'text' },
  { key: 'name', label: '姓名', kind: 'text' },
  { key: 'mainPercent', label: '主卷%', kind: 'num' },
  { key: 'challengeBonus', label: '挑战+', kind: 'num' },
  { key: 'total', label: '综合', kind: 'num' },
  { key: 'mainStagesCompleted', label: '通关站', kind: 'num' },
];

function TeacherLeaderboard({ rows, keyword }) {
  const [sort, setSort] = useState({ key: 'total', dir: 'desc' });
  const [expanded, setExpanded] = useState(false);
  const kw = (keyword || '').trim();

  const scored = useMemo(
    () =>
      rows
        .filter((s) => s.mainPercent != null)
        .map((s) => ({ ...s, total: s.mainPercent + (s.challengeBonus || 0) })),
    [rows]
  );

  // 名次始终按当前班级（或全年级）全部已交卷学生计算；搜索只过滤显示，不重排名次
  const ranked = useMemo(() => {
    const order = [...scored].sort(
      (a, b) =>
        b.total - a.total ||
        b.mainPercent - a.mainPercent ||
        a.name.localeCompare(b.name, 'zh-Hans-CN')
    );
    const out = [];
    let last = null;
    let rank = 0;
    order.forEach((s, i) => {
      if (last === null || s.total !== last) rank = i + 1;
      out.push({ ...s, rank });
      last = s.total;
    });
    return out;
  }, [scored]);

  const matched = useMemo(
    () =>
      kw
        ? ranked.filter((s) => s.name.includes(kw) || String(s.classId).includes(kw))
        : ranked,
    [ranked, kw]
  );

  const sorted = useMemo(() => {
    const arr = [...matched];
    const dir = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN') * dir;
      if (sort.key === 'classId')
        return (a.classId + a.name).localeCompare(b.classId + b.name, 'zh-Hans-CN') * dir;
      const av = sort.key === 'challengeBonus' ? a.challengeBonus || 0 : a[sort.key] || 0;
      const bv = sort.key === 'challengeBonus' ? b.challengeBonus || 0 : b[sort.key] || 0;
      return (av - bv) * dir || a.rank - b.rank;
    });
    return arr;
  }, [matched, sort]);

  const visible = expanded ? sorted : sorted.slice(0, 10);

  function toggleSort(key) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: key === 'name' || key === 'classId' ? 'asc' : 'desc' }
    );
  }

  return (
    <div className="card lb-card">
      <div className="lb-head">
        <h3>排行榜</h3>
        <span className="muted">
          仅统计已交主卷 {ranked.length} 人 · 综合分 = 主卷% + 挑战加分 · 同分并列
          {kw ? ` · 已筛选「${kw}」，命中 ${matched.length} 人` : ''}
        </span>
      </div>
      {ranked.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          还没有学生交主卷，交卷后这里会自动出现排名。
        </p>
      ) : matched.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          没有匹配的学生。
        </p>
      ) : (
        <>
          <div className="lb-wrap">
            <table className="lb-table">
              <thead>
                <tr>
                  <th className="lb-rank-col">名次</th>
                  {LB_COLS.map((c) => (
                    <th
                      key={c.key}
                      aria-sort={
                        sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                    >
                      <button type="button" className="lb-sort" onClick={() => toggleSort(c.key)}>
                        {c.label}
                        <span className={'lb-arrow' + (sort.key === c.key ? ' on' : '')}>
                          {sort.key === c.key ? (sort.dir === 'desc' ? '▼' : '▲') : '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id}>
                    <td className={'lb-rank lb-rank-' + s.rank}>{s.rank}</td>
                    <td>{s.classId}</td>
                    <td>{s.name}</td>
                    <td>{s.mainPercent}</td>
                    <td>{s.challengeBonus != null ? '+' + s.challengeBonus : '—'}</td>
                    <td>
                      <b>{s.total}</b>
                    </td>
                    <td>{s.mainStagesCompleted}/7</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length > 10 ? (
            <button
              type="button"
              className="btn-ghost lb-toggle"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? '收起，只看前 10 名' : `展开全部 ${sorted.length} 人`}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function TeacherPage() {
  const [classId, setClassId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

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

  async function confirmDelete() {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.teacherDelete({ studentId: target.id });
      setNotice(
        r.removedStudent
          ? `已移除「${r.classId} ${r.name}」及其成绩，班级分母现为 ${r.denominator}。`
          : `已清除「${r.classId} ${r.name}」的成绩，可重新作答。`
      );
      setTarget(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const allRows = data && data.students ? data.students : [];
  const kw = keyword.trim();
  const rows = kw
    ? allRows.filter((s) => s.name.includes(kw) || String(s.classId).includes(kw))
    : allRows;

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
              <span className="muted">主卷题量</span>
              <b>{data.mainQuestionCount != null ? data.mainQuestionCount : '—'}</b>
            </div>
            <div className="stat">
              <span className="muted">命题</span>
              <b style={{ fontSize: '0.85rem' }}>{data.paperVersion}</b>
            </div>
          </div>
        ) : null}
        {error ? <div className="error-box">{error}</div> : null}
      </div>

      <TeacherLeaderboard rows={allRows} keyword={kw} />

      <div className="card teacher-table-wrap">
        <div className="teacher-tools">
          <input
            className="teacher-search"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setNotice('');
            }}
            placeholder="搜索姓名或班级，如 501 或 张"
            aria-label="搜索学生"
          />
          <span className="muted">
            {kw ? `匹配 ${rows.length} / ${allRows.length} 人` : `共 ${allRows.length} 人`}
          </span>
        </div>
        {notice ? <div className="ok-box">{notice}</div> : null}
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
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.classId}</td>
                <td>{s.name}</td>
                <td>{s.entered ? '是' : '否'}</td>
                <td>{s.stagesCompleted}</td>
                <td>{s.mainPercent != null ? s.mainPercent : '—'}</td>
                <td>{s.challengeBonus != null ? s.challengeBonus : '—'}</td>
                <td>
                  {s.byLesson && Object.keys(s.byLesson).length
                    ? Object.keys(s.byLesson)
                        .sort()
                        .map((L) => L + ':' + s.byLesson[L].correct + '/' + s.byLesson[L].total)
                        .join(' ')
                    : '—'}
                </td>
                <td>
                  {s.entered || s.manual ? (
                    <button type="button" className="btn-link-danger" onClick={() => setTarget(s)}>
                      {s.manual ? '移除该生' : '清除成绩'}
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="muted">没有匹配的学生。</p> : null}
        <p className="muted" style={{ marginBottom: 0 }}>
          不设达标线；正确率仅诊断。学生端不下发答案。更新于 {data && data.updatedAt}
        </p>
      </div>

      {target ? (
        <div className="modal-mask" role="dialog" aria-modal="true" aria-label="确认删除">
          <div className="modal-card">
            <h3>{target.manual ? '确认移除该生？' : '确认清除成绩？'}</h3>
            <p>
              <b>
                {target.classId} {target.name}
              </b>
              {target.manual
                ? '：该生不在原始名单中（手动添加），将同时从名单移除，班级分母减 1。'
                : '：该生的作答、交卷与挑战记录将全部删除，不可恢复。'}
            </p>
            <p className="muted">
              删除后该生可重新登录，从空白记录开始；若正在作答，其页面再操作也会重新开始。
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setTarget(null)}
                disabled={busy}
              >
                取消
              </button>
              <button type="button" className="btn-danger" onClick={confirmDelete} disabled={busy}>
                {busy ? '处理中…' : target.manual ? '确认移除' : '确认清除'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
    if (data.progress.finished) setView('finished');
    else if (data.progress.mainSubmitted) setView('result');
    else setView('map');
  }

  function enterStage(node) {
    if (!node) return;
    if (progress && progress.mainSubmitted && node.stageId !== 'gate_bonus') return;
    if (
      progress &&
      node.stageId === 'gate_bonus' &&
      (progress.challengeSubmitted || progress.challengeSkipped)
    ) {
      return;
    }
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
      // ONLY server-approved clearFeedback (stages[].clearFeedback encouraging text)
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
      setView(data.progress.finished ? 'finished' : 'result');
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
      setView(data.progress.finished ? 'finished' : 'result');
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
    setView(data.progress.finished ? 'finished' : 'result');
  }

  if (!student) return <LoginPage onLoggedIn={onLoggedIn} />;

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">算法嘉年华·站点通行证</div>
        <div className="chip">
          {student.classId} · {student.name}
          {paper ? ' · ' + paper.version.replace(/^\d{4}-\d{2}-\d{2}-midterm-/, '') : ''}
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
        <div style={{ margin: '8px auto 0', width: '100%', maxWidth: 1120 }}>
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
          studentId={student.id}
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
          onBackMap={() => setView(progress && progress.mainSubmitted ? 'result' : 'map')}
          backLabel={progress && progress.mainSubmitted ? '← 返回成绩' : '← 返回地图'}
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

      {view === 'finished' ? <FinishedPanel progress={progress} /> : null}

      {view === 'map' ? (
        <p className="muted map-footnote">
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
