import factory from '../index';
import {h, Component} from 'preact';

const {table, loadingIndicator, pagination, search, sort, summary, filter} = factory({createElement: h, Component});

export {
  table,
  loadingIndicator,
  pagination,
  search,
  sort,
  summary,
  filter
};