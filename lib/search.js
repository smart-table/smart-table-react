import HOCFactory from './HOCFactory';
import {search} from 'smart-table-core';
export default HOCFactory(search, {stScope: 'scope'}, 'onSearchChange','search');