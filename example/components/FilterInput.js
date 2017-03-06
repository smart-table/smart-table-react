import React from 'react';
import {filter} from '../../dist/smart-table-react';
import {debounce} from './helpers';

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
               value={this.state.text}
               onChange={this.onChange}/>
      </label>
    );
  }
});