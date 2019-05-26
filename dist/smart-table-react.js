(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global['smart-table-react'] = factory());
}(this, function () { 'use strict';

  function table (HOCFactory) {
    return HOCFactory(({table}) => table, {}, 'onDisplayChange');
  }

  function pointer(path) {
      const parts = path.split('.');
      const partial = (obj = {}, parts = []) => {
          const p = parts.shift();
          const current = obj[p];
          return (current === undefined || current === null || parts.length === 0) ?
              current : partial(current, parts);
      };
      const set = (target, newTree) => {
          let current = target;
          const [leaf, ...intermediate] = parts.reverse();
          for (const key of intermediate.reverse()) {
              if (current[key] === undefined) {
                  current[key] = {};
                  current = current[key];
              }
          }
          current[leaf] = Object.assign(current[leaf] || {}, newTree);
          return target;
      };
      return {
          get(target) {
              return partial(target, [...parts]);
          },
          set
      };
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
      const pter = statePter ? pointer(statePter) : {get: () => ({})};

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

  const proxyListener = (eventMap) => ({ emitter }) => {
      const eventListeners = {};
      const proxy = {
          off(ev) {
              if (!ev) {
                  Object.keys(eventListeners).forEach(eventName => proxy.off(eventName));
              }
              if (eventListeners[ev]) {
                  emitter.off(ev, ...eventListeners[ev]);
              }
              return proxy;
          }
      };
      for (const ev of Object.keys(eventMap)) {
          const method = eventMap[ev];
          eventListeners[ev] = [];
          proxy[method] = function (...listeners) {
              eventListeners[ev] = eventListeners[ev].concat(listeners);
              emitter.on(ev, ...listeners);
              return proxy;
          };
      }
      return proxy;
  };

  const TOGGLE_SORT = 'TOGGLE_SORT';
  const PAGE_CHANGED = 'CHANGE_PAGE';
  const EXEC_CHANGED = 'EXEC_CHANGED';
  const FILTER_CHANGED = 'FILTER_CHANGED';
  const SUMMARY_CHANGED = 'SUMMARY_CHANGED';
  const SEARCH_CHANGED = 'SEARCH_CHANGED';

  const filterListener = proxyListener({[FILTER_CHANGED]: 'onFilterChange'});

  var filterDirective = ({table, pointer, operator = 'includes', type = 'string'}) => Object.assign({
  	filter(input) {
  		const filterConf = {
  			[pointer]: [
  				{
  					value: input,
  					operator,
  					type
  				}
  			]

  		};
  		return table.filter(filterConf);
  	}
  }, filterListener({emitter: table}));

  const searchListener = proxyListener({[SEARCH_CHANGED]: 'onSearchChange'});

  var searchDirective = ({table, scope = []}) => Object.assign(searchListener({emitter: table}), {
  	search(input) {
  		return table.search({value: input, scope});
  	}
  });

  const sliceListener = proxyListener({[PAGE_CHANGED]: 'onPageChange', [SUMMARY_CHANGED]: 'onSummaryChange'});

  function sliceDirective ({table}) {
  	let {slice: {page: currentPage, size: currentSize}} = table.getTableState();
  	let itemListLength = table.length;

  	const api = {
  		selectPage(p) {
  			return table.slice({page: p, size: currentSize});
  		},
  		selectNextPage() {
  			return api.selectPage(currentPage + 1);
  		},
  		selectPreviousPage() {
  			return api.selectPage(currentPage - 1);
  		},
  		changePageSize(size) {
  			return table.slice({page: 1, size});
  		},
  		isPreviousPageEnabled() {
  			return currentPage > 1;
  		},
  		isNextPageEnabled() {
  			return Math.ceil(itemListLength / currentSize) > currentPage;
  		}
  	};
  	const directive = Object.assign(api, sliceListener({emitter: table}));

  	directive.onSummaryChange(({page: p, size: s, filteredCount}) => {
  		currentPage = p;
  		currentSize = s;
  		itemListLength = filteredCount;
  	});

  	return directive;
  }

  const sortListeners = proxyListener({[TOGGLE_SORT]: 'onSortToggle'});
  const directions = ['asc', 'desc'];

  function sortDirective ({pointer, table, cycle = false}) {
  	const cycleDirections = cycle === true ? ['none'].concat(directions) : [...directions].reverse();
  	let hit = 0;

  	const directive = Object.assign({
  		toggle() {
  			hit++;
  			const direction = cycleDirections[hit % cycleDirections.length];
  			return table.sort({pointer, direction});
  		}

  	}, sortListeners({emitter: table}));

  	directive.onSortToggle(({pointer: p}) => {
  		if (pointer !== p) {
  			hit = 0;
  		}
  	});

  	return directive;
  }

  const summaryListener = proxyListener({[SUMMARY_CHANGED]: 'onSummaryChange'});

  var summaryDirective = ({table}) => summaryListener({emitter: table});

  const executionListener = proxyListener({[EXEC_CHANGED]: 'onExecutionChange'});

  var workingIndicatorDirective = ({table}) => executionListener({emitter: table});

  const search = searchDirective;
  const slice = sliceDirective;
  const summary = summaryDirective;
  const sort = sortDirective;
  const filter = filterDirective;
  const workingIndicator = workingIndicatorDirective;

  function loadingIndicator (HOCFactory) {
    return HOCFactory(workingIndicator, {}, 'onExecutionChange');
  }

  function pagination (HOCFactory) {
    return HOCFactory(slice, {}, 'onSummaryChange', 'slice');
  }

  function search$1 (HOCFactory) {
    return HOCFactory(search, {stSearchScope: 'scope'}, 'onSearchChange', 'search');
  }

  function sort$1 (HOCFactory) {
    return HOCFactory(sort, {stSort: 'pointer', stSortCycle: 'cycle'}, 'onSortToggle', 'sort');
  }

  function summary$1 (HOCFactory) {
    return HOCFactory(summary, {}, 'onSummaryChange');
  }

  function filter$1 (HOCFactory) {
    return HOCFactory(filter, {
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
      search: search$1(HOCF),
      sort: sort$1(HOCF),
      summary: summary$1(HOCF),
      filter: filter$1(HOCF)
    };
  }

  return index;

}));
