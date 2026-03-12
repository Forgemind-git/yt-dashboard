const dayjs = require('dayjs');

function parseDateRange(query) {
  const to = query.to ? dayjs(query.to) : dayjs().subtract(1, 'day');
  const from = query.from ? dayjs(query.from) : to.subtract(27, 'day');
  const rangeDays = to.diff(from, 'day') + 1;
  const prevTo = from.subtract(1, 'day');
  const prevFrom = prevTo.subtract(rangeDays - 1, 'day');

  return {
    from: from.format('YYYY-MM-DD'),
    to: to.format('YYYY-MM-DD'),
    prevFrom: prevFrom.format('YYYY-MM-DD'),
    prevTo: prevTo.format('YYYY-MM-DD'),
  };
}

module.exports = { parseDateRange };
