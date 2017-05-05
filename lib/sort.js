import {sort} from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(sort, {stSort: 'pointer', stSortCycle: 'cycle'}, 'onSortToggle', 'sort');
}