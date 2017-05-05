import {workingIndicator} from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(workingIndicator, {}, 'onExecutionChange');
}
