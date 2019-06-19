import React from 'preact';
import {filter} from '../smart-table-preact';
import {debounce} from './helpers';
const {h}=React;

const filterToType = (stType) => {
  switch (stType) {
    case 'date':
      return 'date';
    case 'number':
      return 'number';
    default:
      return 'text';
  }
};

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
    const {stFilterType, label} = this.props;
    return (
      <label>
        {label}
        <input type={filterToType(stFilterType)}
               placeholder={this.props.placeholder}
               value={this.state.value}
               onChange={this.onChange}/>
      </label>
    );
  }
});