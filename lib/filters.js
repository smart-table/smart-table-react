import {filter} from 'smart-table-core';
import HOCFactory from './HOCFactory';

export default HOCFactory(filter, {
  stFilter: 'pointer',
  stFilterType: 'type',
  stFilterOperator: 'operator'
}, 'onFilterChange', 'filter');