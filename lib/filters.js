import {filterDirective} from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(filterDirective, {
    stFilter: 'pointer',
    stFilterType: 'type',
    stFilterOperator: 'operator'
  }, 'onFilterChange', 'filter');
}
