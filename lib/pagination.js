import {paginationDirective} from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(paginationDirective, {}, 'onSummaryChange', 'slice');
}
