import React from 'preact';
import {loadingIndicator} from '../smart-table-preact';
const {h} = React;

export default loadingIndicator(({stState}) => {
  const {working} = stState;
  return <div id="overlay" className={working ? 'st-working' : ''}>Processing ...</div>;
});