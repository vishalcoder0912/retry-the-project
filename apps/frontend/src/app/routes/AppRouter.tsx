import { BrowserRouter, Route, Routes } from "react-router-dom";
import AnalyticsPage from "@/features/analytics/pages/AnalyticsPage";
import ChatPage from "@/features/chat/pages/ChatPage";
import LocalChatPage from "@/features/chat/pages/LocalChatPage";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import EliteDashboardPage from "@/features/dashboard/pages/EliteDashboardPage";
import DataTablePage from "@/features/dashboard/pages/DataTablePage";
import UploadPage from "@/features/data/pages/UploadPage";
import MobileUploadPortal from "@/features/data/pages/MobileUploadPortal";
import MLPage from "@/features/ml/pages/MLPage";
import PdfUploadPage from "@/features/pdf/pages/PdfUploadPage";
import DataProfilingPage from "@/features/analytics/pages/DataProfilingPage";
import AnomalyDetectionPage from "@/features/analytics/pages/AnomalyDetectionPage";
import RelationshipsPage from "@/features/analytics/pages/RelationshipsPage";
import DataCleaningPage from "@/features/analytics/pages/DataCleaningPage";
import ExportPage from "@/features/analytics/pages/ExportPage";
import AppLayout from "@/shared/layout/AppLayout";
import NotFoundPage from "@/app/routes/NotFoundPage";

const AppRouter = () => (
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
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
        <Route path="/analytics/profile" element={<DataProfilingPage />} />
        <Route path="/analytics/anomalies" element={<AnomalyDetectionPage />} />
        <Route path="/analytics/relationships" element={<RelationshipsPage />} />
        <Route path="/analytics/cleaning" element={<DataCleaningPage />} />
        <Route path="/analytics/export" element={<ExportPage />} />
        <Route path="/ml" element={<MLPage />} />
      </Route>
      <Route path="/mobile-upload/:sessionId" element={<MobileUploadPortal />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
