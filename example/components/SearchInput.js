import React from 'preact';
import {search}  from '../smart-table-preact';
import {debounce} from './helpers'
const {h} = React;

export default search(class SearchInput extends React.Component {
  constructor (props) {
    const {stDirective} = props;
    super(props);
    this.onChange = this.onChange.bind(this);
    this.state = {text: ''};
    this.commitChange = debounce(() => {
      stDirective.search(this.state.text);
    }, props.delay || 300)
  }

  onChange (e) {
    const text = e.target.value.trim();
    this.setState({text});
    this.commitChange();
  }

  render () {
    return (
      <label>
        Search Input
        <input type="search"
               placeholder={this.props.placeholder}
               value={this.state.text}
               onChange={this.onChange}/>
      </label>
    );
  }
});