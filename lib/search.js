import {search} from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(search, {stSearchScope: 'scope'}, 'onSearchChange', 'search');
}