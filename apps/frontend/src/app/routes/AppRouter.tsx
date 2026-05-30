import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "@/shared/layout/AppLayout";
import StatusPanel from "@/shared/layout/StatusPanel";

const AnalyticsPage = lazy(() => import("@/features/analytics/pages/AnalyticsPage"));
const AgenticPage = lazy(() => import("@/features/analytics/pages/AgenticPage"));
const ChatPage = lazy(() => import("@/features/chat/pages/ChatPage"));
const LocalChatPage = lazy(() => import("@/features/chat/pages/LocalChatPage"));
const EliteDashboardPage = lazy(() => import("@/features/dashboard/pages/EliteDashboardPage"));
const DataTablePage = lazy(() => import("@/features/dashboard/pages/DataTablePage"));
const UploadPage = lazy(() => import("@/features/data/pages/UploadPage"));
const MobileUploadPortal = lazy(() => import("@/features/data/pages/MobileUploadPortal"));
const MLPage = lazy(() => import("@/features/ml/pages/MLPage"));
const PdfUploadPage = lazy(() => import("@/features/pdf/pages/PdfUploadPage"));
const DataProfilingPage = lazy(() => import("@/features/analytics/pages/DataProfilingPage"));
const AnomalyDetectionPage = lazy(() => import("@/features/analytics/pages/AnomalyDetectionPage"));
const RelationshipsPage = lazy(() => import("@/features/analytics/pages/RelationshipsPage"));
const DataCleaningPage = lazy(() => import("@/features/analytics/pages/DataCleaningPage"));
const ExportPage = lazy(() => import("@/features/analytics/pages/ExportPage"));
const AgenticDataSciencePage = lazy(() => import("@/features/analytics/pages/AgenticDataSciencePage"));
const NotFoundPage = lazy(() => import("@/app/routes/NotFoundPage"));

const AppRouter = () => (
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <Suspense fallback={<StatusPanel title="Loading" message="Preparing this workspace." />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<EliteDashboardPage />} />
          <Route path="/dashboard" element={<EliteDashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/pdf" element={<PdfUploadPage />} />
          <Route path="/pdf-upload" element={<PdfUploadPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/local-chat" element={<LocalChatPage />} />
          <Route path="/data" element={<DataTablePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/agentic" element={<AgenticPage />} />
          <Route path="/analytics/profile" element={<DataProfilingPage />} />
          <Route path="/analytics/anomalies" element={<AnomalyDetectionPage />} />
          <Route path="/analytics/relationships" element={<RelationshipsPage />} />
          <Route path="/analytics/cleaning" element={<DataCleaningPage />} />
          <Route path="/analytics/export" element={<ExportPage />} />
          <Route path="/agentic-data-science" element={<AgenticDataSciencePage />} />
          <Route path="/ml" element={<MLPage />} />
        </Route>
        <Route path="/mobile-upload/:sessionId" element={<MobileUploadPortal />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default AppRouter;
