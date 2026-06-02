(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SportGroupOrder = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BUSINESS_ORDER = ['E', 'D', 'C', 'B', 'A'];

  function normalizeGroup(group) {
    return String(group || '').trim().toUpperCase();
  }

  function getSportGroupRank(group) {
    const normalized = normalizeGroup(group);
    const index = BUSINESS_ORDER.indexOf(normalized);
    if (index !== -1) return index;

    const letterCode = normalized.charCodeAt(0);
    if (letterCode >= 65 && letterCode <= 90) {
      return BUSINESS_ORDER.length + (90 - letterCode);
    }
    return BUSINESS_ORDER.length + 100;
  }

  function sortSportGroups(groups) {
    return [...new Set((groups || []).map(normalizeGroup).filter(Boolean))]
      .sort((a, b) => {
        const rankDiff = getSportGroupRank(a) - getSportGroupRank(b);
        if (rankDiff !== 0) return rankDiff;
        return a.localeCompare(b, 'en');
      });
  }

  return {
    BUSINESS_ORDER,
    normalizeGroup,
    getSportGroupRank,
    sortSportGroups
  };
});
