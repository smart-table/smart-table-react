import React from 'preact';
import {summary} from '../smart-table-preact';
const {h}=React;

export default summary(({stState, colSpan}) => {
  const {page, size, filteredCount} =stState;
  const startItem = typeof page === 'number'
    ? ((page - 1) * size + (filteredCount > 0 ? 1 : 0))
    : 0;
  const endItem = typeof page === 'number'
    ? Math.min(filteredCount, page * size)
    : 0;
  const totalItems = typeof filteredCount === 'number'
    ? filteredCount
    : 0;
  return (
    <td colSpan={colSpan}>
      showing items <strong>{startItem}</strong> - <strong>{endItem}</strong> of <strong>{totalItems}</strong> matching items
    </td>
  );
});