import { BrowserRouter, Route, Routes } from "react-router-dom";
import AnalyticsPage from "@/features/analytics/pages/AnalyticsPage";
import ChatPage from "@/features/chat/pages/ChatPage";
import LocalChatPage from "@/features/chat/pages/LocalChatPage";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import DataTablePage from "@/features/dashboard/pages/DataTablePage";
import UploadPage from "@/features/data/pages/UploadPage";
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
        <Route path="/" element={<DashboardPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/local-chat" element={<LocalChatPage />} />
        <Route path="/data" element={<DataTablePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
