import {sort} from 'smart-table-core';
import HOCFactory from './HOCFactory';

export default HOCFactory(sort, {stSort: 'pointer', stSortCycle: 'cycle'}, 'onSortToggle','sort');