import React from 'react';
import {sort} from '../../dist/smart-table-react';

function Header ({stSort, stDirective, stState, label}) {
  const {pointer, direction} = stState;
  let className = '';
  if (pointer === stSort) {
    switch (direction) {
      case 'asc': {
        className = 'st-sort-asc';
        break;
      }
      case 'desc': {
        className = 'st-sort-desc';
        break;
      }

    }
  }
  return <th className={className} onClick={stDirective.toggle}>{label}</th>;
}

export default sort(Header);