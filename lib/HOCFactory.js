import {pointer as jsonPointer} from 'smart-table-json-pointer';

const mapConfProp = (map) => (props) => {
  const output = {};
  for (let prop in map) {
    output[map[prop]] = props[prop];
  }
  return output;
};

export default function ({Component, createElement}) {
  return function connect (directive, confMap, event, statePter) {
    const propMapper = mapConfProp(confMap);
    const pter = statePter ? jsonPointer(statePter) : {get: () => ({})};

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


