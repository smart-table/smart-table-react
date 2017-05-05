import {summary}  from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(summary, {}, 'onSummaryChange');
}