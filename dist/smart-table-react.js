(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('smart-table-json-pointer'), require('smart-table-core')) :
  typeof define === 'function' && define.amd ? define(['smart-table-json-pointer', 'smart-table-core'], factory) :
  (global = global || self, global['smart-table-react'] = factory(global.smartTableJsonPointer, global.smartTableCore));
}(this, function (smartTableJsonPointer, smartTableCore) { 'use strict';

  function table (HOCFactory) {
    return HOCFactory(({table}) => table, {}, 'onDisplayChange');
  }

  const mapConfProp = (map) => (props) => {
    const output = {};
    for (let prop in map) {
      output[map[prop]] = props[prop];
    }
    return output;
  };

  function HOCFactory ({Component, createElement}) {
    return function connect (directive, confMap, event, statePter) {
      const propMapper = mapConfProp(confMap);
      const pter = statePter ? smartTableJsonPointer.pointer(statePter) : {get: () => ({})};

      return function hoc (Wrapped) {
        class HOC extends Component {
          constructor (props) {
            const {smartTable} = props;
            const conf = Object.assign({table: smartTable}, propMapper(props));
            super(props);
            this.directive = directive(conf);
            this.state = {stState: pter.get(smartTable.getTableState())};
          }

          componentDidMount () {
            this.directive[event](newStateSlice => {
              this.setState({stState: newStateSlice});
            });
          }

          componentWillUnmount () {
            this.directive.off();
          }

          render () {
            const stState = this.state.stState;
            const stDirective = this.directive;
            const children = this.props.children || [];
            return createElement(Wrapped, Object.assign({stState, stDirective}, this.props), children);
          }
        }

        HOC.displayName = `smart-table-hoc(${Wrapped.displayName || Wrapped.name || 'Component'})`;

        return HOC;
      };
    }
  }

  function loadingIndicator (HOCFactory) {
    return HOCFactory(smartTableCore.workingIndicatorDirective, {}, 'onExecutionChange');
  }

  function pagination (HOCFactory) {
    return HOCFactory(smartTableCore.paginationDirective, {}, 'onSummaryChange', 'slice');
  }

  function search (HOCFactory) {
    return HOCFactory(smartTableCore.searchDirective, {stSearchScope: 'scope'}, 'onSearchChange', 'search');
  }

  function sort (HOCFactory) {
    return HOCFactory(smartTableCore.sortDirective, {stSort: 'pointer', stSortCycle: 'cycle'}, 'onSortToggle', 'sort');
  }

  function summary (HOCFactory) {
    return HOCFactory(smartTableCore.summaryDirective, {}, 'onSummaryChange');
  }

  function filter (HOCFactory) {
    return HOCFactory(smartTableCore.filterDirective, {
      stFilter: 'pointer',
      stFilterType: 'type',
      stFilterOperator: 'operator'
    }, 'onFilterChange', 'filter');
  }

  function index (react) {
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

  return index;

}));
