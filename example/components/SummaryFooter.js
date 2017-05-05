import React from 'preact';
import {summary} from '../smart-table-preact';
const {h}=React;

export default summary(({stState, colSpan}) => {
  const {page, size, filteredCount} =stState;
  return <td colSpan={colSpan}>
    showing items <strong>{(page - 1) * size + (filteredCount > 0 ? 1 : 0)}</strong> -
    <strong>{Math.min(filteredCount, page * size)}</strong> of <strong>{filteredCount}</strong> matching items
  </td>;
});