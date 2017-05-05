import factory from '../index';
import react from 'react';

const {table, loadingIndicator, pagination, search, sort, summary, filter} = factory(react);

export {
  table,
  loadingIndicator,
  pagination,
  search,
  sort,
  summary,
  filter
};