import React from 'react';
import {debounce} from './helpers';

export default class RangeSizeInput extends React.Component {
  constructor (props) {
    super(props);
    const {smartTable} = props;
    this.state = {lowerValue: 150, higherValue: 200};
    this.commitChange = debounce(() => {
      const clauses = [];
      if (this.state.higherValue) {
        clauses.push({value: this.state.higherValue, operator: 'lte', type: 'number'});
      }
      if (this.state.lowerValue) {
        clauses.push({value: this.state.lowerValue, operator: 'gte', type: 'number'});
      }
      smartTable.filter({
        size: clauses
      })
    }, props.delay || 300);
    this.onLowerBoundaryChange = this.onLowerBoundaryChange.bind(this);
    this.onHigherBoundaryChange = this.onHigherBoundaryChange.bind(this);
  }

  onLowerBoundaryChange (e) {
    const lowerValue = e.target.value.trim();
    this.setState({lowerValue});
    this.commitChange();
  }

  onHigherBoundaryChange (e) {
    const higherValue = e.target.value.trim();
    this.setState({higherValue});
    this.commitChange();
  }

  render () {
    return <div>
      <label>Taller than:
        <input onChange={this.onLowerBoundaryChange} min="150" max="200" step="1" value={this.state.lowerValue}
               type="range"/>
      </label>
      <label>Smaller than:
        <input onChange={this.onHigherBoundaryChange} min="150" max="200" step="1" value={this.state.higherValue}
               type="range"/>
      </label>
    </div>;
  }
};