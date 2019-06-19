import {summaryDirective}  from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(summaryDirective, {}, 'onSummaryChange');
}
