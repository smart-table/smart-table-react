import {searchDirective} from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(searchDirective, {stSearchScope: 'scope'}, 'onSearchChange', 'search');
}
