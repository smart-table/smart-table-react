import table from './lib/table';
import HOCFactory from './lib/HOCFactory';
import loadingIndicator from './lib/loadingIndicator';
import pagination from './lib/pagination';
import search from './lib/search';
import sort from './lib/sort';
import summary from './lib/summary';
import filter from './lib/filters';

export default function (react) {
  const HOCF = HOCFactory(react);
  return {
    table: table(HOCF),
    loadingIndicator: loadingIndicator(HOCF),
    HOCFactory: HOCF,
    pagination: pagination(HOCF),
    search: search(HOCF),
    sort: sort(HOCF),
    summary: summary(HOCF),
    filter: filter(HOCF)
  };
}