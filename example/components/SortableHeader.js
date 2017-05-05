import React from 'preact';
import {sort} from '../smart-table-preact';
const {h}=React;

function Header (props) {
  const {stSort, stDirective, stState, children} = props;
  const {pointer, direction} = stState;
  let className = '';
  if (pointer === stSort) {
    if (direction === 'asc') {
      className = 'st-sort-asc';
    } else if (direction === 'desc') {
      className = 'st-sort-desc';
    }
  }
  return <th className={className} onClick={stDirective.toggle}>{children}</th>;
}

export default sort(Header);