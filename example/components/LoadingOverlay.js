import React from 'react';
import {loadingIndicator} from '../../dist/smart-table-react';

export default loadingIndicator(({stState}) => {
  const {working} = stState;
  return <div id="overlay" className={working ? 'st-working' : ''}>Processing ...</div>;
});