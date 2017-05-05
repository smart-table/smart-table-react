import React from 'preact';
import {filter} from '../smart-table-preact';
import {debounce} from './helpers';
const {h} = React;

export default filter(class FilterInput extends React.Component {
  constructor (props) {
    const {stDirective} = props;
    super(props);
    this.onChange = this.onChange.bind(this);
    this.state = {value: ''};
    this.commitChange = debounce(() => {
      stDirective.filter(this.state.value);
    }, props.delay || 300)
  }

  onChange (e) {
    const value = e.target.value.trim();
    this.setState({value});
    this.commitChange();
  }

  render () {
    const {options = []} = this.props;
    return (
      <label>
        Search Input
        <select onChange={this.onChange}>
          <option value="">-</option>
          {options.map(({label, value}) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    );
  }
});