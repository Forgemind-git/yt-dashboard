import { Routes, Route } from 'react-router-dom';
import { DateRangeProvider } from './context/DateRangeContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
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
          <Route index element={<ErrorBoundary><Overview /></ErrorBoundary>} />
          <Route path="videos" element={<ErrorBoundary><Videos /></ErrorBoundary>} />
          <Route path="audience" element={<ErrorBoundary><Audience /></ErrorBoundary>} />
          <Route path="insights" element={<ErrorBoundary><Insights /></ErrorBoundary>} />
          <Route path="ai" element={<ErrorBoundary><AiInsights /></ErrorBoundary>} />
          <Route path="realtime" element={<ErrorBoundary><Realtime /></ErrorBoundary>} />
          <Route path="health" element={<ErrorBoundary><Health /></ErrorBoundary>} />
        </Route>
      </Routes>
    </DateRangeProvider>
  );
}
