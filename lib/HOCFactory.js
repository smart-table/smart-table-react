import React from 'react';
import jsonPointer from 'smart-table-json-pointer';

const mapConfProp = (map) => (props) => {
  const output = {};
  for (let prop in map) {
    output[map[prop]] = props[prop];
  }
  return output;
};


export default function connect (directive, confMap, event, statePter) {
  const propMapper = mapConfProp(confMap);
  const pter = statePter ? jsonPointer(statePter) : {get: () => ({})};

  return function hoc (Wrapped) {
    return class HOC extends React.Component {
      constructor (props, context) {
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
        return React.createElement(Wrapped, Object.assign({stState, stDirective}, this.props), null);
      }
    };
  };
}
