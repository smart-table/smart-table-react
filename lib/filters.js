import {filter} from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(filter, {
    stFilter: 'pointer',
    stFilterType: 'type',
    stFilterOperator: 'operator'
  }, 'onFilterChange', 'filter');
}