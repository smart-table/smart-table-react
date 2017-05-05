import React from 'preact';
import {pagination} from '../smart-table-preact';
const {h} = React;

export default pagination(({stDirective, colSpan, stState}) => {
  const isPreviousDisabled = !stDirective.isPreviousPageEnabled();
  const isNextDisabled = !stDirective.isNextPageEnabled();
  return <td colSpan={colSpan}>
    <div>
      <button disabled={isPreviousDisabled} onClick={stDirective.selectPreviousPage}>
        Previous
      </button>
      <span>Page {stState.page}</span>
      <button disabled={isNextDisabled} onClick={stDirective.selectNextPage}>
        Next
      </button>
    </div>
  </td>
});