import {workingIndicatorDirective} from 'smart-table-core';

export default function (HOCFactory) {
  return HOCFactory(workingIndicatorDirective, {}, 'onExecutionChange');
}
