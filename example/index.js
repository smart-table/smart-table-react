import React from 'react';
import ReactDOM from 'react-dom';
import SortableHeader from './components/SortableHeader';
import LoadingOverlay from './components/LoadingOverlay';
import SummaryFooter from './components/SummaryFooter';
import SearchInput from './components/SearchInput';
import Pagination from './components/Pagination';
import RowList from './components/RowList';
import FilterInput from './components/FilterInput';
import SelectInput from './components/FilterOptions';
import RangeSizeInput from './components/FilterSizeRange';

import table from 'smart-table-core';

const t = table({data, tableState: {sort: {}, filter: {}, slice: {page: 1, size: 20}}});

class Table extends React.Component {
  constructor (props) {
    super(props);
    this.smartTable = props.smartTable;
  }

  componentDidMount () {
    this.smartTable.exec();
    this.smartTable.dispatch('SUMMARY_CHANGED', {page: 1, size: 20, filteredCount: 200})
  }

  render () {
    const t = this.props.smartTable;
    return (<div>
      <LoadingOverlay smartTable={t}/>
      <table>
        <thead>
        <tr>
          <td colSpan="5">
            <SearchInput placeholder="case sensitive search on last name and first name" smartTable={t}
                         stScope={['name.first', 'name.last']}/>
          </td>
        </tr>
        <tr>
          <SortableHeader smartTable={t} stSort="name.last" stSortCycle={true} label="Name"/>
          <SortableHeader smartTable={t} stSort="name.first" label="First Name"/>
          <SortableHeader smartTable={t} stSort="gender" label="Gender"/>
          <SortableHeader smartTable={t} stSort="birthDate" label="Birth date"/>
          <SortableHeader smartTable={t} stSort="size" label="Size"/>
        </tr>
        <tr>
          <td>
            <FilterInput label="Name" smartTable={t} stFilter="name.last" stFilterType="string"
                         stFilterOperator="includes"/>
          </td>
          <td>
            <FilterInput label="First name" smartTable={t} stFilter="name.first" stFilterType="string"
                         stFilterOperator="includes"/>
          </td>
          <td>
            <SelectInput options={[{label: 'male', value: 'male'}, {label: 'female', value: 'female'}]} smartTable={t}
                         stFilter="gender" stFilterType="string" stFilterOperator="is"/>
          </td>
          <td>
            <FilterInput smartTable={t} label="Born after" stFilter="birthDate" stFilterType="date"
                         stFilterOperator="gte"/>
          </td>
          <td>
            <RangeSizeInput smartTable={t}/>
          </td>
        </tr>
        </thead>
        <RowList smartTable={t}/>
        <tfoot>
        <tr>
          <SummaryFooter smartTable={t} colSpan="3"/>
          <Pagination smartTable={t} colSpan="2"/>
        </tr>
        </tfoot>
      </table>
    </div>);
  }
}

ReactDOM.render(<Table smartTable={t}/>, document.getElementById('table-container'));


