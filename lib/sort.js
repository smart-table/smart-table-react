import {sortDirective} from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(sortDirective, {stSort: 'pointer', stSortCycle: 'cycle'}, 'onSortToggle', 'sort');
}
