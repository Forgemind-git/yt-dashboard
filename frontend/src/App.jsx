import { Routes, Route } from 'react-router-dom';
import { DateRangeProvider } from './context/DateRangeContext';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Videos from './pages/Videos';
import Audience from './pages/Audience';
import Insights from './pages/Insights';
import Realtime from './pages/Realtime';
import Health from './pages/Health';
import AiInsights from './pages/AiInsights';

export default function App() {
  return (
    <DateRangeProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="videos" element={<Videos />} />
          <Route path="audience" element={<Audience />} />
          <Route path="insights" element={<Insights />} />
          <Route path="ai" element={<AiInsights />} />
          <Route path="realtime" element={<Realtime />} />
          <Route path="health" element={<Health />} />
        </Route>
      </Routes>
    </DateRangeProvider>
  );
}
