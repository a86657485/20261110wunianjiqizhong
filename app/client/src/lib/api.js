async function req(path, options) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options && options.headers) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || '请求失败');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  config: () => req('/api/config'),
  roster: () => req('/api/roster'),
  paper: () => req('/api/paper'),
  state: (studentId) => req('/api/state?studentId=' + encodeURIComponent(studentId)),
  teacher: (classId) =>
    req('/api/teacher' + (classId ? '?classId=' + encodeURIComponent(classId) : '')),
  login: (body) => req('/api/login', { method: 'POST', body: JSON.stringify(body) }),
  answer: (body) => req('/api/answer', { method: 'POST', body: JSON.stringify(body) }),
  submitStage: (body) => req('/api/stage/submit', { method: 'POST', body: JSON.stringify(body) }),
  submitMain: (body) => req('/api/main/submit', { method: 'POST', body: JSON.stringify(body) }),
  submitChallenge: (body) =>
    req('/api/challenge/submit', { method: 'POST', body: JSON.stringify(body) }),
  skipChallenge: (body) =>
    req('/api/challenge/skip', { method: 'POST', body: JSON.stringify(body) }),
};
