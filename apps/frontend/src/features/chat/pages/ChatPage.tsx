import { useEffect } from 'react';
import { useData } from '@/features/data/context/useData';
import ChatInterface from '@/features/chat/components/ChatInterface';
import StatusPanel from '@/shared/layout/StatusPanel';

const ChatPage = () => {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate } = useData();

  useEffect(() => {
    if (!dataset && !isHydrating) {
      void loadDemo().catch(() => undefined);
    }
  }, [dataset, isHydrating, loadDemo]);

  if (isHydrating) {
    return (
      <StatusPanel
        title="Loading chat"
        message="Preparing the local analytics service before opening the chat interface."
      />
    );
  }

  if (apiError) {
    return (
      <StatusPanel
        title="Chat unavailable"
        message={apiError}
        actionLabel="Retry"
        onAction={() => {
          void retryHydrate();
        }}
      />
    );
  }

  if (!dataset) {
    return (
      <StatusPanel
        title="No dataset loaded"
        message="Load the demo dataset or upload a file before opening chat."
        actionLabel="Load Demo Dataset"
        onAction={() => {
          void loadDemo().catch(() => undefined);
        }}
      />
    );
  }

  return <ChatInterface />;
};

export default ChatPage;
