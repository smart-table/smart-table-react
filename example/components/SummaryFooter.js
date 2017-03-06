import React from 'react';
import {summary} from '../../dist/smart-table-react';

export default summary(({stState, colSpan}) => {
  const {page, size, filteredCount} =stState;
  return <td colSpan={colSpan}>
    showing items <strong>{(page - 1) * size + (filteredCount > 0 ? 1 : 0)}</strong> -
    <strong>{Math.min(filteredCount, page * size)}</strong> of <strong>{filteredCount}</strong> matching items
  </td>;
});