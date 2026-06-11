const SPECIAL_PERFORMANCE_ORDER = ['NM', 'DQ', 'DNF', 'DNS'];

function inferResultUnit(event = {}) {
  const name = String(event.name || '').trim();
  const category = String(event.category || '').trim();
  if (category === 'track' || category === 'relay') return '秒';
  if (category === 'field') return '米';
  if (/操|评分|分数|总分|拔河|团体/.test(name) || category === 'team') return '分';
  if (/跳|投|掷|球|标枪|铁饼|铅球/.test(name)) return '米';
  return '秒';
}

function inferRankingDirection(event = {}) {
  const category = String(event.category || '').trim();
  return category === 'field' || category === 'team' ? 'desc' : 'asc';
}

function inferResultInputHint(event = {}) {
  const unit = inferResultUnit(event);
  if (unit === '秒') return '输入数字或 mm:ss.xxx，越小越靠前';
  if (unit === '米') return '输入数字成绩，越大越靠前';
  return '输入数字成绩，越大越靠前';
}

function buildEventResultMeta(event = {}) {
  const unit = inferResultUnit(event);
  const rankingDirection = inferRankingDirection(event);
  return {
    unit,
    ranking_direction: rankingDirection,
    input_hint: inferResultInputHint(event),
    unit_label: `成绩单位：${unit}`,
    ranking_label: rankingDirection === 'asc' ? '按成绩从小到大自动排序' : '按成绩从大到小自动排序'
  };
}

function parsePerformanceValue(performance, event = {}) {
  const text = String(performance || '').trim().toUpperCase();
  if (!text) {
    return { kind: 'empty', raw: '' };
  }
  if (SPECIAL_PERFORMANCE_ORDER.includes(text)) {
    return {
      kind: 'special',
      raw: text,
      order: SPECIAL_PERFORMANCE_ORDER.indexOf(text)
    };
  }
  if (text.includes(':')) {
    const [minuteText, secondText] = text.split(':');
    const minutes = Number(minuteText);
    const seconds = Number(secondText);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return {
        kind: 'numeric',
        raw: text,
        value: (minutes * 60) + seconds,
        ranking_direction: inferRankingDirection(event)
      };
    }
  }
  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    return {
      kind: 'numeric',
      raw: text,
      value: numeric,
      ranking_direction: inferRankingDirection(event)
    };
  }
  return { kind: 'text', raw: text };
}

function compareParsedPerformance(a, b, event = {}) {
  const parsedA = parsePerformanceValue(a.performance, event);
  const parsedB = parsePerformanceValue(b.performance, event);
  if (parsedA.kind === 'empty' && parsedB.kind === 'empty') return 0;
  if (parsedA.kind === 'empty') return 1;
  if (parsedB.kind === 'empty') return -1;
  if (parsedA.kind === 'numeric' && parsedB.kind === 'numeric') {
    if (parsedA.value !== parsedB.value) {
      return inferRankingDirection(event) === 'desc'
        ? parsedB.value - parsedA.value
        : parsedA.value - parsedB.value;
    }
  } else if (parsedA.kind === 'numeric') {
    return -1;
  } else if (parsedB.kind === 'numeric') {
    return 1;
  } else if (parsedA.kind === 'special' && parsedB.kind === 'special') {
    if (parsedA.order !== parsedB.order) return parsedA.order - parsedB.order;
  } else if (parsedA.kind === 'special') {
    return -1;
  } else if (parsedB.kind === 'special') {
    return 1;
  }
  const studentCompare = String(a.student_id || a.user_id || a.id || '').localeCompare(String(b.student_id || b.user_id || b.id || ''));
  if (studentCompare !== 0) return studentCompare;
  return Number(a.id || 0) - Number(b.id || 0);
}

function rankScheduleResults(db, scheduleId) {
  const schedule = db.prepare(`
    SELECT s.id, s.event_id, e.name, e.category, e.event_type, e.gender_group
    FROM schedules s
    JOIN events e ON e.id = s.event_id
    WHERE s.id = ?
    LIMIT 1
  `).get(scheduleId);
  if (!schedule) {
    return {
      schedule_id: Number(scheduleId || 0),
      event_id: 0,
      ranked_count: 0,
      result_meta: buildEventResultMeta({})
    };
  }
  const rows = db.prepare(`
    SELECT r.id, r.user_id, r.performance, u.student_id
    FROM results r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.schedule_id = ?
    ORDER BY r.id
  `).all(scheduleId);
  const sortableRows = rows
    .filter((row) => String(row.performance || '').trim())
    .sort((a, b) => compareParsedPerformance(a, b, schedule));
  const updateRank = db.prepare(`
    UPDATE results
    SET rank = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `);
  const clearRank = db.prepare(`
    UPDATE results
    SET rank = 0, updated_at = datetime('now','localtime')
    WHERE schedule_id = ? AND COALESCE(performance, '') = ''
  `);
  clearRank.run(scheduleId);
  sortableRows.forEach((row, index) => {
    updateRank.run(index + 1, row.id);
  });
  return {
    schedule_id: Number(scheduleId || 0),
    event_id: Number(schedule.event_id || 0),
    ranked_count: sortableRows.length,
    result_meta: buildEventResultMeta(schedule)
  };
}

function autoRankSchedules(db, scheduleIds) {
  const uniqueIds = [...new Set((Array.isArray(scheduleIds) ? scheduleIds : [])
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0))];
  let totalRanked = 0;
  const affected = [];
  const txn = db.transaction(() => {
    uniqueIds.forEach((scheduleId) => {
      const summary = rankScheduleResults(db, scheduleId);
      totalRanked += Number(summary.ranked_count || 0);
      affected.push(summary);
    });
  });
  txn();
  return {
    ranked_count: totalRanked,
    affected
  };
}

module.exports = {
  buildEventResultMeta,
  parsePerformanceValue,
  compareParsedPerformance,
  rankScheduleResults,
  autoRankSchedules
};
