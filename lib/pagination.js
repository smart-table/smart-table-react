import {slice} from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(slice, {}, 'onSummaryChange', 'slice');
}