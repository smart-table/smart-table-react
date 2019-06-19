import React from 'react';
import SortableHeader from './components/SortableHeader';
import LoadingOverlay from './components/LoadingOverlay';
import SummaryFooter from './components/SummaryFooter';
import SearchInput from './components/SearchInput';
import Pagination from './components/Pagination';
import RowList from './components/RowList';
import FilterInput from './components/FilterInput';
import SelectInput from './components/FilterOptions';
import RangeSizeInput from './components/FilterSizeRange';
import reactDom from 'react-dom';

import {smartTable} from 'smart-table-core';

const t = smartTable({data, tableState: {sort: {}, filter: {}, slice: {page: 1, size: 15}}});

class Table extends React.Component {
  constructor (props) {
    super(props);
    this.smartTable = props.smartTable;
  }

  componentDidMount () {
    this.smartTable.exec();
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
            <SortableHeader smartTable={t} stSort="name.last" stSortCycle={true}><span>Last Name</span></SortableHeader>
            <SortableHeader smartTable={t} stSort="name.first">First Name</SortableHeader>
            <SortableHeader smartTable={t} stSort="gender">Gender</SortableHeader>
            <SortableHeader smartTable={t} stSort="birthDate">Birth date</SortableHeader>
            <SortableHeader smartTable={t} stSort="size">Size</SortableHeader>
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
      </div>
    );
  }
}

reactDom.render(
  <Table smartTable={t}/>
  , document.getElementById('table-container'));


