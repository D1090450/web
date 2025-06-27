import React, { useState } from 'react';
import './Filter.css';

const Filter = ({ onSubmit, isLoading }) => {
  const [analysisType, setAnalysisType] = useState('individual-raw');
  const [indicatorType, setIndicatorType] = useState('regular');
  const [gender, setGender] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [days, setDays] = useState({
    all: true, sun: true, mon: true, tue: true, wed: true, thu: true, fri: true, sat: true,
  });
  const [teamStatus, setTeamStatus] = useState('in-training');
  const [titleFilter, setTitleFilter] = useState('');

  const handleDayChange = (e) => {
    const { name, checked } = e.target;
    if (name === 'all') {
      setDays({
        all: checked, sun: checked, mon: checked, tue: checked, wed: checked, thu: checked, fri: checked, sat: checked,
      });
    } else {
      const newDays = { ...days, [name]: checked };
      if (!checked) {
        newDays.all = false;
      }
      const allChecked = Object.keys(newDays)
        .filter(k => k !== 'all')
        .every(k => newDays[k]);
      newDays.all = allChecked;
      setDays(newDays);
    }
  };

  const handleSubmit = () => {
    const allFilters = {
      analysisType,
      indicatorType,
      gender,
      dateRange,
      days,
      teamStatus,
      title: titleFilter,
    };
    if (onSubmit) {
      onSubmit(allFilters);
    }
  };

  return (
    <div className="filter-panel">
      <h3 className="panel-title">趨勢指標分析</h3>
      
      <div className="filter-grid">
        <div className="form-row"> 
          <div className="side-label-group">
            <label className="group-title">選擇列印類型</label>
            <div className="options-list">
              <div>
                <input type="radio" id="ir" name="analysisType" value="individual-raw" checked={analysisType === 'individual-raw'} onChange={(e) => setAnalysisType(e.target.value)} />
                <label htmlFor="ir">個人原始數據</label>
              </div>
              <div>
                <input type="radio" id="is" name="analysisType" value="individual-stats" checked={analysisType === 'individual-stats'} onChange={(e) => setAnalysisType(e.target.value)} />
                <label htmlFor="is">個人數據統計</label>
              </div>
              <div>
                <input type="radio" id="gr" name="analysisType" value="group-raw" checked={analysisType === 'group-raw'} onChange={(e) => setAnalysisType(e.target.value)} />
                <label htmlFor="gr">團體原始數據</label>
              </div>
              <div>
                <input type="radio" id="gs" name="analysisType" value="group-stats" checked={analysisType === 'group-stats'} onChange={(e) => setAnalysisType(e.target.value)} />
                <label htmlFor="gs">團體數據統計</label>
              </div>
              <div>
                <input type="radio" id="aio" name="analysisType" value="all-in-one" checked={analysisType === 'all-in-one'} onChange={(e) => setAnalysisType(e.target.value)} />
                <label htmlFor="aio">ALL IN ONE (常規指標)</label>
              </div>
            </div>
          </div>
          <div className="side-label-group">
            <label className="group-title">選擇類型</label>
            <div className="options-list">
              <div>
                <input type="radio" id="regular" name="indicatorType" value="regular" checked={indicatorType === 'regular'} onChange={(e) => setIndicatorType(e.target.value)} />
                <label htmlFor="regular">常規指標</label>
              </div>
              <div>
                <input type="radio" id="special" name="indicatorType" value="special" checked={indicatorType === 'special'} onChange={(e) => setIndicatorType(e.target.value)} />
                <label htmlFor="special">特殊指標</label>
              </div>
            </div>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>選擇性別</label>
            <input type="radio" id="male" name="gender" value="male" checked={gender === 'male'} onChange={(e) => setGender(e.target.value)} />
            <label htmlFor="male">男</label>
            <input type="radio" id="female" name="gender" value="female" checked={gender === 'female'} onChange={(e) => setGender(e.target.value)} />
            <label htmlFor="female">女</label>
            <input type="radio" id="all" name="gender" value="all" checked={gender === 'all'} onChange={(e) => setGender(e.target.value)} />
            <label htmlFor="all">全部</label>
          </div>
        </div>
        <div className="form-row">
           <div className="form-group">
            <label>選擇時間區段</label>
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} />
            <span className="date-range"> ~ </span>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>星期</label>
            <input type="checkbox" id="all-days" name="all" checked={days.all} onChange={handleDayChange} />
            <label htmlFor="all-days">全部</label>
            <input type="checkbox" id="sun" name="sun" checked={days.sun} onChange={handleDayChange} />
            <label htmlFor="sun">星期日</label>
            <input type="checkbox" id="mon" name="mon" checked={days.mon} onChange={handleDayChange} />
            <label htmlFor="mon">星期一</label>
            <input type="checkbox" id="tue" name="tue" checked={days.tue} onChange={handleDayChange} />
            <label htmlFor="tue">星期二</label>
            <input type="checkbox" id="wed" name="wed" checked={days.wed} onChange={handleDayChange} />
            <label htmlFor="wed">星期三</label>
            <input type="checkbox" id="thu" name="thu" checked={days.thu} onChange={handleDayChange} />
            <label htmlFor="thu">星期四</label>
            <input type="checkbox" id="fri" name="fri" checked={days.fri} onChange={handleDayChange} />
            <label htmlFor="fri">星期五</label>
            <input type="checkbox" id="sat" name="sat" checked={days.sat} onChange={handleDayChange} />
            <label htmlFor="sat">星期六</label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>選擇隊別</label>
            <select>
              <option>請選擇</option>
            </select>
            <input type="radio" id="training" name="teamStatus" value="in-training" checked={teamStatus === 'in-training'} onChange={(e) => setTeamStatus(e.target.value)} />
            <label htmlFor="training">在訓</label>
            <input type="radio" id="finished" name="teamStatus" value="finished" checked={teamStatus === 'finished'} onChange={(e) => setTeamStatus(e.target.value)} />
            <label htmlFor="finished">結訓</label>
            <input type="radio" id="all-teams" name="teamStatus" value="all-teams" checked={teamStatus === 'all-teams'} onChange={(e) => setTeamStatus(e.target.value)} />
            <label htmlFor="all-teams">所有隊別</label>
          </div>
        </div>
        <div className="form-row">
            <div className="form-group">
                <label>職稱篩選</label>
                <input type="text" placeholder="不輸入則不區分" className="text-input-warning" value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} />
            </div>
        </div>
        <div className="form-row">
            <div className="form-group">
                <label>個資選項</label>
                <select>
                    <option>全顯示(王大明)</option>
                </select>
            </div>
        </div>
      </div>
      
      <div className="action-buttons">
        <button onClick={() => console.log('列印...')} disabled={isLoading}>列印</button>
        <button onClick={() => console.log('PDF 轉 Excel...')} disabled={isLoading}>PDF轉EXCEL</button>
        <button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? '加載中...' : '套用篩選並獲取數據'}
        </button>
      </div>
    </div>
  );
};

export default Filter;